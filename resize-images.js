import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve('.');
const RAW_DIR = path.join(ROOT, 'raw-images');
const OUT_DIR = path.join(ROOT, 'images');

const MAX_WIDTH = 1600;
const JPEG_QUALITY = 82;
const WEBP_QUALITY = 78;

const SOURCE_EXT = /\.(jpe?g|png|tiff?|webp|heic|heif|avif)$/i;

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function processOne(file) {
  const base = path.basename(file, path.extname(file));
  const jpegOut = path.join(OUT_DIR, `${base}.jpg`);
  const webpOut = path.join(OUT_DIR, `${base}.webp`);

  const [hasJpeg, hasWebp] = await Promise.all([exists(jpegOut), exists(webpOut)]);
  if (hasJpeg && hasWebp) {
    console.log(`skip   ${base} (already processed)`);
    return;
  }

  const pipeline = sharp(file)
    .rotate()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true });

  if (!hasJpeg) {
    await pipeline
      .clone()
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toFile(jpegOut);
    console.log(`jpeg   ${base}`);
  }
  if (!hasWebp) {
    await pipeline
      .clone()
      .webp({ quality: WEBP_QUALITY })
      .toFile(webpOut);
    console.log(`webp   ${base}`);
  }
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const entries = await fs.readdir(RAW_DIR).catch(err => {
    if (err.code === 'ENOENT') return [];
    throw err;
  });
  const sources = entries.filter(name => SOURCE_EXT.test(name));
  if (sources.length === 0) {
    console.log('No source images in raw-images/.');
    return;
  }
  for (const name of sources) {
    await processOne(path.join(RAW_DIR, name));
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
