// Generate a publishable catalog; does not commit, push or build the app.
// Default: current bundled autumn art. --source PATH: folder containing 昼_*/夜_* or day_*/night_* images.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { parseArtManifest } from '../src/data/afterStudyRemoteCore.ts';
import { dimensions } from './lib/imageDimensions.mjs';

const args = process.argv.slice(2);
const sourceIndex = args.indexOf('--source');
if (sourceIndex >= 0 && !args[sourceIndex + 1]) throw new Error('--source requires a directory');
const source = resolve(sourceIndex >= 0 ? args[sourceIndex + 1] : 'assets/afterstudy');
const output = resolve('web/afterstudy');

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
