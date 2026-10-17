// キュレーション(.output)を検証し kanjiExamples.json(上書き辞書)を生成。
// 検証=例の読みが その字の音/訓読みを実際に含むか(連濁・促音・長音を正規化して部分一致)。
// onが不正→上書きせず導出にフォールバック。kunが不正→nullにして音のみ。
const fs = require('fs');
const D = 'C:/Users/jwpsa/Documents/desktop/claude/JLPTアプリ/app/src/data';
const OUT = process.argv[2];
const KANJI = JSON.parse(fs.readFileSync(D + '/kanji.json', 'utf8'));
const wf = JSON.parse(fs.readFileSync(OUT, 'utf8'));
const items = ((wf.result || wf).items) || [];

const kmap = {};
for (const k of KANJI) kmap[k.char] = k;

const VOICE = { が: 'か', ぎ: 'き', ぐ: 'く', げ: 'け', ご: 'こ', ざ: 'さ', じ: 'し', ず: 'す', ぜ: 'せ', ぞ: 'そ', だ: 'た', ぢ: 'ち', づ: 'つ', で: 'て', ど: 'と', ば: 'は', び: 'ひ', ぶ: 'ふ', べ: 'へ', ぼ: 'ほ', ぱ: 'は', ぴ: 'ひ', ぷ: 'ふ', ぺ: 'へ', ぽ: 'ほ' };
const norm = (s) => Array.from(String(s || '')).map((c) => VOICE[c] || c).join('').replace(/っ/g, 'つ').replace(/ー/g, '');
// 促音化(音読み末尾 く/き/つ/ち → っ。例 がく→がっ(学校), ほく→ほっ(北海道))も候補に。
const sokuon = (r) => r.replace(/[くきつち]$/, 'っ');
const hit = (ex, stems) => stems.some((r) => r && [r, sokuon(r)].some((c) => norm(ex).includes(norm(c))));
const onReadings = (k) => (k.on || '').split('、').map((x) => x.replace(/-/g, '').trim()).filter(Boolean);
const kunStems = (k) => (k.kun || '').split('、').map((x) => x.replace(/-/g, '').split('.')[0].trim()).filter(Boolean);

const out = {};
const onBad = [], kunBad = [], unknown = [], dup = [];
const seen = new Set();
for (const it of items) {
  const k = kmap[it.char];
  if (!k) { unknown.push(it.char); continue; }
  if (seen.has(it.char)) { dup.push(it.char); continue; }
  seen.add(it.char);
  const onR = onReadings(k), kunS = kunStems(k);
  const onOk = it.on && it.on.word && it.on.word.includes(it.char) && hit(it.on.reading, onR);
  if (!onOk) { onBad.push(`${it.char}:${it.on && it.on.word}(${it.on && it.on.reading})`); continue; }
  const entry = { word: it.on.word, reading: it.on.reading };
  if (it.kun && it.kun.word) {
    const kOk = it.kun.word.includes(it.char) && hit(it.kun.reading, kunS);
    if (kOk) entry.kun = { word: it.kun.word, reading: it.kun.reading };
    else kunBad.push(`${it.char}:${it.kun.word}(${it.kun.reading})`);
  }
  out[it.char] = entry;
}
// 明示オーバーライド(ユーザー確認済): 公の訓=おおやけ(キュレーションはnullにした)
const OVERRIDES = { '公': { word: '公園', reading: 'こうえん', kun: { word: '公', reading: 'おおやけ' } } };
Object.assign(out, OVERRIDES);
const missing = KANJI.filter((k) => !(k.char in out)).map((k) => k.char);

// keyを漢字コード順で安定化
const sorted = {};
Object.keys(out).sort().forEach((k) => { sorted[k] = out[k]; });
fs.writeFileSync(D + '/kanjiExamples.json', JSON.stringify(sorted, null, 0) + '\n', 'utf8');

console.log(`採用 ${Object.keys(sorted).length} / 入力 ${items.length}`);
console.log(`onBad(導出へフォールバック) ${onBad.length}:`, onBad.slice(0, 25).join('  '));
console.log(`kunBad(音のみに) ${kunBad.length}:`, kunBad.slice(0, 25).join('  '));
if (unknown.length) console.log(`unknown char ${unknown.length}:`, unknown.slice(0, 20).join(''));
if (dup.length) console.log(`dup ${dup.length}:`, dup.slice(0, 20).join(''));
console.log(`未カバー(導出のまま) ${missing.length}:`, missing.slice(0, 30).join(''));
// 確認用サンプル
for (const c of ['天', '上', '気', '生', '口', '父']) if (sorted[c]) console.log('  ', c, JSON.stringify(sorted[c]));
