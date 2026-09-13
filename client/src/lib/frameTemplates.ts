import { FrameTemplate, PairedShot } from '@/types';
import generatedFrames from './generatedFrames.json';

export interface CutoutBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExtendedFrameTemplate extends FrameTemplate {
  category?: '1x3' | '1x4' | '2x2' | '2x3' | 'custom';
  overlay_url?: string;
  frameWidth?: number;
  frameHeight?: number;
  cutoutBoxes?: CutoutBox[];
}

// All auto-calibrated real PNG frame templates
export const FRAME_TEMPLATES: ExtendedFrameTemplate[] = generatedFrames as ExtendedFrameTemplate[];


export interface FrameBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasLayoutConfig {
  width: number;
  height: number;
  leftBoxes: FrameBox[];
  rightBoxes: FrameBox[];
  overlayUrl?: string;
  isTwinStrip?: boolean;
  singleStripWidth?: number;
  singleStripHeight?: number;
  gap?: number;
}

export async function fetchAllFrameTemplates(): Promise<ExtendedFrameTemplate[]> {
  try {
    const res = await fetch('/api/frames');
    if (res.ok) {
      const data = await res.json();
      if (data?.frames && Array.isArray(data.frames) && data.frames.length > 0) {
        return data.frames as ExtendedFrameTemplate[];
      }
    }
  } catch (err) {
    console.warn('[FrameTemplates] Failed to fetch remote frames, using local built-ins:', err);
  }
  return FRAME_TEMPLATES;
}

export function getCanvasLayout(template: ExtendedFrameTemplate, isSolo = false): CanvasLayoutConfig {
  const overlayUrl = template.overlay_url || template.overlayUrl;
  const cat = template.category || (template.layout_type?.includes('1x3') ? '1x3' : template.layout_type?.includes('1x4') ? '1x4' : template.layout_type?.includes('2x3') ? '2x3' : '2x2');
  
  const fW = template.frameWidth || (cat === '1x3' || cat === '1x4' ? 600 : cat === '2x3' ? 1120 : 1180);
  const fH = template.frameHeight || (cat === '1x3' || cat === '1x4' ? 1800 : cat === '2x3' ? 1368 : 1750);
  const boxes = (template.cutoutBoxes && template.cutoutBoxes.length > 0) ? template.cutoutBoxes : [];

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
      overlayUrl,
      isTwinStrip: false,
      singleStripWidth: fW,
      singleStripHeight: fH,
      gap: 0,
    };
  }

  // ── 0. 1x3 (3-Cut Photostrip: 1 Column x 3 Rows) ──────────
  if (cat === '1x3' || template.layout_type === '1x3') {
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
      overlayUrl,
      isTwinStrip: false,
      singleStripWidth: singleW,
      singleStripHeight: singleH,
      gap: 0,
    };
  }

  // ── 1. 1x4 (4-Cut Photostrip: 1 Column x 4 Rows) ──────────
  if (cat === '1x4' || template.layout_type === 'duo_strips_4' || template.layout_type === 'strip4') {
    const singleW = fW;
    const singleH = fH;

    // Fallback boxes if frame had no detected cutouts
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
      overlayUrl,
      isTwinStrip: false,
      singleStripWidth: singleW,
      singleStripHeight: singleH,
      gap: 0,
    };
  }

  // ── 2. 2x3 (6-Cut Grid: 3 Rows x 2 Cols) ─────────────────────────
  if (cat === '2x3' || template.layout_type === 'duo_strips_3' || template.layout_type === 'strip3') {
    const canvasW = fW;
    const canvasH = fH;

    // Split 6 boxes into left column (User 1) and right column (User 2)
    let leftBoxes: FrameBox[] = [];
    let rightBoxes: FrameBox[] = [];

    if (boxes.length >= 6) {
      // Sort into 2 columns by X center
      const midX = canvasW / 2;
      leftBoxes = boxes.filter((b) => b.x + b.width / 2 < midX).slice(0, 3);
      rightBoxes = boxes.filter((b) => b.x + b.width / 2 >= midX).slice(0, 3);
    }

    if (leftBoxes.length < 3 || rightBoxes.length < 3) {
      // Fallback
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

    return { width: canvasW, height: canvasH, leftBoxes, rightBoxes, overlayUrl, isTwinStrip: false };
  }

  // ── 3. 2x2 (4-Cut Grid: 2 Rows x 2 Cols) ─────────────────────────
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

  return { width: canvasW, height: canvasH, leftBoxes, rightBoxes, overlayUrl, isTwinStrip: false };
}

export function resolveOrderedPhotoUrls(
  slots: PairedShot[],
  selectedOrder?: (number | string)[],
): { leftUrls: string[]; rightUrls: string[]; allUrls: string[] } {
  const leftUrls: string[] = [];
  const rightUrls: string[] = [];
  const allUrls: string[] = [];

  if (selectedOrder && selectedOrder.length > 0) {
    selectedOrder.forEach((item) => {
      if (typeof item === 'string' && item.includes('_')) {
        const [slotStr, side] = item.split('_');
        const slotIdx = parseInt(slotStr, 10);
        const slot = slots.find((s) => s.slotIndex === slotIdx);
        const url = side === 'left' ? slot?.leftPhotoUrl : slot?.rightPhotoUrl;
        if (url) {
          allUrls.push(url);
          if (side === 'left') leftUrls.push(url);
          else rightUrls.push(url);
        }
      } else if (typeof item === 'number') {
        const slot = slots.find((s) => s.slotIndex === item);
        if (slot?.leftPhotoUrl) {
          leftUrls.push(slot.leftPhotoUrl);
          allUrls.push(slot.leftPhotoUrl);
        }
        if (slot?.rightPhotoUrl) {
          rightUrls.push(slot.rightPhotoUrl);
          allUrls.push(slot.rightPhotoUrl);
        }
      }
    });
  }

  // Fallback if empty or fewer than needed
  if (allUrls.length === 0) {
    slots.forEach((s) => {
      if (s.leftPhotoUrl) {
        leftUrls.push(s.leftPhotoUrl);
        allUrls.push(s.leftPhotoUrl);
      }
      if (s.rightPhotoUrl) {
        rightUrls.push(s.rightPhotoUrl);
        allUrls.push(s.rightPhotoUrl);
      }
    });
  }

  return { leftUrls, rightUrls, allUrls };
}

/** Client-side canvas composite with pixel-perfect auto-crop and overlay rendering */
export async function compositePreview(
  canvas: HTMLCanvasElement,
  slots: PairedShot[],
  template: ExtendedFrameTemplate,
  captionText: string,
  accentColor: string,
  selectedOrder?: (number | string)[],
  photoOffsets?: Record<number | string, { x?: number; y?: number; scale?: number }>,
  isSolo = false,
): Promise<void> {
  const layout = getCanvasLayout(template, isSolo);
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext('2d')!;

  // 1. Clean background
  ctx.fillStyle = '#0f1016';
  ctx.fillRect(0, 0, layout.width, layout.height);

  const loadImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });

  const getOffset = (idx: number) => {
    if (!photoOffsets) return { x: 0, y: 0, scale: 1 };
    const off = Array.isArray(photoOffsets) ? photoOffsets[idx] : photoOffsets[idx] || photoOffsets[String(idx)];
    return {
      x: typeof off?.x === 'number' ? off.x : 0,
      y: typeof off?.y === 'number' ? off.y : 0,
      scale: typeof off?.scale === 'number' ? off.scale : 1,
    };
  };

  // 2. Draw Individual Photos into cutouts BEHIND the frame
  const { leftUrls, rightUrls, allUrls } = resolveOrderedPhotoUrls(slots, selectedOrder);

  const getSlotUrl = (idx: number): string | undefined => {
    if (selectedOrder && selectedOrder[idx]) {
      const item = selectedOrder[idx];
      if (typeof item === 'string' && item.includes('_')) {
        const [slotStr, side] = item.split('_');
        const slotIdx = parseInt(slotStr, 10);
        const slot = slots.find((s) => s.slotIndex === slotIdx);
        return side === 'left' ? slot?.leftPhotoUrl : slot?.rightPhotoUrl;
      }
    }
    return undefined;
  };

  if (layout.isTwinStrip) {
    // Left strip
    for (let i = 0; i < layout.leftBoxes.length; i++) {
      const box = layout.leftBoxes[i];
      const url = getSlotUrl(i) || leftUrls[i % Math.max(1, leftUrls.length)] || allUrls[i % Math.max(1, allUrls.length)];
      const off = getOffset(i);
      if (url) {
        try {
          const img = await loadImage(url);
          drawCoverImage(ctx, img, box.x, box.y, box.width, box.height, 4, off.x, off.y, off.scale);
        } catch (e) {
          fillPlaceholder(ctx, box, '#222');
        }
      } else {
        fillPlaceholder(ctx, box, '#1a1b24');
      }
    }

    // Right strip
    for (let i = 0; i < layout.rightBoxes.length; i++) {
      const box = layout.rightBoxes[i];
      const slotGlobalIdx = layout.leftBoxes.length + i;
      const url = getSlotUrl(slotGlobalIdx) || rightUrls[i % Math.max(1, rightUrls.length)] || allUrls[(i + 4) % Math.max(1, allUrls.length)] || allUrls[i % Math.max(1, allUrls.length)];
      const off = getOffset(slotGlobalIdx);
      if (url) {
        try {
          const img = await loadImage(url);
          drawCoverImage(ctx, img, box.x, box.y, box.width, box.height, 4, off.x, off.y, off.scale);
        } catch (e) {
          fillPlaceholder(ctx, box, '#222');
        }
      } else {
        fillPlaceholder(ctx, box, '#1a1b24');
      }
    }
  } else {
    // Grid (2x2 or 2x3)
    const allBoxes = [...layout.leftBoxes, ...layout.rightBoxes];
    for (let i = 0; i < allBoxes.length; i++) {
      const box = allBoxes[i];
      const url = getSlotUrl(i) || allUrls[i % Math.max(1, allUrls.length)];
      const off = getOffset(i);
      if (url) {
        try {
          const img = await loadImage(url);
          drawCoverImage(ctx, img, box.x, box.y, box.width, box.height, 4, off.x, off.y, off.scale);
        } catch (e) {
          fillPlaceholder(ctx, box, '#222');
        }
      } else {
        fillPlaceholder(ctx, box, '#1a1b24');
      }
    }
  }

  // 3. Draw Top PNG Overlay Layer
  if (layout.overlayUrl) {
    try {
      const overlayImg = await loadImage(layout.overlayUrl);

      if (layout.isTwinStrip && layout.singleStripWidth && layout.singleStripHeight) {
        const gap = layout.gap || 30;
        // Left Strip overlay
        ctx.drawImage(overlayImg, 0, 0, layout.singleStripWidth, layout.singleStripHeight);
        // Right Strip overlay
        ctx.drawImage(overlayImg, layout.singleStripWidth + gap, 0, layout.singleStripWidth, layout.singleStripHeight);
      } else {
        // Full single overlay
        ctx.drawImage(overlayImg, 0, 0, layout.width, layout.height);
      }
    } catch (e) {
      console.error('Failed to load PNG overlay:', layout.overlayUrl, e);
    }
  } else {
    // Vector frame decoration fallback
    drawDefaultBorders(ctx, layout, accentColor, captionText);
  }
}

function drawDefaultBorders(ctx: CanvasRenderingContext2D, layout: CanvasLayoutConfig, accentColor: string, captionText: string) {
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 3;

  [...layout.leftBoxes, ...layout.rightBoxes].forEach((box) => {
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

function fillPlaceholder(ctx: CanvasRenderingContext2D, box: FrameBox, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(box.x, box.y, box.width, box.height, 4);
  ctx.fill();
}

/** Center-Cover Auto-Crop: preserves natural aspect ratio and supports panning & scaling */
export function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  destX: number,
  destY: number,
  destW: number,
  destH: number,
  radius: number = 4,
  offsetX: number = 0,
  offsetY: number = 0,
  scale: number = 1.0,
): void {
  const imgW = img.naturalWidth || img.width;
  const imgH = img.naturalHeight || img.height;
  const imgRatio = imgW / imgH;
  const destRatio = destW / destH;

  const validScale = Math.max(0.5, Math.min(3.0, scale || 1.0));

  let sW: number, sH: number, sX: number, sY: number;

  if (imgRatio > destRatio) {
    // Image is wider than box -> crop left/right edges
    sH = imgH / validScale;
    sW = (imgH * destRatio) / validScale;
    const maxShiftX = (imgW - sW) / 2;
    sX = (imgW - sW) / 2 + ((offsetX || 0) / 50) * Math.max(0, maxShiftX);
    sY = (imgH - sH) / 2 + ((offsetY || 0) / 50) * Math.max(0, (imgH - sH) / 2);
  } else {
    // Image is taller than box -> crop top/bottom edges
    sW = imgW / validScale;
    sH = (imgW / destRatio) / validScale;
    const maxShiftY = (imgH - sH) / 2;
    sX = (imgW - sW) / 2 + ((offsetX || 0) / 50) * Math.max(0, (imgW - sW) / 2);
    sY = (imgH - sH) / 2 + ((offsetY || 0) / 50) * Math.max(0, maxShiftY);
  }

  sX = Math.max(0, Math.min(imgW - sW, sX));
  sY = Math.max(0, Math.min(imgH - sH, sY));
  sW = Math.max(1, Math.min(imgW - sX, sW));
  sH = Math.max(1, Math.min(imgH - sY, sH));

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(destX, destY, destW, destH, radius);
  ctx.clip();
  ctx.drawImage(img, sX, sY, sW, sH, destX, destY, destW, destH);
  ctx.restore();
}

