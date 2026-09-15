import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { Photo, FrameTemplate, CutoutBox, PhotoCropOffset } from '../types';
import generatedFrames from './generatedFrames.json';

const UPLOADS_DIR = path.join(__dirname, '../../uploads');
const RENDERS_DIR = path.join(__dirname, '../../renders');
const CLIENT_PUBLIC_DIR = path.join(__dirname, '../../../client/public');
const DEFAULT_ACCENT_COLOR = '#ff5e97';
const DEFAULT_CANVAS_BG = { r: 15, g: 16, b: 22 };

// Ensure directories exist
[UPLOADS_DIR, RENDERS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

interface FrameBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LayoutConfig {
  width: number;
  height: number;
  leftBoxes: FrameBox[];
  rightBoxes: FrameBox[];
  isTwinStrip?: boolean;
  singleStripWidth?: number;
  singleStripHeight?: number;
  gap?: number;
  layoutType: string;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 255, g: 94, b: 151 };
}

function getFrameMetadata(template: FrameTemplate): { frameWidth?: number; frameHeight?: number; cutoutBoxes: CutoutBox[] } {
  let frameWidth = template.frameWidth;
  let frameHeight = template.frameHeight;
  let cutoutBoxes: CutoutBox[] = template.cutoutBoxes || [];

  const match = generatedFrames.find((g) => g.id === template.id);
  if (match) {
    frameWidth = match.frameWidth;
    frameHeight = match.frameHeight;
    cutoutBoxes = match.cutoutBoxes || [];
  }

  return { frameWidth, frameHeight, cutoutBoxes };
}

function getLayoutConfig(template: FrameTemplate, isSolo = false): LayoutConfig {
  const layoutIdentifier = template.layoutType || template.layout_type || '';
  const cat = template.category || (layoutIdentifier.includes('1x3') ? '1x3' : layoutIdentifier.includes('1x4') ? '1x4' : layoutIdentifier.includes('2x3') ? '2x3' : '2x2');
  const { frameWidth, frameHeight, cutoutBoxes } = getFrameMetadata(template);

  const fW = frameWidth || (cat === '1x3' || cat === '1x4' ? 600 : cat === '2x3' ? 1120 : 1180);
  const fH = frameHeight || (cat === '1x3' || cat === '1x4' ? 1800 : cat === '2x3' ? 1368 : 1750);
  const boxes = cutoutBoxes && cutoutBoxes.length > 0 ? cutoutBoxes : [];

  // Custom user-uploaded frames with detected cutout holes
  if (cat === 'custom' || template.id.startsWith('custom_')) {
    const leftBoxes: FrameBox[] = boxes.map((b) => ({
      x: b.x,
      y: b.y,
      width: b.width,
      height: b.height,
    }));

    return {
      width: fW,
      height: fH,
      leftBoxes,
      rightBoxes: [],
      isTwinStrip: false,
      singleStripWidth: fW,
      singleStripHeight: fH,
      gap: 0,
      layoutType: template.layoutType || 'custom',
    };
  }

  if (cat === '1x3') {
    const singleW = fW;
    const singleH = fH;

    const fallbackBoxes: CutoutBox[] = [
      { x: singleW * 0.07, y: singleH * 0.04, width: singleW * 0.86, height: singleH * 0.28 },
      { x: singleW * 0.07, y: singleH * 0.36, width: singleW * 0.86, height: singleH * 0.28 },
      { x: singleW * 0.07, y: singleH * 0.68, width: singleW * 0.86, height: singleH * 0.28 },
    ];
    const actualBoxes = boxes.length >= 3 ? boxes : fallbackBoxes;

    const leftBoxes: FrameBox[] = actualBoxes.slice(0, 3).map((b) => ({
      x: b.x,
      y: b.y,
      width: b.width,
      height: b.height,
    }));

    return {
      width: singleW,
      height: singleH,
      leftBoxes,
      rightBoxes: [],
      isTwinStrip: false,
      singleStripWidth: singleW,
      singleStripHeight: singleH,
      gap: 0,
      layoutType: '1x3',
    };
  }

  if (cat === '1x4') {
    const singleW = fW;
    const singleH = fH;

    const fallbackBoxes: CutoutBox[] = [
      { x: singleW * 0.065, y: singleH * 0.028, width: singleW * 0.87, height: singleH * 0.218 },
      { x: singleW * 0.065, y: singleH * 0.252, width: singleW * 0.87, height: singleH * 0.218 },
      { x: singleW * 0.065, y: singleH * 0.476, width: singleW * 0.87, height: singleH * 0.218 },
      { x: singleW * 0.065, y: singleH * 0.700, width: singleW * 0.87, height: singleH * 0.218 },
    ];
    const actualBoxes = boxes.length >= 4 ? boxes : fallbackBoxes;

    const leftBoxes: FrameBox[] = actualBoxes.slice(0, 4).map((b) => ({
      x: b.x,
      y: b.y,
      width: b.width,
      height: b.height,
    }));

    return {
      width: singleW,
      height: singleH,
      leftBoxes,
      rightBoxes: [],
      isTwinStrip: false,
      singleStripWidth: singleW,
      singleStripHeight: singleH,
      gap: 0,
      layoutType: '1x4',
    };
  }

  if (cat === '2x3') {
    const canvasW = fW;
    const canvasH = fH;

    let leftBoxes: FrameBox[] = [];
    let rightBoxes: FrameBox[] = [];

    if (boxes.length >= 6) {
      const midX = canvasW / 2;
      leftBoxes = boxes.filter((b) => b.x + b.width / 2 < midX).slice(0, 3);
      rightBoxes = boxes.filter((b) => b.x + b.width / 2 >= midX).slice(0, 3);
    }

    if (leftBoxes.length < 3 || rightBoxes.length < 3) {
      leftBoxes = [
        { x: canvasW * 0.024, y: canvasH * 0.020, width: canvasW * 0.464, height: canvasH * 0.313 },
        { x: canvasW * 0.024, y: canvasH * 0.333, width: canvasW * 0.464, height: canvasH * 0.313 },
        { x: canvasW * 0.024, y: canvasH * 0.648, width: canvasW * 0.464, height: canvasH * 0.260 },
      ];
      rightBoxes = [
        { x: canvasW * 0.511, y: canvasH * 0.020, width: canvasW * 0.464, height: canvasH * 0.313 },
        { x: canvasW * 0.511, y: canvasH * 0.333, width: canvasW * 0.464, height: canvasH * 0.313 },
        { x: canvasW * 0.511, y: canvasH * 0.648, width: canvasW * 0.464, height: canvasH * 0.260 },
      ];
    }

    return { width: canvasW, height: canvasH, leftBoxes, rightBoxes, isTwinStrip: false, layoutType: '2x3' };
  }

  // 2x2
  const canvasW = fW;
  const canvasH = fH;

  let leftBoxes: FrameBox[] = [];
  let rightBoxes: FrameBox[] = [];

  if (boxes.length >= 4) {
    const midX = canvasW / 2;
    leftBoxes = boxes.filter((b) => b.x + b.width / 2 < midX).slice(0, 2);
    rightBoxes = boxes.filter((b) => b.x + b.width / 2 >= midX).slice(0, 2);
  }

  if (leftBoxes.length < 2 || rightBoxes.length < 2) {
    leftBoxes = [
      { x: canvasW * 0.039, y: canvasH * 0.050, width: canvasW * 0.440, height: canvasH * 0.396 },
      { x: canvasW * 0.039, y: canvasH * 0.547, width: canvasW * 0.440, height: canvasH * 0.396 },
    ];
    rightBoxes = [
      { x: canvasW * 0.520, y: canvasH * 0.050, width: canvasW * 0.440, height: canvasH * 0.396 },
      { x: canvasW * 0.520, y: canvasH * 0.547, width: canvasW * 0.440, height: canvasH * 0.396 },
    ];
  }

  return { width: canvasW, height: canvasH, leftBoxes, rightBoxes, isTwinStrip: false, layoutType: '2x2' };
}

async function extractAndResizePhoto(
  filePath: string,
  boxWidth: number,
  boxHeight: number,
  offsetX: number = 0,
  offsetY: number = 0,
  scale: number = 1,
): Promise<Buffer> {
  const metadata = await sharp(filePath).metadata();
  const imgW = metadata.width || 640;
  const imgH = metadata.height || 480;
  const imgRatio = imgW / imgH;
  const targetRatio = boxWidth / boxHeight;

  let sW = imgW;
  let sH = imgH;
  let sX = 0;
  let sY = 0;
  const sc = Math.max(0.5, scale || 1);

  if (imgRatio > targetRatio) {
    sW = Math.round((imgH * targetRatio) / sc);
    sH = Math.round(imgH / sc);
    const maxShiftX = (imgW - sW) / 2;
    sX = Math.round((imgW - sW) / 2 + (offsetX / 50) * maxShiftX);
    sY = Math.round((imgH - sH) / 2 + (offsetY / 50) * ((imgH - sH) / 2));
  } else {
    sW = Math.round(imgW / sc);
    sH = Math.round((imgW / targetRatio) / sc);
    const maxShiftY = (imgH - sH) / 2;
    sX = Math.round((imgW - sW) / 2 + (offsetX / 50) * ((imgW - sW) / 2));
    sY = Math.round((imgH - sH) / 2 + (offsetY / 50) * maxShiftY);
  }

  sX = Math.max(0, Math.min(imgW - sW, sX));
  sY = Math.max(0, Math.min(imgH - sH, sY));
  sW = Math.max(1, Math.min(imgW - sX, sW));
  sH = Math.max(1, Math.min(imgH - sY, sH));

  return sharp(filePath)
    .extract({ left: sX, top: sY, width: sW, height: sH })
    .resize(Math.round(boxWidth), Math.round(boxHeight), {
      kernel: sharp.kernel.lanczos3,
    })
    .png({ quality: 100 })
    .toBuffer();
}

export async function compositePhotos(
  roomId: string,
  photos: Photo[],
  template: FrameTemplate,
  captionText: string,
  accentColor: string,
  assignedPhotoIds?: string[],
  photoOffsets?: Record<string | number, PhotoCropOffset> | PhotoCropOffset[],
  isSolo = false,
): Promise<string> {
  const sortedPhotos = [...photos].sort((a, b) => a.slotIndex - b.slotIndex);
  const leftPhotos = sortedPhotos.filter((p) => p.side === 'left');
  const rightPhotos = sortedPhotos.filter((p) => p.side === 'right');
  const allPhotos = sortedPhotos;

  const findPhoto = (idOrKey?: string): Photo | undefined => {
    if (!idOrKey) return undefined;
    const parts = idOrKey.split('_');
    if (parts.length === 2 && !isNaN(Number(parts[0]))) {
      const slotIdx = Number(parts[0]);
      const side = parts[1] as 'left' | 'right';
      const found = photos.find((p) => p.slotIndex === slotIdx && p.side === side);
      if (found) return found;
    }
    const byId = photos.find((p) => p.id === idOrKey);
    if (byId) return byId;
    return photos.find((p) => p.storageKey === idOrKey);
  };

  const getOffset = (idx: number): { x: number; y: number; scale: number } => {
    if (!photoOffsets) return { x: 0, y: 0, scale: 1 };
    const off = Array.isArray(photoOffsets)
      ? photoOffsets[idx]
      : (photoOffsets as Record<string | number, PhotoCropOffset>)[idx] || (photoOffsets as Record<string | number, PhotoCropOffset>)[String(idx)];
    return {
      x: typeof off?.x === 'number' ? off.x : 0,
      y: typeof off?.y === 'number' ? off.y : 0,
      scale: typeof off?.scale === 'number' ? off.scale : 1,
    };
  };

  const layout = getLayoutConfig(template, isSolo);
  const effectiveAccent = accentColor || template.accentColor || template.accent_color || DEFAULT_ACCENT_COLOR;
  const rgb = hexToRgb(effectiveAccent);

  // Base canvas (Behind all photos)
  const composite = sharp({
    create: {
      width: layout.width,
      height: layout.height,
      channels: 3,
      background: DEFAULT_CANVAS_BG,
    },
  });

  const composites: sharp.OverlayOptions[] = [];

  // Draw individual photos into cutouts BEHIND the frame
  if (layout.isTwinStrip) {
    // Left strip (boxes 0..3)
    for (let i = 0; i < layout.leftBoxes.length; i++) {
      const explicitId = assignedPhotoIds ? assignedPhotoIds[i] : undefined;
      const p = findPhoto(explicitId) || leftPhotos[i % Math.max(1, leftPhotos.length)] || allPhotos[i % Math.max(1, allPhotos.length)];
      const box = layout.leftBoxes[i];
      const offset = getOffset(i);
      if (p && box) {
        const fp = path.join(UPLOADS_DIR, p.storageKey);
        if (fs.existsSync(fp)) {
          try {
            const buf = await extractAndResizePhoto(fp, box.width, box.height, offset.x, offset.y, offset.scale);
            composites.push({ input: buf, top: Math.round(box.y), left: Math.round(box.x) });
          } catch (e) {
            console.error('Error drawing photo:', e);
          }
        }
      }
    }

    // Right strip (boxes 4..7 or paired fallback)
    for (let i = 0; i < layout.rightBoxes.length; i++) {
      const slotGlobalIdx = layout.leftBoxes.length + i;
      const explicitId = assignedPhotoIds ? (assignedPhotoIds[slotGlobalIdx] || assignedPhotoIds[i]) : undefined;
      const p = findPhoto(explicitId) || rightPhotos[i % Math.max(1, rightPhotos.length)] || allPhotos[(i + 4) % Math.max(1, allPhotos.length)] || allPhotos[i % Math.max(1, allPhotos.length)];
      const box = layout.rightBoxes[i];
      const offset = getOffset(slotGlobalIdx);
      if (p && box) {
        const fp = path.join(UPLOADS_DIR, p.storageKey);
        if (fs.existsSync(fp)) {
          try {
            const buf = await extractAndResizePhoto(fp, box.width, box.height, offset.x, offset.y, offset.scale);
            composites.push({ input: buf, top: Math.round(box.y), left: Math.round(box.x) });
          } catch (e) {
            console.error('Error drawing photo:', e);
          }
        }
      }
    }
  } else {
    // Grid (2x2 or 2x3)
    const allBoxes = [...layout.leftBoxes, ...layout.rightBoxes];
    for (let i = 0; i < allBoxes.length; i++) {
      const explicitId = assignedPhotoIds ? assignedPhotoIds[i] : undefined;
      const p = findPhoto(explicitId) || allPhotos[i % Math.max(1, allPhotos.length)];
      const box = allBoxes[i];
      const offset = getOffset(i);
      if (p && box) {
        const fp = path.join(UPLOADS_DIR, p.storageKey);
        if (fs.existsSync(fp)) {
          try {
            const buf = await extractAndResizePhoto(fp, box.width, box.height, offset.x, offset.y, offset.scale);
            composites.push({ input: buf, top: Math.round(box.y), left: Math.round(box.x) });
          } catch (e) {
            console.error('Error drawing photo:', e);
          }
        }
      }
    }
  }

  // Check for PNG Overlay
  let overlayFilePath: string | null = null;
  const overlayUrl = template.overlayUrl || template.overlay_url;
  if (overlayUrl) {
    const rel = overlayUrl.startsWith('/') ? overlayUrl.slice(1) : overlayUrl;
    const candidates = [
      path.join(__dirname, '../../', decodeURIComponent(rel)),
      path.join(CLIENT_PUBLIC_DIR, decodeURIComponent(rel)),
      path.join(UPLOADS_DIR, 'frames', path.basename(decodeURIComponent(rel))),
    ];
    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        overlayFilePath = cand;
        break;
      }
      // Alternate extension check (.webp <-> .png)
      const parsed = path.parse(cand);
      const altExt = parsed.ext === '.png' ? '.webp' : '.png';
      const altCand = path.join(parsed.dir, parsed.name + altExt);
      if (fs.existsSync(altCand)) {
        overlayFilePath = altCand;
        break;
      }
    }
  }

  if (overlayFilePath && fs.existsSync(overlayFilePath)) {
    try {
      if (layout.isTwinStrip && layout.singleStripWidth && layout.singleStripHeight) {
        const gap = layout.gap || 30;
        const overlayBuf = await sharp(overlayFilePath)
          .resize(Math.round(layout.singleStripWidth), Math.round(layout.singleStripHeight), { fit: 'fill' })
          .png()
          .toBuffer();

        // Left strip overlay
        composites.push({ input: overlayBuf, top: 0, left: 0 });
        // Right strip overlay
        composites.push({ input: overlayBuf, top: 0, left: layout.singleStripWidth + gap });
      } else {
        const overlayBuf = await sharp(overlayFilePath)
          .resize(layout.width, layout.height, { fit: 'fill' })
          .png()
          .toBuffer();
        composites.push({ input: overlayBuf, top: 0, left: 0 });
      }
    } catch (e) {
      console.error('Error applying PNG overlay in composite:', e);
    }
  } else {
    // Vector frame decoration fallback
    const headerSvg = `
      <svg width="${layout.width}" height="${layout.height}" xmlns="http://www.w3.org/2000/svg">
        <text x="${layout.width / 2}" y="32" font-family="sans-serif" font-size="16" font-weight="bold" fill="rgb(${rgb.r},${rgb.g},${rgb.b})" text-anchor="middle">SNAPSYNC PHOTOBOOTH</text>
        <text x="${layout.width / 2}" y="${layout.height - 15}" font-family="sans-serif" font-size="12" fill="rgba(255,255,255,0.7)" text-anchor="middle">${captionText || 'MEMORIES'}</text>
      </svg>
    `;
    composites.push({ input: Buffer.from(headerSvg), top: 0, left: 0 });
  }

  // Render output
  const outputKey = `render_${roomId}_${Date.now()}.png`;
  const outputPath = path.join(RENDERS_DIR, outputKey);

  await composite.composite(composites).png({ quality: 100, compressionLevel: 6 }).toFile(outputPath);
  return outputKey;
}


export function getUploadPath(storageKey: string): string {
  return path.join(UPLOADS_DIR, storageKey);
}

export function getRenderPath(outputKey: string): string {
  return path.join(RENDERS_DIR, outputKey);
}

export { UPLOADS_DIR, RENDERS_DIR };
