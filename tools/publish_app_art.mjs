// アプリ同梱画像(assets/ 配下の png/jpg すべて)の差し替えカタログを作る。commit/push/ビルドはしない。
// 使い方:
//   node --import tsx tools/publish_app_art.mjs --source <フォルダ>     … フォルダ内の画像を追加/上書き(既存の差し替えは残す)
//   node --import tsx tools/publish_app_art.mjs --remove home/hair/hair_long.png …  … その画像だけ同梱に戻す
//   node --import tsx tools/publish_app_art.mjs --clear                … 全部を同梱画像に戻す
// フォルダの中身 = assets/ と同じ並び・同じファイル名(例 <フォルダ>/home/hair/hair_long.png → assets/home/hair/hair_long.png を差し替え)。
//   ・assets に無い名前は打ち間違いとして止める。拡張子(png/jpg)も同梱と同じにする。
//   ・桜(home/hair・shop/costume)と柴(shop/companion)は、透過部分を除いた実寸を測って一緒に配る(ホームの大きさ揃え用)。
//   ・柴1は胴体/尻尾の別レイヤー(shop/companion/shiba1_body.png・shiba1_tail.png)も一緒に差し替えると尻尾が振れる。片方だけなら1枚絵で表示。
// 反映 = web/app-art を commit して push(サイト配信のみ・アプリのビルド不要)。アイコン・起動画面は対象外。
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, join, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
import { parseAppArtManifest } from '../src/data/appArtCore.ts';
import { dimensions } from './lib/imageDimensions.mjs';

const args = process.argv.slice(2);
const output = resolve('web/app-art');
const manifestPath = join(output, 'manifest.json');
const assetsDir = resolve('assets');
const MEASURED = ['home/hair/', 'shop/costume/', 'shop/companion/'];

const manifest = args.includes('--clear') || !existsSync(manifestPath)
  ? { schema: 1, images: {} }
  : parseAppArtManifest(JSON.parse(readFileSync(manifestPath, 'utf8')));
const images = [];

function walk(dir) {
  return readdirSync(dir).flatMap(n => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

// 透過(アルファ>0)を除いた絵の外枠 → 高さ割合・面積の幾何平均(charNorm.ts と同じ意味)。
function measure(bytes) {
  const g = PNG.sync.read(bytes);
  let x0 = g.width, y0 = g.height, x1 = -1, y1 = -1;
  for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) {
    if (g.data[(y * g.width + x) * 4 + 3] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) throw new Error('Image is fully transparent');
  const wfrac = (x1 - x0 + 1) / g.width, hfrac = (y1 - y0 + 1) / g.height;
  return { hfrac: +hfrac.toFixed(4), sizeFrac: +Math.sqrt(wfrac * hfrac).toFixed(4) };
}

const sourceIndex = args.indexOf('--source');
if (sourceIndex >= 0) {
  if (!args[sourceIndex + 1]) throw new Error('--source <folder>');
  const source = resolve(args[sourceIndex + 1]);
  const files = walk(source).filter(p => /\.(png|jpe?g)$/i.test(p));
  if (!files.length) throw new Error('No png/jpg in ' + source);
  const unknown = files.map(p => relative(source, p).split(sep).join('/')).filter(k => !existsSync(join(assetsDir, k)));
  if (unknown.length) throw new Error(`Not in assets/ (check folder/name): ${unknown.join(', ')}`);
  for (const p of files) {
    const key = relative(source, p).split(sep).join('/');
    const bytes = readFileSync(p);
    const { width, height, extension } = dimensions(bytes);
    if (extension !== key.split('.').pop().toLowerCase().replace('jpeg', 'jpg')) throw new Error(`${key}: content is ${extension}, keep the same type as the bundled file`);
    const md5 = createHash('md5').update(bytes).digest('hex');
    const stem = key.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const file = `${stem}.${md5}.${extension}`;
    const extra = extension === 'png' && MEASURED.some(d => key.startsWith(d)) ? measure(bytes) : {};
    manifest.images[key] = { file, md5, bytes: bytes.length, width, height, ...extra };
    images.push({ file, bytes });
  }
}
const removeIndex = args.indexOf('--remove');
if (removeIndex >= 0) {
  const keys = args.slice(removeIndex + 1).filter(a => !a.startsWith('--'));
  if (!keys.length) throw new Error('--remove <assets-relative path>...');
  for (const k of keys) {
    if (!manifest.images[k]) throw new Error(`Not in catalog: ${k}`);
    delete manifest.images[k];
  }
}
if (sourceIndex < 0 && removeIndex < 0 && !args.includes('--clear')) throw new Error('--source <folder>, --remove <path>... or --clear is required');

manifest.images = Object.fromEntries(Object.entries(manifest.images).sort(([a], [b]) => a.localeCompare(b)));
parseAppArtManifest(manifest); // Validate everything BEFORE changing the existing published files.
mkdirSync(join(output, 'images'), { recursive: true });
for (const image of images) writeFileSync(join(output, 'images', image.file), image.bytes);
// Old content-addressed images remain available for devices holding an older manifest.
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
const list = Object.keys(manifest.images);
console.log(`App art: ${list.length} image(s) replaced${list.length ? ' — ' + list.slice(0, 12).join(', ') + (list.length > 12 ? ' …' : '') : ' (none = all bundled)'}, ${(Object.values(manifest.images).reduce((n, e) => n + e.bytes, 0) / 1024 / 1024).toFixed(1)} MB`);
