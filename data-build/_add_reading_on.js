// 漢字の読みラベルの「音のみ」版キーを既存 reading_label から導出して全言語に追加。
// 音のみ = テンプレートの先頭〜{on} まで(例 "音 {on}／訓 {kun}"→"音 {on}" / "On {on} / Kun {kun}"→"On {on}")。翻訳不要。
const fs = require('fs'), path = require('path');
const dir = 'C:/Users/jwpsa/Documents/desktop/claude/JLPTアプリ/app/src/i18n';
const onOnly = (s) => { const i = String(s).indexOf('{on}'); return i < 0 ? String(s) : String(s).slice(0, i + 4); };
for (const f of fs.readdirSync(dir)) {
  if (!/^[a-z]{2}\.json$/.test(f)) continue;
  const p = path.join(dir, f);
  const o = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (o['flashcardscreen.reading_label']) o['flashcardscreen.reading_on'] = onOnly(o['flashcardscreen.reading_label']);
  if (o['browse.kanjiReading']) o['browse.kanjiReading_on'] = onOnly(o['browse.kanjiReading']);
  const s = {}; Object.keys(o).sort().forEach((k) => { s[k] = o[k]; });
  fs.writeFileSync(p, JSON.stringify(s, null, 2) + '\n', 'utf8');
  console.log(f.padEnd(8), 'flash:', JSON.stringify(o['flashcardscreen.reading_on']), ' browse:', JSON.stringify(o['browse.kanjiReading_on']));
}
