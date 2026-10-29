// 季節の場面画像(ホーム/各タブ背景・町マップ)の配信カタログを作る。commit/push/ビルドはしない。
// 使い方:
//   node --import tsx tools/publish_scene_art.mjs --source <フォルダ>   … フォルダ内の画像でカタログを作り直す
//   node --import tsx tools/publish_scene_art.mjs --clear              … 空カタログ=全端末を同梱画像に戻す
// フォルダの画像名 = <場所>_day.(jpg|png) と <場所>_night.(jpg|png) の対。場所 = home word exam dict map map_tree roof_shosai roof_shoko
//   ・カタログは毎回まるごと作り直す。フォルダに無い場所は同梱画像に戻る。
//   ・町マップ(map map_tree roof_shosai roof_shoko)は4つそろえる。当たり判定は変わらないので建物・道の配置は同じ絵にする。
//   ・前面レイヤーの位置を変える時はフォルダに frames.json を置く(1024ワールド座標)。無ければ同梱の秋版の位置。
//     例 { "map_tree": { "day": { "x": 322, "y": 202, "w": 318, "h": 218 }, "night": { ... } } }
// 反映 = web/scene-art を commit して push(サイト配信のみ・アプリのビルド不要)。
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { parseSceneManifest, SCENE_SLOTS } from '../src/data/sceneArtCore.ts';
import { dimensions } from './lib/imageDimensions.mjs';

const args = process.argv.slice(2);
const output = resolve('web/scene-art');
const manifest = { schema: 1, slots: {} };
const images = [];

if (!args.includes('--clear')) {
  const sourceIndex = args.indexOf('--source');
  if (sourceIndex < 0 || !args[sourceIndex + 1]) throw new Error('--source <folder> or --clear is required');
  const source = resolve(args[sourceIndex + 1]);
  const names = readdirSync(source);
  const framesPath = join(source, 'frames.json');
  const frames = existsSync(framesPath) ? JSON.parse(readFileSync(framesPath, 'utf8')) : {};
  const known = new Set(SCENE_SLOTS.flatMap(slot => ['day', 'night'].map(p => `${slot}_${p}`)));
  const stray = names.filter(n => /\.(png|jpe?g)$/i.test(n) && !known.has(n.replace(/\.(png|jpe?g)$/i, '')));
  if (stray.length) throw new Error(`Unknown image names: ${stray.join(', ')}`);
  for (const slot of SCENE_SLOTS) {
    const pair = {};
    for (const period of ['day', 'night']) {
      const name = names.find(n => new RegExp(`^${slot}_${period}\\.(png|jpe?g)$`, 'i').test(n));
      if (!name) continue;
      const bytes = readFileSync(join(source, name));
      const { width, height, extension } = dimensions(bytes);
      const md5 = createHash('md5').update(bytes).digest('hex');
      const file = `${slot}_${period}.${md5}.${extension}`;
      pair[period] = { file, md5, bytes: bytes.length, width, height, ...(frames[slot]?.[period] ? { frame: frames[slot][period] } : {}) };
      images.push({ file, bytes });
    }
    if (pair.day && pair.night) manifest.slots[slot] = pair;
    else if (pair.day || pair.night) throw new Error(`${slot}: both _day and _night are required`);
  }
}
parseSceneManifest(manifest); // Validate everything BEFORE changing the existing published files.
mkdirSync(join(output, 'images'), { recursive: true });
for (const image of images) writeFileSync(join(output, 'images', image.file), image.bytes);
// Old content-addressed images remain available for devices holding an older manifest.
writeFileSync(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Prepared scene art: ${Object.keys(manifest.slots).join(', ') || '(none = bundled art)'}, ${(images.reduce((n, e) => n + e.bytes.length, 0) / 1024 / 1024).toFixed(1)} MB`);
