// Generate a publishable catalog; does not commit, push or build the app.
// Default: current bundled autumn art. --source PATH: folder containing 昼_*/夜_* or day_*/night_* images.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { parseArtManifest } from '../src/data/afterStudyRemoteCore.ts';

const args = process.argv.slice(2);
const sourceIndex = args.indexOf('--source');
if (sourceIndex >= 0 && !args[sourceIndex + 1]) throw new Error('--source requires a directory');
const source = resolve(sourceIndex >= 0 ? args[sourceIndex + 1] : 'assets/afterstudy');
const output = resolve('web/afterstudy');

// Only PNG/JPEG, with dimensions read from the file itself (no extra dependency).
function dimensions(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), extension: 'png' };
  }
  if (bytes[0] === 255 && bytes[1] === 216) {
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset++] !== 255) continue;
      let marker = bytes[offset++];
      while (marker === 255) marker = bytes[offset++];
      if (marker === 0xDA || marker === 0xD9) break;
      if (marker === 0x01 || (marker >= 0xD0 && marker <= 0xD8)) continue;
      const length = bytes.readUInt16BE(offset);
      if (length < 2) break;
      if ([0xC0, 0xC1, 0xC2].includes(marker)) {
        return { width: bytes.readUInt16BE(offset + 5), height: bytes.readUInt16BE(offset + 3), extension: 'jpg' };
      }
      offset += length;
    }
  }
  throw new Error('Unsupported or corrupt PNG/JPEG');
}
const names = readdirSync(source).filter(n => /\.(png|jpe?g)$/i.test(n)).sort();
const manifest = { schema: 1, day: [], night: [] };
const images = [];
for (const period of ['day', 'night']) {
  const prefix = period === 'day' ? /^(昼_|day_|autumn_day_)/ : /^(夜_|night_|autumn_night_)/;
  const files = names.filter(n => prefix.test(n));
  for (let i = 0; i < files.length; i++) {
    const bytes = readFileSync(join(source, files[i]));
    const { width, height, extension } = dimensions(bytes);
    const md5 = createHash('md5').update(bytes).digest('hex');
    const file = `${period}_${String(i + 1).padStart(2, '0')}.${md5}.${extension}`;
    manifest[period].push({ file, md5, bytes: bytes.length, width, height });
    images.push({ file, bytes });
  }
}
parseArtManifest(manifest); // Validate everything BEFORE changing the existing published files.
mkdirSync(join(output, 'images'), { recursive: true });
for (const image of images) writeFileSync(join(output, 'images', image.file), image.bytes);
// Old content-addressed images remain available for devices holding an older manifest.
writeFileSync(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Prepared after-study art: day=${manifest.day.length}, night=${manifest.night.length}, ${(images.reduce((n, e) => n + e.bytes.length, 0) / 1024 / 1024).toFixed(1)} MB`);
