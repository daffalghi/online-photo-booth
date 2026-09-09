const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const FRAMES_ROOT = path.join(__dirname, '../../../client/public/frames');
const OUTPUT_CLIENT = path.join(__dirname, '../../../client/src/lib/generatedFrames.json');
const OUTPUT_SERVER = path.join(__dirname, './generatedFrames.json');

const CATEGORIES = ['1x3', '1x4', '2x2', '2x3'];

const GRADIENTS = [
  'linear-gradient(135deg, #f093fb, #f5576c)',
  'linear-gradient(135deg, #5ee7df, #b490ca)',
  'linear-gradient(135deg, #a18cd1, #fbc2eb)',
  'linear-gradient(135deg, #ff9a9e, #fecfef)',
  'linear-gradient(135deg, #84fab0, #8fd3f4)',
  'linear-gradient(135deg, #cfd9df, #e2ebf0)',
  'linear-gradient(135deg, #fccb90, #d57eeb)',
];

const ACCENTS = ['#ff5e97', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#3b82f6'];

async function detectHighPrecisionCutouts(imagePath, targetSlots, category) {
  const image = sharp(imagePath);
  const metadata = await image.metadata();
  const width = metadata.width;
  const height = metadata.height;

  // High precision scan resolution (600px width maintains high fidelity)
  const scanWidth = 600;
  const scanHeight = Math.round((height / width) * 600);

  const { data, info } = await image
    .resize(scanWidth, scanHeight, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  const alphaThreshold = 140; // transparent or semi-transparent window

  const isTransparent = (x, y) => {
    if (x < 0 || x >= scanWidth || y < 0 || y >= scanHeight) return false;
    const idx = (y * scanWidth + x) * channels;
    if (channels === 4) {
      return data[idx + 3] < alphaThreshold;
    }
    return false;
  };

  const visited = new Uint8Array(scanWidth * scanHeight);
  const components = [];

  for (let y = 0; y < scanHeight; y++) {
    for (let x = 0; x < scanWidth; x++) {
      const idx = y * scanWidth + x;
      if (visited[idx] || !isTransparent(x, y)) continue;

      let minX = x, maxX = x, minY = y, maxY = y;
      let pixelCount = 0;

      const queue = [x, y];
      visited[idx] = 1;

      while (queue.length > 0) {
        const qy = queue.pop();
        const qx = queue.pop();
        pixelCount++;

        if (qx < minX) minX = qx;
        if (qx > maxX) maxX = qx;
        if (qy < minY) minY = qy;
        if (qy > maxY) maxY = qy;

        const neighbors = [
          [qx + 1, qy],
          [qx - 1, qy],
          [qx, qy + 1],
          [qx, qy - 1],
        ];

        for (const [nx, ny] of neighbors) {
          if (nx >= 0 && nx < scanWidth && ny >= 0 && ny < scanHeight) {
            const nIdx = ny * scanWidth + nx;
            if (!visited[nIdx] && isTransparent(nx, ny)) {
              visited[nIdx] = 1;
              queue.push(nx, ny);
            }
          }
        }
      }

      const boxW = maxX - minX + 1;
      const boxH = maxY - minY + 1;
      // Filter out tiny transparency specks (< 2% of frame dimension)
      if (boxW >= scanWidth * 0.08 && boxH >= scanHeight * 0.04 && pixelCount > 400) {
        components.push({
          minX, maxX, minY, maxY,
          boxW, boxH,
          pixelCount,
        });
      }
    }
  }

  // Sort components by pixel count (area) descending
  components.sort((a, b) => b.pixelCount - a.pixelCount);

  // Take top `targetSlots` largest transparent windows
  let selected = components.slice(0, targetSlots);

  // If fewer than targetSlots detected, use geometric fallback
  if (selected.length < targetSlots) {
    return {
      width,
      height,
      boxes: getFallbackBoxes(category, width, height),
      usedFallback: true,
    };
  }

  // Sort selected windows geographically
  if (category === '1x3' || category === '1x4') {
    // Vertical photostrip: sort strictly top-to-bottom
    selected.sort((a, b) => a.minY - b.minY);
  } else if (category === '2x2') {
    // 2x2 Grid: sort by Y rows, then X columns
    const midY = scanHeight / 2;
    const topRow = selected.filter((s) => (s.minY + s.maxY) / 2 < midY).sort((a, b) => a.minX - b.minX);
    const bottomRow = selected.filter((s) => (s.minY + s.maxY) / 2 >= midY).sort((a, b) => a.minX - b.minX);
    selected = [...topRow, ...bottomRow];
  } else if (category === '2x3') {
    // 2x3 Grid: sort by 3 vertical rows
    const rowH = scanHeight / 3;
    const row1 = selected.filter((s) => (s.minY + s.maxY) / 2 < rowH).sort((a, b) => a.minX - b.minX);
    const row2 = selected.filter((s) => (s.minY + s.maxY) / 2 >= rowH && (s.minY + s.maxY) / 2 < rowH * 2).sort((a, b) => a.minX - b.minX);
    const row3 = selected.filter((s) => (s.minY + s.maxY) / 2 >= rowH * 2).sort((a, b) => a.minX - b.minX);
    selected = [...row1, ...row2, ...row3];
  }

  const scaleX = width / scanWidth;
  const scaleY = height / scanHeight;

  // Add 1.5% bleed outwards so the photo goes cleanly under the frame border (NO black gaps!)
  const bleedX = Math.round(width * 0.015);
  const bleedY = Math.round(height * 0.012);

  const boxes = selected.map((s) => {
    const rawX = Math.round(s.minX * scaleX);
    const rawY = Math.round(s.minY * scaleY);
    const rawW = Math.round(s.boxW * scaleX);
    const rawH = Math.round(s.boxH * scaleY);

    const x = Math.max(0, rawX - bleedX);
    const y = Math.max(0, rawY - bleedY);
    const w = Math.min(width - x, rawW + bleedX * 2);
    const h = Math.min(height - y, rawH + bleedY * 2);

    return { x, y, width: w, height: h };
  });

  return { width, height, boxes, usedFallback: false };
}

function getFallbackBoxes(category, width, height) {
  const bleedX = Math.round(width * 0.015);
  const bleedY = Math.round(height * 0.012);

  if (category === '1x3') {
    const boxH = height * 0.28;
    const boxW = width * 0.86;
    const padX = width * 0.07;
    const gap = height * 0.035;
    const startY = height * 0.04;
    return [
      { x: Math.max(0, Math.round(padX) - bleedX), y: Math.max(0, Math.round(startY) - bleedY), width: Math.round(boxW) + bleedX * 2, height: Math.round(boxH) + bleedY * 2 },
      { x: Math.max(0, Math.round(padX) - bleedX), y: Math.max(0, Math.round(startY + boxH + gap) - bleedY), width: Math.round(boxW) + bleedX * 2, height: Math.round(boxH) + bleedY * 2 },
      { x: Math.max(0, Math.round(padX) - bleedX), y: Math.max(0, Math.round(startY + (boxH + gap) * 2) - bleedY), width: Math.round(boxW) + bleedX * 2, height: Math.round(boxH) + bleedY * 2 },
    ];
  }
  if (category === '1x4') {
    const boxH = height * 0.218;
    const boxW = width * 0.87;
    const padX = width * 0.065;
    return [
      { x: Math.max(0, Math.round(padX) - bleedX), y: Math.max(0, Math.round(height * 0.028) - bleedY), width: Math.round(boxW) + bleedX * 2, height: Math.round(boxH) + bleedY * 2 },
      { x: Math.max(0, Math.round(padX) - bleedX), y: Math.max(0, Math.round(height * 0.252) - bleedY), width: Math.round(boxW) + bleedX * 2, height: Math.round(boxH) + bleedY * 2 },
      { x: Math.max(0, Math.round(padX) - bleedX), y: Math.max(0, Math.round(height * 0.476) - bleedY), width: Math.round(boxW) + bleedX * 2, height: Math.round(boxH) + bleedY * 2 },
      { x: Math.max(0, Math.round(padX) - bleedX), y: Math.max(0, Math.round(height * 0.700) - bleedY), width: Math.round(boxW) + bleedX * 2, height: Math.round(boxH) + bleedY * 2 },
    ];
  }
  if (category === '2x2') {
    const w = width * 0.44;
    const h = height * 0.396;
    return [
      { x: Math.max(0, Math.round(width * 0.039) - bleedX), y: Math.max(0, Math.round(height * 0.05) - bleedY), width: Math.round(w) + bleedX * 2, height: Math.round(h) + bleedY * 2 },
      { x: Math.max(0, Math.round(width * 0.520) - bleedX), y: Math.max(0, Math.round(height * 0.05) - bleedY), width: Math.round(w) + bleedX * 2, height: Math.round(h) + bleedY * 2 },
      { x: Math.max(0, Math.round(width * 0.039) - bleedX), y: Math.max(0, Math.round(height * 0.547) - bleedY), width: Math.round(w) + bleedX * 2, height: Math.round(h) + bleedY * 2 },
      { x: Math.max(0, Math.round(width * 0.520) - bleedX), y: Math.max(0, Math.round(height * 0.547) - bleedY), width: Math.round(w) + bleedX * 2, height: Math.round(h) + bleedY * 2 },
    ];
  }
  if (category === '2x3') {
    const w = width * 0.464;
    const h1 = height * 0.313;
    const h3 = height * 0.260;
    return [
      { x: Math.max(0, Math.round(width * 0.024) - bleedX), y: Math.max(0, Math.round(height * 0.02) - bleedY), width: Math.round(w) + bleedX * 2, height: Math.round(h1) + bleedY * 2 },
      { x: Math.max(0, Math.round(width * 0.511) - bleedX), y: Math.max(0, Math.round(height * 0.02) - bleedY), width: Math.round(w) + bleedX * 2, height: Math.round(h1) + bleedY * 2 },
      { x: Math.max(0, Math.round(width * 0.024) - bleedX), y: Math.max(0, Math.round(height * 0.333) - bleedY), width: Math.round(w) + bleedX * 2, height: Math.round(h1) + bleedY * 2 },
      { x: Math.max(0, Math.round(width * 0.511) - bleedX), y: Math.max(0, Math.round(height * 0.333) - bleedY), width: Math.round(w) + bleedX * 2, height: Math.round(h1) + bleedY * 2 },
      { x: Math.max(0, Math.round(width * 0.024) - bleedX), y: Math.max(0, Math.round(height * 0.648) - bleedY), width: Math.round(w) + bleedX * 2, height: Math.round(h3) + bleedY * 2 },
      { x: Math.max(0, Math.round(width * 0.511) - bleedX), y: Math.max(0, Math.round(height * 0.648) - bleedY), width: Math.round(w) + bleedX * 2, height: Math.round(h3) + bleedY * 2 },
    ];
  }
  return [];
}

function formatName(filename) {
  const base = filename.replace(/\.[^/.]+$/, '');
  const cleaned = base
    .replace(/^[\d\s_-]+/, '')
    .replace(/[_-]+/g, ' ')
    .trim();
  return cleaned
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ') || base;
}

async function run() {
  const allTemplates = [];
  let colorIdx = 0;

  for (const cat of CATEGORIES) {
    const dir = path.join(FRAMES_ROOT, cat);
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.png'));
    console.log(`Processing category ${cat}: ${files.length} frames found.`);

    const expectedCount = cat === '1x3' ? 3 : cat === '1x4' ? 4 : cat === '2x2' ? 4 : 6;

    for (const file of files) {
      const fullPath = path.join(dir, file);
      const id = `${cat}_${file.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
      const name = formatName(file);

      try {
        const { width, height, boxes, usedFallback } = await detectHighPrecisionCutouts(fullPath, expectedCount, cat);

        allTemplates.push({
          id,
          name,
          category: cat,
          layout_type: cat,
          overlay_url: `/frames/${cat}/${encodeURIComponent(file)}`,
          accent_color: ACCENTS[colorIdx % ACCENTS.length],
          thumbnail_gradient: GRADIENTS[colorIdx % GRADIENTS.length],
          description: cat === '1x3' ? 'Classic 3-cut vertical photostrip' : cat === '1x4' ? 'Classic 4-cut vertical photostrip' : cat === '2x2' ? '4-cut modern square grid' : '6-cut dual column grid',
          frameWidth: width,
          frameHeight: height,
          cutoutBoxes: boxes,
        });

        if (usedFallback) {
          console.warn(`[Fallback] ${cat}/${file} used geometric fallback layout`);
        }

        colorIdx++;
      } catch (err) {
        console.error(`Error processing ${file}:`, err);
      }
    }
  }

  const jsonContent = JSON.stringify(allTemplates, null, 2);
  fs.writeFileSync(OUTPUT_CLIENT, jsonContent, 'utf-8');
  fs.writeFileSync(OUTPUT_SERVER, jsonContent, 'utf-8');
  console.log(`Successfully generated ${allTemplates.length} frames with high-precision bleed cutouts.`);
}

run();
