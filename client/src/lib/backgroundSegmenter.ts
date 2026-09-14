// High-Performance Virtual Background Segmenter
// Uses Google MediaPipe Selfie Segmentation with Canvas 2D Hardware Acceleration

import { VirtualBackground } from './backgroundPresets';
import { FilterType, FILTER_CONFIGS } from './capture';

// Cached HTMLImageElement instances to avoid reloading images during real-time animation frames
const imageCache = new Map<string, HTMLImageElement>();

export function getCachedImage(src: string): Promise<HTMLImageElement> {
  if (imageCache.has(src)) {
    const existing = imageCache.get(src)!;
    if (existing.complete && existing.naturalWidth > 0) {
      return Promise.resolve(existing);
    }
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

/** Draws an image into a canvas context while preserving cover aspect ratio (center-cropped) */
export function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  canvasWidth: number,
  canvasHeight: number,
) {
  const imgWidth = img.naturalWidth || img.width;
  const imgHeight = img.naturalHeight || img.height;

  if (!imgWidth || !imgHeight) return;

  const canvasRatio = canvasWidth / canvasHeight;
  const imgRatio = imgWidth / imgHeight;

  let sW = imgWidth;
  let sH = imgHeight;
  let sx = 0;
  let sy = 0;

  if (imgRatio > canvasRatio) {
    // Image is wider than canvas
    sW = Math.round(imgHeight * canvasRatio);
    sx = Math.round((imgWidth - sW) / 2);
  } else {
    // Image is taller than canvas
    sH = Math.round(imgWidth / canvasRatio);
    sy = Math.round((imgHeight - sH) / 2);
  }

  ctx.drawImage(img, sx, sy, sW, sH, 0, 0, canvasWidth, canvasHeight);
}

// Global reference to the MediaPipe SelfieSegmentation solution
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let selfieSegmentationInstance: any = null;
let scriptLoadingPromise: Promise<void> | null = null;

/** Ensures the MediaPipe script and WASM files are loaded in browser */
export async function loadMediaPipeSelfieSegmentation(): Promise<void> {
  if (typeof window === 'undefined') return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window as any).SelfieSegmentation) return;

  if (scriptLoadingPromise) return scriptLoadingPromise;

  scriptLoadingPromise = new Promise<void>((resolve, reject) => {
    // First try local public/mediapipe/selfie_segmentation/selfie_segmentation.js
    const script = document.createElement('script');
    script.src = '/mediapipe/selfie_segmentation/selfie_segmentation.js';
    script.async = true;

    script.onload = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((window as any).SelfieSegmentation) {
        resolve();
      } else {
        fallbackToCDN(resolve, reject);
      }
    };

    script.onerror = () => {
      fallbackToCDN(resolve, reject);
    };

    document.head.appendChild(script);
  });

  return scriptLoadingPromise;
}

function fallbackToCDN(resolve: () => void, reject: (reason?: unknown) => void) {
  const cdnScript = document.createElement('script');
  cdnScript.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js';
  cdnScript.async = true;
  cdnScript.onload = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).SelfieSegmentation) {
      resolve();
    } else {
      reject(new Error('Gagal memuat MediaPipe Selfie Segmentation.'));
    }
  };
  cdnScript.onerror = (err) => reject(err);
  document.head.appendChild(cdnScript);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getSegmenter(): Promise<any> {
  if (selfieSegmentationInstance) return selfieSegmentationInstance;

  await loadMediaPipeSelfieSegmentation();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SelfieSegmentation = (window as any).SelfieSegmentation;
  if (!SelfieSegmentation) {
    throw new Error('SelfieSegmentation tidak tersedia di window.');
  }

  const segmenter = new SelfieSegmentation({
    locateFile: (file: string) => {
      // Prefer local files in public/mediapipe/selfie_segmentation/
      return `/mediapipe/selfie_segmentation/${file}`;
    },
  });

  segmenter.setOptions({
    modelSelection: 0, // 0 = General model (substantially higher accuracy & human edge detection)
    selfieMode: false, // We handle mirroring explicitly in canvas
  });

  await segmenter.initialize();
  selfieSegmentationInstance = segmenter;
  return selfieSegmentationInstance;
}

export interface SegmenterRenderOptions {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  background: VirtualBackground;
  filter?: FilterType;
  mirror?: boolean;
}

/**
 * Controller class to manage the real-time background rendering loop.
 */
export class BackgroundRenderController {
  private isRunning = false;
  private isCameraEnabled = true;
  private animFrameId: number | null = null;
  private videoEl: HTMLVideoElement | null = null;
  private canvasEl: HTMLCanvasElement | null = null;
  private currentBg: VirtualBackground = { id: 'none', name: 'None', category: 'all', type: 'none', subtitle: '' };
  private currentFilter: FilterType = 'none';
  private currentMirror = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private segmenter: any = null;
  private isSegmenting = false;
  private lastRenderTimestamp = 0;
  private cachedBgImage: HTMLImageElement | null = null;
  private maskCanvas: HTMLCanvasElement | null = null;
  private personCanvas: HTMLCanvasElement | null = null;

  async start(
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    background: VirtualBackground,
    filter: FilterType = 'none',
    mirror: boolean = false,
  ) {
    this.videoEl = video;
    this.canvasEl = canvas;
    this.currentBg = background;
    this.currentFilter = filter;
    this.currentMirror = mirror;
    this.isRunning = true;
    this.isCameraEnabled = true;

    // Preload background image if any
    this.updateBackground(background);

    try {
      this.segmenter = await getSegmenter();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.segmenter.onResults((results: any) => {
        try {
          this.drawComposite(results);
        } catch (e) {
          console.warn('[VirtualBG] Error during composite render:', e);
        } finally {
          this.isSegmenting = false;
        }
      });
    } catch (err) {
      console.warn('[VirtualBG] Segmenter init error:', err);
    }

    this.loop();
  }

  updateBackground(bg: VirtualBackground) {
    this.currentBg = bg;
    const targetUrl = bg.type === 'custom' ? bg.customDataUrl : bg.imageUrl;
    if (targetUrl) {
      getCachedImage(targetUrl)
        .then((img) => {
          this.cachedBgImage = img;
        })
        .catch(() => {
          this.cachedBgImage = null;
        });
    } else {
      this.cachedBgImage = null;
    }
  }

  updateCameraState(camOn: boolean) {
    this.isCameraEnabled = camOn;
    if (!camOn) {
      if (this.canvasEl) {
        const ctx = this.canvasEl.getContext('2d');
        ctx?.clearRect(0, 0, this.canvasEl.width, this.canvasEl.height);
      }
    }
  }

  updateFilter(filter: FilterType) {
    this.currentFilter = filter;
  }

  updateMirror(mirror: boolean) {
    this.currentMirror = mirror;
  }

  private loop = () => {
    if (!this.isRunning) return;

    const now = performance.now();
    // Cap rendering loop to ~30-40 FPS to keep CPU/GPU cool on phones and laptops
    if (now - this.lastRenderTimestamp >= 24) {
      this.lastRenderTimestamp = now;
      this.processNextFrame();
    }

    this.animFrameId = requestAnimationFrame(this.loop);
  };

  private async processNextFrame() {
    if (!this.isCameraEnabled) return;

    const video = this.videoEl;
    const canvas = this.canvasEl;
    if (!video || !canvas || video.readyState < 2 || video.videoWidth === 0 || video.paused) return;

    // Set canvas internal resolution to match video
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // If background is none, simple pass-through with active filter and mirror
    if (this.currentBg.type === 'none') {
      this.drawSimplePassthrough(ctx, video, canvas.width, canvas.height);
      return;
    }

    // If segmenter is ready and not busy with a previous frame, send next frame
    if (this.segmenter && !this.isSegmenting) {
      this.isSegmenting = true;
      try {
        await this.segmenter.send({ image: video });
      } catch (err) {
        console.warn('[VirtualBG] Frame send dropped:', err);
        this.isSegmenting = false;
      }
    }
  }

  private drawSimplePassthrough(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    width: number,
    height: number,
  ) {
    ctx.save();
    ctx.clearRect(0, 0, width, height);

    if (this.currentMirror) {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    const cssFilter = this.currentFilter && this.currentFilter !== 'none'
      ? FILTER_CONFIGS[this.currentFilter]
      : 'none';

    if (cssFilter && cssFilter !== 'none' && 'filter' in ctx) {
      ctx.filter = cssFilter;
    }

    ctx.drawImage(video, 0, 0, width, height);
    ctx.restore();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private drawComposite(results: any) {
    const canvas = this.canvasEl;
    if (!canvas || !this.isRunning || !this.isCameraEnabled) return;
    if (!results || !results.segmentationMask || !results.image) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Allocate & size dedicated offscreen processing buffers
    if (!this.maskCanvas) {
      this.maskCanvas = document.createElement('canvas');
    }
    if (this.maskCanvas.width !== width || this.maskCanvas.height !== height) {
      this.maskCanvas.width = width;
      this.maskCanvas.height = height;
    }

    if (!this.personCanvas) {
      this.personCanvas = document.createElement('canvas');
    }
    if (this.personCanvas.width !== width || this.personCanvas.height !== height) {
      this.personCanvas.width = width;
      this.personCanvas.height = height;
    }

    const maskCtx = this.maskCanvas.getContext('2d');
    const personCtx = this.personCanvas.getContext('2d');
    if (!maskCtx || !personCtx) return;

    // ── STEP 1: Fresh segmentation mask (Zero ghosting or trailing on movement) ──
    // Clear mask canvas completely on EVERY frame so old body positions don't accumulate
    maskCtx.clearRect(0, 0, width, height);
    maskCtx.drawImage(results.segmentationMask, 0, 0, width, height);

    // ── STEP 2: Edge Isolation and Natural Anti-Aliasing ───────────────────────
    personCtx.save();
    personCtx.clearRect(0, 0, width, height);

    // Draw the clean segmentation mask
    personCtx.drawImage(this.maskCanvas, 0, 0, width, height);

    // Mask the person video feed inside the silhouette
    personCtx.globalCompositeOperation = 'source-in';
    const cssFilter = this.currentFilter && this.currentFilter !== 'none'
      ? FILTER_CONFIGS[this.currentFilter]
      : 'none';
    if (cssFilter && cssFilter !== 'none' && 'filter' in personCtx) {
      personCtx.filter = cssFilter;
    }
    personCtx.drawImage(results.image, 0, 0, width, height);
    personCtx.restore();

    // ── STEP 3: Multi-Layer Main Canvas Assembly ──────────────────────────────
    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // Apply mirror if user requested
    if (this.currentMirror) {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    // Layer A (Bottom): Virtual Background
    const bg = this.currentBg;
    if (bg.type === 'blur') {
      const blurAmount = bg.blurPx || 16;
      if ('filter' in ctx) {
        ctx.filter = `blur(${blurAmount}px)`;
      }
      ctx.drawImage(results.image, 0, 0, width, height);
      ctx.filter = 'none';
    } else if (bg.type === 'color' && bg.color) {
      ctx.fillStyle = bg.color;
      ctx.fillRect(0, 0, width, height);
    } else if ((bg.type === 'image' || bg.type === 'custom') && this.cachedBgImage) {
      drawImageCover(ctx, this.cachedBgImage, width, height);
    } else if (bg.color) {
      ctx.fillStyle = bg.color;
      ctx.fillRect(0, 0, width, height);
    } else {
      if ('filter' in ctx) {
        ctx.filter = 'blur(16px)';
      }
      ctx.drawImage(results.image, 0, 0, width, height);
      ctx.filter = 'none';
    }

    // Layer B (Top): Feathered, Silky Smooth Human Subject
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.personCanvas, 0, 0, width, height);

    ctx.restore();
  }

  /**
   * Captures the current live composition (or segmented frame) as high quality dataUrl
   */
  captureFrame(): string {
    const canvas = this.canvasEl;
    if (!canvas || canvas.width === 0 || canvas.height === 0) return '';
    return canvas.toDataURL('image/jpeg', 0.95);
  }

  stop() {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }
}
