// Camera capture utilities

export type FilterType = 'none' | 'bw' | 'warm' | 'vivid' | 'cool';

const FILTER_CONFIGS: Record<FilterType, string> = {
  none: '',
  bw: 'grayscale(100%)',
  warm: 'sepia(40%) saturate(120%) brightness(105%)',
  vivid: 'saturate(180%) contrast(110%)',
  cool: 'hue-rotate(20deg) saturate(80%) brightness(105%)',
};

/** Apply a CSS filter string to a video element and capture to canvas (full camera frame without cropping) */
export function captureFrame(
  videoEl: HTMLVideoElement,
  filter: FilterType = 'none',
  targetWidth?: number,
  targetHeight?: number,
): string {
  // Use natural video dimensions by default for true 1:1 WYSIWYG
  const vW = videoEl.videoWidth > 0 ? videoEl.videoWidth : 1280;
  const vH = videoEl.videoHeight > 0 ? videoEl.videoHeight : 720;
  const width = targetWidth && targetWidth > 0 ? targetWidth : vW;
  const height = targetHeight && targetHeight > 0 ? targetHeight : vH;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  // Apply filter if specified and supported
  if (filter !== 'none' && FILTER_CONFIGS[filter]) {
    try {
      ctx.filter = FILTER_CONFIGS[filter];
    } catch (e) {
      // Ignore filter error if browser does not support ctx.filter
    }
  }

  try {
    ctx.drawImage(videoEl, 0, 0, width, height);
  } catch (err) {
    console.error('drawImage error on videoEl:', err);
  }

  return canvas.toDataURL('image/jpeg', 0.95);
}

/** Schedule a capture at a specific server timestamp (ms) */
export function scheduleCaptureAt(
  targetTimestamp: number,
  videoEl: HTMLVideoElement,
  filter: FilterType,
  onCapture: (dataUrl: string) => void,
): () => void {
  const delay = targetTimestamp - Date.now();
  const safeDelay = Math.max(0, delay);
  const handle = setTimeout(() => {
    const dataUrl = captureFrame(videoEl, filter);
    onCapture(dataUrl);
  }, safeDelay);
  return () => clearTimeout(handle);
}

/** Get available camera devices */
export async function getCameraDevices(): Promise<MediaDeviceInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === 'videoinput');
}

export { FILTER_CONFIGS };
