import { FilterType, FILTER_CONFIGS } from './capture';
import { ExtendedFrameTemplate, getCanvasLayout, resolveOrderedPhotoUrls, drawCoverImage } from './frameTemplates';
import { PairedShot } from '@/types';

/** Supported video mime types with fallback hierarchy */
export function getSupportedVideoMimeType(): { mimeType: string; ext: 'mp4' | 'webm' } {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return { mimeType: 'video/webm', ext: 'webm' };
  }

  const preferredTypes: { mime: string; ext: 'mp4' | 'webm' }[] = [
    { mime: 'video/mp4;codecs=h264,aac', ext: 'mp4' },
    { mime: 'video/mp4;codecs=avc1', ext: 'mp4' },
    { mime: 'video/mp4', ext: 'mp4' },
    { mime: 'video/webm;codecs=vp9', ext: 'webm' },
    { mime: 'video/webm;codecs=vp8', ext: 'webm' },
    { mime: 'video/webm', ext: 'webm' },
  ];

  for (const item of preferredTypes) {
    if (MediaRecorder.isTypeSupported(item.mime)) {
      return { mimeType: item.mime, ext: item.ext };
    }
  }

  return { mimeType: 'video/webm', ext: 'webm' };
}

export interface RecorderSource {
  videoEl?: HTMLVideoElement | null;
  canvasEl?: HTMLCanvasElement | null;
  filter?: FilterType;
  mirror?: boolean;
}

/**
 * High-performance Live Photo Recorder
 * Records silent short video clips (1.5 - 3s) during countdown & shutter
 */
export class LivePhotoRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private animFrameId: number | null = null;
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private offscreenCtx: CanvasRenderingContext2D | null = null;
  private isRecording = false;
  private mimeInfo = getSupportedVideoMimeType();

  startRecording(source: RecorderSource): boolean {
    if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
      return false;
    }

    try {
      this.stop(); // Clean up if any previous recording was active
      this.recordedChunks = [];
      this.mimeInfo = getSupportedVideoMimeType();

      let stream: MediaStream | null = null;

      if (source.canvasEl && source.canvasEl.width > 0 && source.canvasEl.height > 0) {
        // Direct stream from canvas (e.g. virtual background controller canvas)
        stream = source.canvasEl.captureStream(24);
      } else if (source.videoEl && source.videoEl.videoWidth > 0) {
        // Offscreen canvas to bake filter and mirror smoothly
        const vW = source.videoEl.videoWidth;
        const vH = source.videoEl.videoHeight;
        const targetW = Math.min(vW, 960);
        const targetH = Math.round((vH / vW) * targetW);

        this.offscreenCanvas = document.createElement('canvas');
        this.offscreenCanvas.width = targetW;
        this.offscreenCanvas.height = targetH;
        this.offscreenCtx = this.offscreenCanvas.getContext('2d', { alpha: false });

        const ctx = this.offscreenCtx;
        const video = source.videoEl;
        const filter = source.filter || 'none';
        const mirror = Boolean(source.mirror);
        const cssFilter = filter !== 'none' ? FILTER_CONFIGS[filter] : 'none';

        const drawLoop = () => {
          if (!this.isRecording || !ctx || video.paused || video.ended) return;

          ctx.save();
          ctx.clearRect(0, 0, targetW, targetH);
          if (cssFilter && cssFilter !== 'none' && 'filter' in ctx) {
            ctx.filter = cssFilter;
          }
          if (mirror) {
            ctx.translate(targetW, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(video, 0, 0, targetW, targetH);
          } else {
            ctx.drawImage(video, 0, 0, targetW, targetH);
          }
          ctx.restore();

          this.animFrameId = requestAnimationFrame(drawLoop);
        };

        this.animFrameId = requestAnimationFrame(drawLoop);
        stream = this.offscreenCanvas.captureStream(24);
      }

      if (!stream) return false;

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: this.mimeInfo.mimeType,
        videoBitsPerSecond: 2_500_000,
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(100);
      this.isRecording = true;
      return true;
    } catch (err) {
      console.warn('Failed to start Live Photo recorder:', err);
      return false;
    }
  }

  async stopRecording(): Promise<{ dataUrl: string; ext: 'mp4' | 'webm' } | null> {
    if (!this.mediaRecorder || !this.isRecording) {
      this.stop();
      return null;
    }

    return new Promise((resolve) => {
      const recorder = this.mediaRecorder!;
      recorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: this.mimeInfo.mimeType });
        this.stop();

        if (blob.size === 0) {
          resolve(null);
          return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          resolve({ dataUrl: base64data, ext: this.mimeInfo.ext });
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      };

      try {
        recorder.stop();
      } catch (e) {
        this.stop();
        resolve(null);
      }
    });
  }

  stop(): void {
    this.isRecording = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch (e) {}
    }
    this.mediaRecorder = null;
    this.offscreenCanvas = null;
    this.offscreenCtx = null;
  }
}

/** Preload an image safely */
function preloadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Preload a video element safely */
function preloadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    let resolved = false;
    const onReady = () => {
      if (!resolved) {
        resolved = true;
        resolve(video);
      }
    };

    video.onloadedmetadata = onReady;
    video.oncanplay = onReady;
    video.onerror = (e) => {
      if (!resolved) {
        resolved = true;
        reject(e);
      }
    };
    video.src = url;
    video.load();

    // Fallback timeout in case event doesn't fire
    setTimeout(() => onReady(), 3000);
  });
}

export interface LiveStripRenderOptions {
  canvas: HTMLCanvasElement;
  slots: PairedShot[];
  template: ExtendedFrameTemplate;
  captionText: string;
  accentColor: string;
  selectedOrder?: (number | string)[];
  photoOffsets?: Record<number | string, { x?: number; y?: number; scale?: number }>;
  isSolo?: boolean;
  motionDurationMs?: number;
  stillHoldDurationMs?: number;
  durationMs?: number;
  onProgress?: (ratio: number) => void;
}

/**
 * Renders a full animated video photostrip from Live Photo clips.
 * Loops through the live video clips (5s motion) followed by still photo hold (3s),
 * applies frame overlay & captions, and records the output stream to MP4/WebM!
 */
export async function renderLiveVideoStrip(options: LiveStripRenderOptions): Promise<{ blob: Blob; url: string; ext: 'mp4' | 'webm' }> {
  const {
    canvas,
    slots,
    template,
    captionText,
    accentColor,
    selectedOrder,
    photoOffsets,
    isSolo = false,
    motionDurationMs = 5000,
    stillHoldDurationMs = 3000,
    onProgress,
  } = options;

  const totalDurationMs = options.durationMs || (motionDurationMs + stillHoldDurationMs);

  const layout = getCanvasLayout(template, isSolo);
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext('2d')!;

  const { leftUrls, rightUrls, allUrls } = resolveOrderedPhotoUrls(slots, selectedOrder);

  // Map slots to video and still URLs
  const getSlotMedia = (idx: number): { photoUrl?: string; videoUrl?: string } => {
    if (selectedOrder && selectedOrder[idx]) {
      const item = selectedOrder[idx];
      if (typeof item === 'string' && item.includes('_')) {
        const [slotStr, side] = item.split('_');
        const slotIdx = parseInt(slotStr, 10);
        const slot = slots.find((s) => s.slotIndex === slotIdx);
        if (slot) {
          const photoUrl = side === 'left' ? slot.leftPhotoUrl : slot.rightPhotoUrl;
          const videoUrl = side === 'left' ? slot.leftLiveVideoUrl : slot.rightLiveVideoUrl;
          return { photoUrl, videoUrl };
        }
      }
    }
    // Fallback based on slot index
    const fallbackPhoto = allUrls[idx % Math.max(1, allUrls.length)];
    const matchingSlot = slots[idx % Math.max(1, slots.length)];
    const fallbackVideo = matchingSlot?.leftLiveVideoUrl || matchingSlot?.rightLiveVideoUrl;
    return { photoUrl: fallbackPhoto, videoUrl: fallbackVideo };
  };

  const getOffset = (idx: number) => {
    if (!photoOffsets) return { x: 0, y: 0, scale: 1 };
    const off = Array.isArray(photoOffsets) ? photoOffsets[idx] : photoOffsets[idx] || photoOffsets[String(idx)];
    return {
      x: typeof off?.x === 'number' ? off.x : 0,
      y: typeof off?.y === 'number' ? off.y : 0,
      scale: typeof off?.scale === 'number' ? off.scale : 1,
    };
  };

  // Preload frame overlay
  let overlayImg: HTMLImageElement | null = null;
  if (layout.overlayUrl) {
    try {
      overlayImg = await preloadImage(layout.overlayUrl);
    } catch (e) {
      console.warn('Could not preload frame overlay:', e);
    }
  }

  // Preload media elements for each cutout box
  const allBoxes = layout.isTwinStrip
    ? [...layout.leftBoxes, ...layout.rightBoxes]
    : [...layout.leftBoxes, ...layout.rightBoxes];

  type MediaItem = { video?: HTMLVideoElement; img?: HTMLImageElement; box: typeof allBoxes[0]; offset: { x: number; y: number; scale: number } };
  const loadedMedia: MediaItem[] = [];

  for (let i = 0; i < allBoxes.length; i++) {
    const box = allBoxes[i];
    const off = getOffset(i);
    const media = getSlotMedia(i);

    let videoEl: HTMLVideoElement | undefined = undefined;
    let imgEl: HTMLImageElement | undefined = undefined;

    if (media.videoUrl) {
      try {
        videoEl = await preloadVideo(media.videoUrl);
      } catch (err) {
        console.warn('Failed to preload live video for slot', i, err);
      }
    }

    if (media.photoUrl) {
      try {
        imgEl = await preloadImage(media.photoUrl);
      } catch (err) {
        console.warn('Failed to preload photo for slot', i, err);
      }
    }

    loadedMedia.push({ video: videoEl, img: imgEl, box, offset: off });
  }

  // Start all videos from 0 and loop
  loadedMedia.forEach((m) => {
    if (m.video) {
      m.video.currentTime = 0;
      m.video.loop = true;
      m.video.play().catch(() => {});
    }
  });

  const mimeInfo = getSupportedVideoMimeType();
  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, {
    mimeType: mimeInfo.mimeType,
    videoBitsPerSecond: 4_000_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  return new Promise((resolve, reject) => {
    recorder.onstop = () => {
      // Pause all videos
      loadedMedia.forEach((m) => {
        if (m.video) {
          m.video.pause();
        }
      });

      const blob = new Blob(chunks, { type: mimeInfo.mimeType });
      const downloadUrl = URL.createObjectURL(blob);
      resolve({ blob, url: downloadUrl, ext: mimeInfo.ext });
    };

    recorder.onerror = reject;
    recorder.start(100);

    const startTime = performance.now();
    let isPausedForHold = false;

    function renderFrame() {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / totalDurationMs);
      if (onProgress) onProgress(progress);

      const isMotionPhase = elapsed < motionDurationMs;

      if (!isMotionPhase && !isPausedForHold) {
        isPausedForHold = true;
        loadedMedia.forEach((m) => {
          if (m.video) m.video.pause();
        });
      }

      // 1. Clear background
      ctx.fillStyle = '#0f1016';
      ctx.fillRect(0, 0, layout.width, layout.height);

      // 2. Draw media into cutout boxes (Motion during 5s, still image during 3s hold)
      for (const m of loadedMedia) {
        const { box, offset } = m;
        if (isMotionPhase && m.video && m.video.readyState >= 2) {
          drawCoverImage(ctx, m.video, box.x, box.y, box.width, box.height, 4, offset.x, offset.y, offset.scale);
        } else if (m.img) {
          drawCoverImage(ctx, m.img, box.x, box.y, box.width, box.height, 4, offset.x, offset.y, offset.scale);
        } else if (m.video) {
          drawCoverImage(ctx, m.video, box.x, box.y, box.width, box.height, 4, offset.x, offset.y, offset.scale);
        } else {
          ctx.fillStyle = '#1a1b24';
          ctx.beginPath();
          ctx.roundRect(box.x, box.y, box.width, box.height, 4);
          ctx.fill();
        }
      }

      // 3. Draw Frame Overlay
      if (overlayImg) {
        if (layout.isTwinStrip && layout.singleStripWidth && layout.singleStripHeight) {
          const gap = layout.gap || 30;
          ctx.drawImage(overlayImg, 0, 0, layout.singleStripWidth, layout.singleStripHeight);
          ctx.drawImage(overlayImg, layout.singleStripWidth + gap, 0, layout.singleStripWidth, layout.singleStripHeight);
        } else {
          ctx.drawImage(overlayImg, 0, 0, layout.width, layout.height);
        }
      } else {
        // Fallback vector frame decoration
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 3;
        allBoxes.forEach((box) => {
          ctx.beginPath();
          ctx.roundRect(box.x - 2, box.y - 2, box.width + 4, box.height + 4, 6);
          ctx.stroke();
        });

        ctx.fillStyle = accentColor;
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SNAPSYNC PHOTOBOOTH', layout.width / 2, 28);

        const text = captionText || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '12px sans-serif';
        ctx.fillText(text, layout.width / 2, layout.height - 10);
      }

      if (elapsed < totalDurationMs) {
        requestAnimationFrame(renderFrame);
      } else {
        recorder.stop();
      }
    }

    requestAnimationFrame(renderFrame);
  });
}

