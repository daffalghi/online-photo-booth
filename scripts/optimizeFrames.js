const sharp = require('../server/node_modules/sharp');
const fs = require('fs');
const path = require('path');

const FRAMES_DIR = path.join(__dirname, '../client/public/frames');
const CLIENT_JSON = path.join(__dirname, '../client/src/lib/generatedFrames.json');
const SERVER_JSON = path.join(__dirname, '../server/src/services/generatedFrames.json');
const SERVER_DIST_JSON = path.join(__dirname, '../server/dist/services/generatedFrames.json');

async function getAllPngFiles(dir) {
  let files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(await getAllPngFiles(full));
    } else if (entry.name.endsWith('.png')) {
      files.push(full);
    }
  }
  return files;
}

async function run() {
  console.log('--- Starting Frame WebP & Thumbnail Optimization ---');
  const pngFiles = await getAllPngFiles(FRAMES_DIR);
  console.log(`Found ${pngFiles.length} PNG frames.`);

  let totalOrigBytes = 0;
  let totalWebpBytes = 0;
  let totalThumbBytes = 0;

  for (let i = 0; i < pngFiles.length; i++) {
    const pngPath = pngFiles[i];
    const origStat = fs.statSync(pngPath);
    totalOrigBytes += origStat.size;

    const parsed = path.parse(pngPath);
    const webpPath = path.join(parsed.dir, `${parsed.name}.webp`);
    const thumbPath = path.join(parsed.dir, `${parsed.name}_thumb.webp`);

    // 1. Convert to high-quality full WebP (for final composition & crisp display)
    await sharp(pngPath)
      .webp({ quality: 90, effort: 4 })
      .toFile(webpPath);
    const webpStat = fs.statSync(webpPath);
    totalWebpBytes += webpStat.size;

    // 2. Generate lightweight thumbnail WebP (for gallery preview ~320px height)
    await sharp(pngPath)
      .resize({ height: 320, fit: 'inside' })
      .webp({ quality: 85, effort: 4 })
      .toFile(thumbPath);
    const thumbStat = fs.statSync(thumbPath);
    totalThumbBytes += thumbStat.size;

    // 3. Remove original heavy PNG to free up disk space and git repo
    fs.unlinkSync(pngPath);

    console.log(`[${i + 1}/${pngFiles.length}] ${parsed.name}: ${(origStat.size / 1024).toFixed(0)}KB -> WebP: ${(webpStat.size / 1024).toFixed(0)}KB, Thumb: ${(thumbStat.size / 1024).toFixed(0)}KB`);
  }

  console.log('\n--- Optimization Results ---');
  console.log(`Original PNGs: ${(totalOrigBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Optimized Full WebP: ${(totalWebpBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Gallery Thumbnails WebP: ${(totalThumbBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Gallery initial load reduction: ${((1 - totalThumbBytes / totalOrigBytes) * 100).toFixed(1)}%`);

  // Update JSON references
  function updateJsonFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const updated = data.map((item) => {
      let overlayUrl = item.overlay_url || item.overlayUrl;
      if (overlayUrl && overlayUrl.endsWith('.png')) {
        const decoded = decodeURIComponent(overlayUrl);
        const parsed = path.parse(decoded);
        const webpRel = `${parsed.dir}/${parsed.name}.webp`.replace(/\\/g, '/');
        const thumbRel = `${parsed.dir}/${parsed.name}_thumb.webp`.replace(/\\/g, '/');
        return {
          ...item,
          overlay_url: encodeURI(webpRel),
          thumbnail_url: encodeURI(thumbRel),
        };
      }
      return item;
    });
    fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf8');
    console.log(`Updated: ${filePath}`);
  }

  updateJsonFile(CLIENT_JSON);
  updateJsonFile(SERVER_JSON);
  updateJsonFile(SERVER_DIST_JSON);

  console.log('Optimization complete!');
}

run().catch(console.error);
