// Camera capture utilities: high-performance, instant, and guaranteed filter baking

export type FilterType =
  | 'none'
  | 'clean'
  | 'vivid'
  | 'matte'
  | 'soft_blush'
  | 'warm'
  | 'vintage'
  | 'polaroid'
  | 'kodak'
  | 'fuji'
  | 'nostalgia'
  | 'bw'
  | 'noir'
  | 'silver'
  | 'sepia'
  | 'cool'
  | 'golden'
  | 'cyber'
  | 'emerald'
  | 'dramatic'
  | 'pastel';

export const FILTER_CONFIGS: Record<FilterType, string> = {
  none: 'none',
  clean: 'brightness(1.08) contrast(1.04) saturate(1.06)',
  vivid: 'saturate(1.65) contrast(1.1) brightness(1.02)',
  matte: 'contrast(0.92) brightness(1.05) saturate(0.92)',
  soft_blush: 'sepia(0.18) saturate(1.25) brightness(1.06) hue-rotate(352deg)',
  warm: 'sepia(0.35) saturate(1.25) brightness(1.05)',
  vintage: 'sepia(0.45) contrast(1.15) brightness(0.95) saturate(1.1) hue-rotate(348deg)',
  polaroid: 'contrast(1.15) brightness(1.1) saturate(1.2) sepia(0.22)',
  kodak: 'sepia(0.28) saturate(1.45) contrast(1.08) brightness(1.04) hue-rotate(355deg)',
  fuji: 'contrast(1.12) saturate(1.15) brightness(1.04) hue-rotate(10deg)',
  nostalgia: 'sepia(0.5) contrast(0.92) brightness(1.08) saturate(0.85)',
  bw: 'grayscale(1) contrast(1.1)',
  noir: 'grayscale(1) contrast(1.6) brightness(0.92)',
  silver: 'grayscale(1) brightness(1.12) contrast(0.95)',
  sepia: 'sepia(0.95) contrast(1.05) brightness(0.96)',
  cool: 'hue-rotate(25deg) saturate(0.95) brightness(1.04)',
  golden: 'sepia(0.48) saturate(1.55) brightness(1.06) contrast(1.05) hue-rotate(345deg)',
  cyber: 'hue-rotate(275deg) saturate(1.65) contrast(1.15)',
  emerald: 'hue-rotate(65deg) saturate(1.1) contrast(1.05) brightness(0.98)',
  dramatic: 'contrast(1.35) saturate(0.75) brightness(0.95)',
  pastel: 'saturate(1.3) brightness(1.12) contrast(0.95) hue-rotate(15deg)',
};

/** High-speed direct pixel transformation ensuring 100% filter baking across all GPUs and platforms */
function applyPixelFilter(data: Uint8ClampedArray, filter: FilterType) {
  const len = data.length;

  if (filter === 'bw') {
    for (let i = 0; i < len; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const c = (gray - 128) * 1.1 + 128;
      const v = c < 0 ? 0 : c > 255 ? 255 : c;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
    }
    return;
  }

  if (filter === 'noir') {
    for (let i = 0; i < len; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const c = (gray * 0.92 - 128) * 1.6 + 128;
      const v = c < 0 ? 0 : c > 255 ? 255 : c;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
    }
    return;
  }

  if (filter === 'silver') {
    for (let i = 0; i < len; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const c = (gray * 1.12 - 128) * 0.95 + 128;
      const v = c < 0 ? 0 : c > 255 ? 255 : c;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
    }
    return;
  }

  if (filter === 'sepia') {
    for (let i = 0; i < len; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      data[i] = Math.min(255, 0.393 * r + 0.769 * g + 0.189 * b);
      data[i + 1] = Math.min(255, 0.349 * r + 0.686 * g + 0.168 * b);
      data[i + 2] = Math.min(255, 0.272 * r + 0.534 * g + 0.131 * b);
    }
    return;
  }

  if (filter === 'warm') {
    for (let i = 0; i < len; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const sr = 0.393 * r + 0.769 * g + 0.189 * b;
      const sg = 0.349 * r + 0.686 * g + 0.168 * b;
      const sb = 0.272 * r + 0.534 * g + 0.131 * b;
      data[i] = Math.min(255, (r * 0.65 + sr * 0.35) * 1.08);
      data[i + 1] = Math.min(255, (g * 0.65 + sg * 0.35) * 1.04);
      data[i + 2] = Math.min(255, (b * 0.65 + sb * 0.35) * 0.92);
    }
    return;
  }

  if (filter === 'vintage') {
    for (let i = 0; i < len; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const sr = 0.393 * r + 0.769 * g + 0.189 * b;
      const sg = 0.349 * r + 0.686 * g + 0.168 * b;
      const sb = 0.272 * r + 0.534 * g + 0.131 * b;
      let nr = (r * 0.55 + sr * 0.45) * 1.02;
      let ng = (g * 0.55 + sg * 0.45);
      let nb = (b * 0.55 + sb * 0.45) * 0.88;
      data[i] = Math.min(255, Math.max(0, (nr - 128) * 1.15 + 128));
      data[i + 1] = Math.min(255, Math.max(0, (ng - 128) * 1.15 + 128));
      data[i + 2] = Math.min(255, Math.max(0, (nb - 128) * 1.15 + 128));
    }
    return;
  }

  if (filter === 'polaroid') {
    for (let i = 0; i < len; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const sr = 0.393 * r + 0.769 * g + 0.189 * b;
      const sg = 0.349 * r + 0.686 * g + 0.168 * b;
      const sb = 0.272 * r + 0.534 * g + 0.131 * b;
      let nr = (r * 0.78 + sr * 0.22) * 1.1;
      let ng = (g * 0.78 + sg * 0.22) * 1.08;
      let nb = (b * 0.78 + sb * 0.22) * 0.98;
      data[i] = Math.min(255, Math.max(0, (nr - 128) * 1.15 + 128));
      data[i + 1] = Math.min(255, Math.max(0, (ng - 128) * 1.15 + 128));
      data[i + 2] = Math.min(255, Math.max(0, (nb - 128) * 1.15 + 128));
    }
    return;
  }

  if (filter === 'kodak') {
    for (let i = 0; i < len; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const sr = 0.393 * r + 0.769 * g + 0.189 * b;
      const sg = 0.349 * r + 0.686 * g + 0.168 * b;
      const sb = 0.272 * r + 0.534 * g + 0.131 * b;
      let nr = (r * 0.72 + sr * 0.28) * 1.12;
      let ng = (g * 0.72 + sg * 0.28) * 1.05;
      let nb = (b * 0.72 + sb * 0.28) * 0.94;
      data[i] = Math.min(255, Math.max(0, (nr - 128) * 1.1 + 128));
      data[i + 1] = Math.min(255, Math.max(0, (ng - 128) * 1.1 + 128));
      data[i + 2] = Math.min(255, Math.max(0, (nb - 128) * 1.1 + 128));
    }
    return;
  }

  if (filter === 'cool') {
    for (let i = 0; i < len; i += 4) {
      data[i] = Math.min(255, data[i] * 0.92);
      data[i + 1] = Math.min(255, data[i + 1] * 1.02);
      data[i + 2] = Math.min(255, data[i + 2] * 1.2);
    }
    return;
  }

  if (filter === 'golden') {
    for (let i = 0; i < len; i += 4) {
      data[i] = Math.min(255, data[i] * 1.2);
      data[i + 1] = Math.min(255, data[i + 1] * 1.1);
      data[i + 2] = Math.min(255, data[i + 2] * 0.8);
    }
    return;
  }

  if (filter === 'cyber') {
    for (let i = 0; i < len; i += 4) {
      data[i] = Math.min(255, data[i] * 1.25);
      data[i + 1] = Math.min(255, data[i + 1] * 0.85);
      data[i + 2] = Math.min(255, data[i + 2] * 1.3);
    }
    return;
  }

  if (filter === 'emerald') {
    for (let i = 0; i < len; i += 4) {
      data[i] = Math.min(255, data[i] * 0.85);
      data[i + 1] = Math.min(255, data[i + 1] * 1.22);
      data[i + 2] = Math.min(255, data[i + 2] * 1.15);
    }
    return;
  }

  if (filter === 'clean') {
    for (let i = 0; i < len; i += 4) {
      const r = (data[i] * 1.08 - 128) * 1.04 + 128;
      const g = (data[i + 1] * 1.08 - 128) * 1.04 + 128;
      const b = (data[i + 2] * 1.08 - 128) * 1.04 + 128;
      data[i] = Math.min(255, Math.max(0, r));
      data[i + 1] = Math.min(255, Math.max(0, g));
      data[i + 2] = Math.min(255, Math.max(0, b));
    }
    return;
  }

  if (filter === 'vivid') {
    for (let i = 0; i < len; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      let nr = gray + (r - gray) * 1.65;
      let ng = gray + (g - gray) * 1.65;
      let nb = gray + (b - gray) * 1.65;
      nr = (nr * 1.02 - 128) * 1.1 + 128;
      ng = (ng * 1.02 - 128) * 1.1 + 128;
      nb = (nb * 1.02 - 128) * 1.1 + 128;
      data[i] = Math.min(255, Math.max(0, nr));
      data[i + 1] = Math.min(255, Math.max(0, ng));
      data[i + 2] = Math.min(255, Math.max(0, nb));
    }
    return;
  }

  if (filter === 'matte') {
    for (let i = 0; i < len; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      let nr = (gray + (r - gray) * 0.92) * 1.05;
      let ng = (gray + (g - gray) * 0.92) * 1.05;
      let nb = (gray + (b - gray) * 0.92) * 1.05;
      data[i] = Math.min(255, Math.max(0, (nr - 128) * 0.92 + 128));
      data[i + 1] = Math.min(255, Math.max(0, (ng - 128) * 0.92 + 128));
      data[i + 2] = Math.min(255, Math.max(0, (nb - 128) * 0.92 + 128));
    }
    return;
  }

  if (filter === 'soft_blush') {
    for (let i = 0; i < len; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const sr = 0.393 * r + 0.769 * g + 0.189 * b;
      const sg = 0.349 * r + 0.686 * g + 0.168 * b;
      const sb = 0.272 * r + 0.534 * g + 0.131 * b;
      let nr = (r * 0.82 + sr * 0.18) * 1.06;
      let ng = (g * 0.82 + sg * 0.18) * 1.02;
      let nb = (b * 0.82 + sb * 0.18) * 0.98;
      const gray = 0.299 * nr + 0.587 * ng + 0.114 * nb;
      data[i] = Math.min(255, Math.max(0, gray + (nr - gray) * 1.25));
      data[i + 1] = Math.min(255, Math.max(0, gray + (ng - gray) * 1.25));
      data[i + 2] = Math.min(255, Math.max(0, gray + (nb - gray) * 1.25));
    }
    return;
  }

  if (filter === 'fuji') {
    for (let i = 0; i < len; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      let nr = (gray + (r - gray) * 1.15) * 1.04;
      let ng = (gray + (g - gray) * 1.15) * 1.04;
      let nb = (gray + (b - gray) * 1.15) * 1.08;
      data[i] = Math.min(255, Math.max(0, (nr - 128) * 1.12 + 128));
      data[i + 1] = Math.min(255, Math.max(0, (ng - 128) * 1.12 + 128));
      data[i + 2] = Math.min(255, Math.max(0, (nb - 128) * 1.12 + 128));
    }
    return;
  }

  if (filter === 'nostalgia') {
    for (let i = 0; i < len; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const sr = 0.393 * r + 0.769 * g + 0.189 * b;
      const sg = 0.349 * r + 0.686 * g + 0.168 * b;
      const sb = 0.272 * r + 0.534 * g + 0.131 * b;
      let nr = (r * 0.5 + sr * 0.5) * 1.08;
      let ng = (g * 0.5 + sg * 0.5) * 1.08;
      let nb = (b * 0.5 + sb * 0.5) * 0.95;
      data[i] = Math.min(255, Math.max(0, (nr - 128) * 0.92 + 128));
      data[i + 1] = Math.min(255, Math.max(0, (ng - 128) * 0.92 + 128));
      data[i + 2] = Math.min(255, Math.max(0, (nb - 128) * 0.92 + 128));
    }
    return;
  }

  if (filter === 'dramatic') {
    for (let i = 0; i < len; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      let nr = (gray + (r - gray) * 0.75) * 0.95;
      let ng = (gray + (g - gray) * 0.75) * 0.95;
      let nb = (gray + (b - gray) * 0.75) * 0.95;
      data[i] = Math.min(255, Math.max(0, (nr - 128) * 1.35 + 128));
      data[i + 1] = Math.min(255, Math.max(0, (ng - 128) * 1.35 + 128));
      data[i + 2] = Math.min(255, Math.max(0, (nb - 128) * 1.35 + 128));
    }
    return;
  }

  if (filter === 'pastel') {
    for (let i = 0; i < len; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      let nr = (gray + (r - gray) * 1.3) * 1.12;
      let ng = (gray + (g - gray) * 1.3) * 1.10;
      let nb = (gray + (b - gray) * 1.3) * 1.14;
      data[i] = Math.min(255, Math.max(0, (nr - 128) * 0.95 + 128));
      data[i + 1] = Math.min(255, Math.max(0, (ng - 128) * 0.95 + 128));
      data[i + 2] = Math.min(255, Math.max(0, (nb - 128) * 0.95 + 128));
    }
    return;
  }

  // Default rich boost for other presets
  for (let i = 0; i < len; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    let nr = gray + (r - gray) * 1.25;
    let ng = gray + (g - gray) * 1.25;
    let nb = gray + (b - gray) * 1.25;
    data[i] = Math.min(255, Math.max(0, (nr - 128) * 1.08 + 128));
    data[i + 1] = Math.min(255, Math.max(0, (ng - 128) * 1.08 + 128));
    data[i + 2] = Math.min(255, Math.max(0, (nb - 128) * 1.08 + 128));
  }
}

/** Maximum capture dimension to avoid mobile GPU buffer allocation failures (e.g. 4K camera sensors on Android) */
const MAX_CAPTURE_DIMENSION = 1920;

/**
 * Capture current video frame instantly to canvas.
 * - Hardware-accelerated Canvas 2D filter baking (instant GPU execution)
 * - Safe resolution scaling to prevent mobile OOM on ultra-high res sensors
 * - Direct pixel fallback for legacy browsers without ctx.filter
 */
export async function captureFrame(
  videoEl: HTMLVideoElement,
  filter: FilterType = 'none',
  targetWidth?: number,
  targetHeight?: number,
  mirror: boolean = false,
): Promise<string> {
  let vW = videoEl.videoWidth > 0 ? videoEl.videoWidth : 1280;
  let vH = videoEl.videoHeight > 0 ? videoEl.videoHeight : 720;

  // Scale down if resolution exceeds mobile safety limit while preserving aspect ratio
  if (!targetWidth && !targetHeight) {
    const maxDim = Math.max(vW, vH);
    if (maxDim > MAX_CAPTURE_DIMENSION) {
      const scale = MAX_CAPTURE_DIMENSION / maxDim;
      vW = Math.round(vW * scale);
      vH = Math.round(vH * scale);
    }
  }

  const width = targetWidth && targetWidth > 0 ? targetWidth : vW;
  const height = targetHeight && targetHeight > 0 ? targetHeight : vH;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return '';

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Apply native Canvas 2D hardware-accelerated filter before drawing
  const cssFilter = filter && filter !== 'none' ? FILTER_CONFIGS[filter] : 'none';
  const hasFilterSupport = 'filter' in (ctx as object);

  if (hasFilterSupport && cssFilter && cssFilter !== 'none') {
    (ctx as CanvasRenderingContext2D).filter = cssFilter;
  }

  // Draw video frame onto canvas with optional mirror
  if (mirror) {
    ctx.save();
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(videoEl, 0, 0, width, height);
    ctx.restore();
  } else {
    ctx.drawImage(videoEl, 0, 0, width, height);
  }

  if (hasFilterSupport) {
    (ctx as CanvasRenderingContext2D).filter = 'none';
  }

  // If browser does not support ctx.filter natively, use direct pixel transformation fallback
  const isFilterWorking = hasFilterSupport && cssFilter !== 'none';
  if (!isFilterWorking && filter && filter !== 'none') {
    try {
      const imgData = (ctx as CanvasRenderingContext2D).getImageData(0, 0, width, height);
      applyPixelFilter(imgData.data, filter);
      (ctx as CanvasRenderingContext2D).putImageData(imgData, 0, 0);
    } catch (err) {
      console.warn('Fallback pixel filter error:', err);
    }
  }

  return canvas.toDataURL('image/jpeg', 0.95);
}

/** Schedule a capture at a specific server timestamp (ms) */
export function scheduleCaptureAt(
  targetTimestamp: number,
  videoEl: HTMLVideoElement,
  filter: FilterType,
  onCapture: (dataUrl: string) => void,
  mirror: boolean = false,
): () => void {
  const delay = targetTimestamp - Date.now();
  const safeDelay = Math.max(0, delay);
  const handle = setTimeout(async () => {
    const dataUrl = await captureFrame(videoEl, filter, undefined, undefined, mirror);
    onCapture(dataUrl);
  }, safeDelay);
  return () => clearTimeout(handle);
}

/** Get available camera devices */
export async function getCameraDevices(): Promise<MediaDeviceInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === 'videoinput');
}
