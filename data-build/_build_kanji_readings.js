// 読みキュレーション(.output)を検証し kanjiReadings.json(上書き辞書 {char:{on,kun}}) を生成。
// 検証: 整えた各読みが「元のkanji.jsonに存在する読み」か(並べ替え/取捨のみ・新造禁止)。
//   照合は ./ と - と空白を除去して比較。1つでも元に無い読みがあればその字は不採用(元のまま)。
const fs = require('fs');
const D = 'C:/Users/jwpsa/Documents/desktop/claude/JLPTアプリ/app/src/data';
const OUT = process.argv[2];
const KANJI = JSON.parse(fs.readFileSync(D + '/kanji.json', 'utf8'));
const wf = JSON.parse(fs.readFileSync(OUT, 'utf8'));
const items = ((wf.result || wf).items) || [];
const kmap = {}; for (const k of KANJI) kmap[k.char] = k;

const bare = (r) => String(r).replace(/[.\-\s]/g, '').trim(); // 送り仮名./接辞-/空白を除去
const origSet = (field) => new Set((field || '').split('、').map(bare).filter(Boolean));
const valid = (curated, orig) => {
  const set = origSet(orig);
  const list = (curated || '').split('、').map(bare).filter(Boolean);
  return list.every((r) => set.has(r)); // 整えた読みは全て元に存在する事(新造禁止)
};

const out = {};
const onBad = [], kunBad = [], unknown = [], dup = [], seen = new Set();
for (const it of items) {
  const k = kmap[it.char];
  if (!k) { unknown.push(it.char); continue; }
  if (seen.has(it.char)) { dup.push(it.char); continue; }
  seen.add(it.char);
  const onOk = valid(it.on, k.on);
  const kunOk = valid(it.kun, k.kun);
  if (!onOk) onBad.push(`${it.char}: ${it.on} (元: ${k.on})`);
  if (!kunOk) kunBad.push(`${it.char}: ${it.kun} (元: ${k.kun})`);
  // on/kun それぞれ、検証OKなら整えた版、NGなら元のまま採用
  out[it.char] = { on: onOk ? it.on : k.on, kun: kunOk ? it.kun : k.kun };
}
const missing = KANJI.filter((k) => !(k.char in out)).map((k) => k.char);
const sorted = {}; Object.keys(out).sort().forEach((c) => { sorted[c] = out[c]; });
fs.writeFileSync(D + '/kanjiReadings.json', JSON.stringify(sorted, null, 0) + '\n', 'utf8');

console.log(`採用 ${Object.keys(sorted).length} / 入力 ${items.length}`);
console.log(`on新造疑い(元のまま) ${onBad.length}:`, onBad.slice(0, 15).join(' / '));
console.log(`kun新造疑い(元のまま) ${kunBad.length}:`, kunBad.slice(0, 15).join(' / '));
if (unknown.length) console.log('unknown:', unknown.slice(0, 20).join(''));
if (dup.length) console.log('dup:', dup.slice(0, 20).join(''));
console.log(`未カバー(元のまま) ${missing.length}:`, missing.slice(0, 30).join(''));
for (const c of ['天', '上', '下', '生', '気', '父']) if (sorted[c]) console.log('  ', c, JSON.stringify(sorted[c]), ' ← 元 on:', kmap[c].on, '/ kun:', kmap[c].kun);
