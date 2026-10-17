// JFT-Basic 難易度帯タグ jftBands.json を自作(クリーン)。
//   方針(掲示板2026-06-25): A2≒N4。JFTスコープ=A1+A2=N5+N4。各item に A1/A2.1/A2.2 を付与。
//   ★いろどり等の固定リストは一切使わない。level(クリーン: 文科省/JLPT級) ＋ 頻度(自作VOCAB_FREQ・JMdict由来) ＋ 漢字grade/画数(KANJIDIC) のみで決定。
//   N5→A1 / N4→A2.1(易半分)・A2.2(難半分) を頻度・画数の中央値で分割。N3=範囲外(上積み・介護)で付与しない。
//   出力: app/src/data/jftBands.json = { itemId: 'A1'|'A2.1'|'A2.2' }
const fs = require('fs');
const D = __dirname + '/../app/src/data';
const rd = (f) => JSON.parse(fs.readFileSync(`${D}/${f}`, 'utf8'));

const vocab = rd('vocab.json');
const kanji = rd('kanji.json');
const grammar = rd('grammar.json');
const reading = rd('reading.json');
const listening = rd('listening.json');
const freq = rd('vocabFreq.json'); // id → 頻度(小さいほど高頻度=易)

const out = {};
const median = (arr) => { const a = [...arr].sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : 0; };

// N5 = A1（一律）。N4 = 難易度スコアの中央値で A2.1(易)/A2.2(難)。N3 = 範囲外。
function bandSplit(items, scoreOf, label) {
  const n5 = items.filter((i) => i.level === 'N5');
  const n4 = items.filter((i) => i.level === 'N4');
  for (const i of n5) out[i.id] = 'A1';
  const med = median(n4.map(scoreOf));
  let a21 = 0, a22 = 0;
  for (const i of n4) { const b = scoreOf(i) <= med ? 'A2.1' : 'A2.2'; out[i.id] = b; if (b === 'A2.1') a21++; else a22++; }
  console.log(`[${label}] N5(A1)=${n5.length} / N4: A2.1=${a21} A2.2=${a22} (median=${med})`);
}

// 語彙: 頻度(無ければ大きい値=難)。
bandSplit(vocab, (v) => (freq[v.id] != null ? freq[v.id] : 999), '語彙');
// 漢字: grade*7 + 画数*0.3 (易しいほど低い・quizのitemDifficultyと整合)。
bandSplit(kanji, (k) => (k.grade || 9) * 7 + (k.strokes || 0) * 0.3, '漢字');
// 文法: 級内の出現順(前半=易)。N4は前半A2.1/後半A2.2。
(() => {
  const n4 = grammar.filter((g) => g.level === 'N4');
  for (const g of grammar.filter((x) => x.level === 'N5')) out[g.id] = 'A1';
  n4.forEach((g, idx) => { out[g.id] = idx < n4.length / 2 ? 'A2.1' : 'A2.2'; });
  console.log(`[文法] N5(A1)=${grammar.filter((g) => g.level === 'N5').length} / N4=${n4.length}(前半A2.1/後半A2.2)`);
})();
// 読解/聴解の設問: 文章難易度の細分は将来。level で N5→A1 / N4→A2.1。
for (const r of reading) if (r.level === 'N5' || r.level === 'N4') for (const q of r.questions) out[q.id] = r.level === 'N5' ? 'A1' : 'A2.1';
for (const l of listening) if (l.level === 'N5' || l.level === 'N4') for (const q of l.questions) out[q.id] = l.level === 'N5' ? 'A1' : 'A2.1';

// キー安定化
const sorted = {}; Object.keys(out).sort().forEach((k) => (sorted[k] = out[k]));
fs.writeFileSync(`${D}/jftBands.json`, JSON.stringify(sorted) + '\n', 'utf8');
const cnt = { A1: 0, 'A2.1': 0, 'A2.2': 0 }; Object.values(sorted).forEach((b) => cnt[b]++);
console.log(`合計 ${Object.keys(sorted).length} 項目に帯付与:`, JSON.stringify(cnt), `-> jftBands.json`);
