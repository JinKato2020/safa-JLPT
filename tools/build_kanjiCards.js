// 生成された漢字カード(tools/kanji_out/batch_*.json)を検算・統合して
// app/src/data/kanjiCards.json を作る。決定論チェックで不良を洗い出す。
const fs = require('fs');
const path = require('path');
const OUT = 'tools/kanji_out';
const KANJI = JSON.parse(fs.readFileSync('app/src/data/kanji.json', 'utf8'));
const appChars = new Set(KANJI.map((k) => k.char));

const isKanji = (ch) => /[一-龿々〆]/.test(ch);
const kataToHira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
function rubyForWord(word, reading) {
  if (!word || !reading || word === reading) return word;
  const runs = [];
  for (const ch of word) { const k = isKanji(ch); const l = runs[runs.length - 1]; if (l && l.kanji === k) l.text += ch; else runs.push({ kanji: k, text: ch }); }
  const ka = new Array(runs.length).fill(false);
  for (let i = runs.length - 1, s = false; i >= 0; i--) { ka[i] = s; if (runs[i].kanji) s = true; }
  let ri = 0, out = '';
  for (let idx = 0; idx < runs.length; idx++) {
    const run = runs[idx];
    if (!run.kanji) { out += run.text; if (reading.startsWith(run.text, ri)) ri += run.text.length; continue; }
    let end;
    if (!ka[idx]) { let tk = 0; for (let j = idx + 1; j < runs.length; j++) tk += runs[j].text.length; end = reading.length - tk; if (end <= ri) end = reading.length; }
    else { const n = runs[idx + 1]; const nk = n && !n.kanji ? n.text[0] : ''; end = nk ? reading.indexOf(nk, ri + 1) : reading.length; if (end < ri) end = reading.length; }
    const core = reading.slice(ri, end); out += core ? run.text + '（' + core + '）' : run.text; ri = end;
  }
  return out;
}
function emptyKanjiRuby(word, reading) {
  if (!word || !reading || word === reading) return isKanji(word);
  const ruby = rubyForWord(word, reading);
  for (const ch of word) if (isKanji(ch) && !new RegExp(ch + '（').test(ruby) && !new RegExp(ch + '[^（]*（').test(ruby)) {
    // 連続漢字は1ルビ(学生（) なので、run先頭が（を持てばOK。個別厳密判定は下のrun単位で。
  }
  // run単位: 各漢字runが（を得るか
  const runs = [];
  for (const c of word) { const k = isKanji(c); const l = runs[runs.length - 1]; if (l && l.kanji === k) l.text += c; else runs.push({ kanji: k, text: c }); }
  let pos = 0;
  for (const run of runs) {
    if (run.kanji) { const at = ruby.indexOf(run.text, pos); if (at < 0) return true; const after = ruby.slice(at + run.text.length); if (!after.startsWith('（')) return true; pos = at + run.text.length; }
  }
  return false;
}

const cards = {};
const issues = { parseErr: [], dupChar: [], notAppKanji: [], noReadings: [], badExampleReading: [], emptyRuby: [], bareUnnatural: [], okuriInReading: [] };
const files = fs.readdirSync(OUT).filter((f) => /^batch_\d+\.json$/.test(f)).sort();
let total = 0;
for (const f of files) {
  let arr;
  try { arr = JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8')); }
  catch (e) { issues.parseErr.push(`${f}: ${e.message}`); continue; }
  if (!Array.isArray(arr)) { issues.parseErr.push(`${f}: not array`); continue; }
  for (const card of arr) {
    total++;
    const ch = card.char;
    if (!appChars.has(ch)) { issues.notAppKanji.push(ch); continue; }
    if (cards[ch]) { issues.dupChar.push(ch); }
    cards[ch] = card;
    if (!card.readings || !card.readings.length) { issues.noReadings.push(ch); continue; }
    for (const r of card.readings) {
      if (/[.．]/.test(r.reading)) issues.okuriInReading.push(`${ch} ${r.reading}`);
      const rd = kataToHira(r.reading);
      for (const ex of (r.examples || [])) {
        // 読み整合: 例語の読みに その読み(かな化)が含まれるか
        if (rd && !kataToHira(ex.reading).includes(rd.replace(/[-]/g, ''))) issues.badExampleReading.push(`${ch} ${r.reading}: ${ex.word}(${ex.reading})`);
        // ルビ欠落
        if (emptyKanjiRuby(ex.word, ex.reading)) issues.emptyRuby.push(`${ch} ${r.reading}: ${ex.word}(${ex.reading}) -> ${rubyForWord(ex.word, ex.reading)}`);
        // 裸で不自然(word===char かつ 1字) は目視候補
        if (ex.word === ch) issues.bareUnnatural.push(`${ch} ${r.reading}: 裸`);
      }
    }
  }
}
// app612字の網羅
const missing = [...appChars].filter((c) => !cards[c]);

console.log(`=== 統合: ${Object.keys(cards).length}/${appChars.size} 字 (バッチ${files.length}個/カード${total}枚) ===`);
console.log(`未生成(欠落): ${missing.length}字 ${missing.join('')}`);
for (const [k, v] of Object.entries(issues)) console.log(`${k}: ${v.length}` + (v.length && v.length <= 25 ? '  ' + v.join(' | ') : ''));

if (process.argv.includes('--write') && missing.length === 0 && issues.parseErr.length === 0) {
  fs.writeFileSync('app/src/data/kanjiCards.json', JSON.stringify(cards));
  console.log('\napp/src/data/kanjiCards.json 書込完了');
} else if (process.argv.includes('--write')) {
  console.log('\n⚠ 欠落/parseErr があるため未書込。先に不足バッチを再生成のこと。');
}
