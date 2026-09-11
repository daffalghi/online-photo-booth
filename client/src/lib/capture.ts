// Camera capture utilities

export type FilterType = 'none' | 'bw' | 'warm' | 'vivid' | 'cool';

const FILTER_CONFIGS: Record<FilterType, string> = {
  none: '',
  bw: 'grayscale(100%)',
  warm: 'sepia(40%) saturate(120%) brightness(105%)',
  vivid: 'saturate(180%) contrast(110%)',
  cool: 'hue-rotate(20deg) saturate(80%) brightness(105%)',
};

interface PhotoCapabilities {
  imageWidth?: { max?: number; min?: number };
  imageHeight?: { max?: number; min?: number };
}

interface PhotoSettings {
  imageWidth?: number;
  imageHeight?: number;
}

interface NativeImageCapture {
  getPhotoCapabilities?: () => Promise<PhotoCapabilities>;
  takePhoto: (settings?: PhotoSettings) => Promise<Blob>;
}

type ImageCaptureConstructor = new (track: MediaStreamTrack) => NativeImageCapture;

declare global {
  interface Window {
    ImageCapture?: ImageCaptureConstructor;
  }
}

/** Apply a CSS filter string to a video element and capture to canvas (full camera frame without cropping) */
export async function captureFrame(
  videoEl: HTMLVideoElement,
  filter: FilterType = 'none',
  targetWidth?: number,
  targetHeight?: number,
): Promise<string> {
  // If browser supports ImageCapture API on the video track, capture raw native sensor still!
  const stream = videoEl.srcObject as MediaStream | null;
  const track = stream?.getVideoTracks()[0];

  if (track && typeof window.ImageCapture !== 'undefined') {
    try {
      const imageCapture = new window.ImageCapture(track);
      const photoSettings: PhotoSettings = {};
      if (imageCapture.getPhotoCapabilities) {
        try {
          const caps = await imageCapture.getPhotoCapabilities();
          if (caps.imageWidth?.max && caps.imageHeight?.max) {
            photoSettings.imageWidth = caps.imageWidth.max;
            photoSettings.imageHeight = caps.imageHeight.max;
          }
        } catch (_) {}
      }
      const blob: Blob = await imageCapture.takePhoto(photoSettings);

      // If no filter or resize is needed, return the pristine raw sensor photo immediately
      if (filter === 'none' && !targetWidth && !targetHeight) {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }

      // If filter or resize is requested, render high-res sensor image to canvas with filter
      const img = new Image();
      const objectUrl = URL.createObjectURL(blob);
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = objectUrl;
      });
      URL.revokeObjectURL(objectUrl);

      const cW = targetWidth && targetWidth > 0 ? targetWidth : img.naturalWidth;
      const cH = targetHeight && targetHeight > 0 ? targetHeight : img.naturalHeight;
      const canvas = document.createElement('canvas');
      canvas.width = cW;
      canvas.height = cH;
      const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: false })!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      if (filter !== 'none' && FILTER_CONFIGS[filter]) {
        try {
          ctx.filter = FILTER_CONFIGS[filter];
        } catch (_) {}
      }

      ctx.drawImage(img, 0, 0, cW, cH);
      return canvas.toDataURL('image/jpeg', 0.99);
    } catch (e) {
      // Fallback to high-resolution canvas capture if native takePhoto is unsupported or fails
    }
  }

  // Use natural video dimensions by default for true 1:1 WYSIWYG HD capture
  const vW = videoEl.videoWidth > 0 ? videoEl.videoWidth : 1920;
  const vH = videoEl.videoHeight > 0 ? videoEl.videoHeight : 1080;
  const width = targetWidth && targetWidth > 0 ? targetWidth : vW;
  const height = targetHeight && targetHeight > 0 ? targetHeight : vH;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: false })!;

  // High quality hardware-accelerated rendering pipeline
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

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

  // 0.99 ultra high-fidelity JPEG avoids compression artifacts while keeping uploads fast
  return canvas.toDataURL('image/jpeg', 0.99);
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
  const handle = setTimeout(async () => {
    const dataUrl = await captureFrame(videoEl, filter);
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
