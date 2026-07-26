// 漢字カードの各例語に英訳(gloss)を付与する。
//  - app語彙(vocab.json)に在る語 → その訳を「カード用に簡潔化」して流用(決定論・¥0)。
//  - 無い語 → tools/kanji_gloss_missing.json に列挙(別途生成)。
const fs = require('fs');
const CARDS = 'app/src/data/kanjiCards.json';
const cards = JSON.parse(fs.readFileSync(CARDS, 'utf8'));
const V = JSON.parse(fs.readFileSync('app/src/data/vocab.json', 'utf8'));
const meaning = new Map();
for (const v of V) if (!meaning.has(v.word + '|' + v.reading)) meaning.set(v.word + '|' + v.reading, v.meaning);

// vocab訳をカード用glossに正規化: 先頭1〜2義・先頭小文字化・末尾句読点/丸括弧注記の一部除去・長さ上限。
function normGloss(m) {
  if (!m) return '';
  let s = String(m).trim();
  // 末尾の丸括弧注記(…)が全体の付随説明なら残す。ここでは義の分割のみ。
  const parts = s.split(/[;,]/).map((x) => x.trim()).filter(Boolean);
  let g = parts.slice(0, 2).join(', ');
  if (g.length > 42) g = parts[0];               // 長すぎる時は第一義のみ
  if (/^[A-Z][a-z]/.test(g)) g = g[0].toLowerCase() + g.slice(1); // Music→music(固有名詞以外)
  return g.replace(/[.\s]+$/, '');
}

const missing = new Map();  // word|reading -> {word,reading}
let filled = 0, miss = 0;
for (const card of Object.values(cards)) {
  for (const r of card.readings) {
    for (const e of r.examples) {
      const key = e.word + '|' + e.reading;
      const m = meaning.get(key);
      if (m) { e.gloss = normGloss(m); filled++; }
      else { e.gloss = ''; miss++; if (!missing.has(key)) missing.set(key, { word: e.word, reading: e.reading }); }
    }
  }
}
fs.writeFileSync(CARDS, JSON.stringify(cards));
fs.writeFileSync('tools/kanji_gloss_missing.json', JSON.stringify([...missing.values()]));
console.log(`例語gloss: vocab充填 ${filled} / 生成待ち ${miss}(ユニーク${missing.size})`);
console.log('--- 生成待ちサンプル ---');
console.log([...missing.values()].slice(0, 30).map((x) => x.word + '(' + x.reading + ')').join('  '));
// 音カードで確認
const c = cards['音'];
console.log('\n【音】gloss確認:');
for (const r of c.readings) for (const e of r.examples) console.log('  ' + e.word + '(' + e.reading + ') = ' + (e.gloss || '(生成待ち)'));
