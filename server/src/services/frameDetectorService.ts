import sharp from 'sharp';

export interface DetectedCutoutBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FrameDetectionResult {
  width: number;
  height: number;
  cutoutBoxes: DetectedCutoutBox[];
  layoutType: string;
  category: '1x3' | '1x4' | '2x2' | '2x3' | 'custom';
  aspectRatio: number;
  detectedHolesCount: number;
  hasAlphaCutouts: boolean;
}

/**
 * Automatically analyze a PNG photobooth frame image:
 * - Detects transparent photo window cutout boxes (alpha < 32).
 * - Filters out outer borders and tiny decorative transparent artifacts.
 * - Scales coordinates back to original image dimensions.
 * - Determines layout classification (1x3, 1x4, 2x2, 2x3, or custom).
 */
export async function detectCutoutBoxes(imageBuffer: Buffer): Promise<FrameDetectionResult> {
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();

  const origWidth = metadata.width || 1200;
  const origHeight = metadata.height || 1800;
  const aspectRatio = origWidth / origHeight;

  // Analysis sampling resolution (fast processing in < 25ms while retaining pixel accuracy)
  const sampleWidth = Math.min(origWidth, 600);
  const sampleHeight = Math.max(10, Math.round((origHeight / origWidth) * sampleWidth));
  const scaleX = origWidth / sampleWidth;
  const scaleY = origHeight / sampleHeight;

  const { data } = await image
    .clone()
    .resize(sampleWidth, sampleHeight, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const totalPixels = sampleWidth * sampleHeight;
  let transparentPixelCount = 0;

  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 32) {
      transparentPixelCount++;
    }
  }

  const hasAlphaCutouts = transparentPixelCount > totalPixels * 0.02;
  const detectedBoxes: DetectedCutoutBox[] = [];

  if (hasAlphaCutouts) {
    const visited = new Uint8Array(totalPixels);
    const minHolePixels = totalPixels * 0.015; // At least 1.5% of total frame area

    for (let y = 0; y < sampleHeight; y++) {
      for (let x = 0; x < sampleWidth; x++) {
        const idx = y * sampleWidth + x;
        if (visited[idx] === 1) continue;

        const alpha = data[idx * 4 + 3];
        if (alpha >= 32) {
          visited[idx] = 1;
          continue;
        }

        // Flood Fill / BFS Connected Component
        let minX = x;
        let maxX = x;
        let minY = y;
        let maxY = y;
        let clusterPixelCount = 0;

        const queue: number[] = [x, y];
        visited[idx] = 1;
        let head = 0;

        while (head < queue.length) {
          const cx = queue[head++];
          const cy = queue[head++];
          clusterPixelCount++;

          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;

          // 4-directional neighbors
          const neighbors = [
            [cx + 1, cy],
            [cx - 1, cy],
            [cx, cy + 1],
            [cx, cy - 1],
          ];

          for (const [nx, ny] of neighbors) {
            if (nx >= 0 && nx < sampleWidth && ny >= 0 && ny < sampleHeight) {
              const nIdx = ny * sampleWidth + nx;
              if (visited[nIdx] === 0) {
                visited[nIdx] = 1;
                const nAlpha = data[nIdx * 4 + 3];
                if (nAlpha < 32) {
                  queue.push(nx, ny);
                }
              }
            }
          }
        }

        const boxW = maxX - minX + 1;
        const boxH = maxY - minY + 1;
        const boxArea = boxW * boxH;

        // Ignore outer canvas borders
        const touchesBorder = minX <= 3 || minY <= 3 || maxX >= sampleWidth - 4 || maxY >= sampleHeight - 4;
        if (touchesBorder) continue;

        // Minimum size check
        if (clusterPixelCount < minHolePixels || boxW < 24 || boxH < 24) continue;

        // Shape rectangular fill ratio
        const fillRatio = clusterPixelCount / boxArea;
        if (fillRatio < 0.65) continue;

        // Map coordinates back to original frame dimensions
        detectedBoxes.push({
          x: Math.round(minX * scaleX),
          y: Math.round(minY * scaleY),
          width: Math.round(boxW * scaleX),
          height: Math.round(boxH * scaleY),
        });
      }
    }
  }

  // Sort detected boxes logically (top-to-bottom, left-to-right)
  detectedBoxes.sort((a, b) => {
    // If on roughly the same horizontal row (within 10% height tolerance)
    if (Math.abs(a.y - b.y) < origHeight * 0.08) {
      return a.x - b.x;
    }
    return a.y - b.y;
  });

  // Smart fallback if no transparent cutouts detected (e.g. solid opaque PNG / JPEG)
  const finalBoxes: DetectedCutoutBox[] = detectedBoxes.length > 0 ? detectedBoxes : generateDefaultCutouts(origWidth, origHeight);

  // Layout categorization
  let category: '1x3' | '1x4' | '2x2' | '2x3' | 'custom' = 'custom';
  let layoutType = `custom_${finalBoxes.length}`;

  if (finalBoxes.length === 3) {
    category = '1x3';
    layoutType = '1x3';
  } else if (finalBoxes.length === 4) {
    if (origHeight / origWidth >= 1.6) {
      category = '1x4';
      layoutType = '1x4';
    } else {
      category = '2x2';
      layoutType = '2x2';
    }
  } else if (finalBoxes.length === 6) {
    category = '2x3';
    layoutType = '2x3';
  }

  return {
    width: origWidth,
    height: origHeight,
    cutoutBoxes: finalBoxes,
    layoutType,
    category,
    aspectRatio,
    detectedHolesCount: detectedBoxes.length,
    hasAlphaCutouts,
  };
}

/** Fallback cutout generator for frames without transparent alpha holes */
function generateDefaultCutouts(width: number, height: number): DetectedCutoutBox[] {
  const isTallStrip = height / width >= 1.8;

  if (isTallStrip) {
    // Standard 3-Cut Vertical Strip
    const boxW = Math.round(width * 0.86);
    const boxH = Math.round(height * 0.27);
    const startX = Math.round(width * 0.07);
    return [
      { x: startX, y: Math.round(height * 0.05), width: boxW, height: boxH },
      { x: startX, y: Math.round(height * 0.36), width: boxW, height: boxH },
      { x: startX, y: Math.round(height * 0.67), width: boxW, height: boxH },
    ];
  }

  // 2x2 Grid
  const colW = Math.round(width * 0.44);
  const rowH = Math.round(height * 0.40);
  const leftX = Math.round(width * 0.04);
  const rightX = Math.round(width * 0.52);
  const topY = Math.round(height * 0.06);
  const bottomY = Math.round(height * 0.50);

  return [
    { x: leftX, y: topY, width: colW, height: rowH },
    { x: rightX, y: topY, width: colW, height: rowH },
    { x: leftX, y: bottomY, width: colW, height: rowH },
    { x: rightX, y: bottomY, width: colW, height: rowH },
  ];
}
