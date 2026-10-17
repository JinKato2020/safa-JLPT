// 用法(usage)問題に vocabId を後付けする。stem(=対象語)を vocab.json に突合:
//   ① 語(ふりがな除去)一致 ② stemのふりがな由来の読み一致。複数候補は同級優先→先頭。
// 使い方: node tools/link_usage_vocabid.mjs [--apply]   （--apply でファイル書換。既定はドライラン）
import { readFileSync, writeFileSync } from 'node:fs';
const APPLY = process.argv.includes('--apply');
const V = JSON.parse(readFileSync('src/data/shared/vocab.json', 'utf8'));
const byWord = new Map(), byReading = new Map();
for (const v of V) {
  (byWord.get(v.word) ?? byWord.set(v.word, []).get(v.word)).push(v);
  (byReading.get(v.reading) ?? byReading.set(v.reading, []).get(v.reading)).push(v);
}
const stripFuri = (s) => (s || '').replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '');
// 漢字（かな）→かな で純読みを得る
const toReading = (s) => (s || '').replace(/[一-龥々〆ヶ]+（([ぁ-ゖァ-ヶー]+)）/g, '$1').replace(/（[^）]*）/g, '');
const pick = (cands, lv) => cands.find((v) => v.level === lv) ?? cands[0];

for (const lv of ['N4', 'N3']) {
  const path = `content/problems/moji_goi/usage_${lv}.json`;
  const j = JSON.parse(readFileSync(path, 'utf8'));
  const items = j.items ?? j;
  let byW = 0, byR = 0, none = 0;
  const miss = [], levelOfCov = {};
  for (const it of items) {
    const word = stripFuri(it.stem);
    const reading = toReading(it.stem);
    let m = null, how = '';
    if (byWord.has(word)) { m = pick(byWord.get(word), lv); how = 'word'; byW++; }
    else if (reading && byReading.has(reading)) { m = pick(byReading.get(reading), lv); how = 'reading'; byR++; }
    else { none++; if (miss.length < 50) miss.push(it.stem); }
    if (m) { it.vocabId = m.id; levelOfCov[m.level] = (levelOfCov[m.level] || 0) + 1; }
    else { delete it.vocabId; }
  }
  console.log(`${lv}: 全${items.length} | 語一致${byW} 読み一致${byR} 未一致${none} | リンク先の級内訳=${JSON.stringify(levelOfCov)}`);
  if (none) console.log('   未一致:', miss.join(' / '));
  if (APPLY) {
    // 元の整形(インデント/改行)を保つ: 検出
    const raw = readFileSync(path, 'utf8');
    const m = raw.match(/\n( +)"/);
    const indent = m ? m[1].length : 2;
    const crlf = raw.includes('\r\n');
    let out = JSON.stringify(j, null, indent);
    if (crlf) out = out.replace(/\n/g, '\r\n');
    writeFileSync(path, out);
    console.log(`   WROTE ${path} (indent=${indent}, crlf=${crlf})`);
  }
}
if (!APPLY) console.log('\n(ドライラン。書き換えるには --apply)');
