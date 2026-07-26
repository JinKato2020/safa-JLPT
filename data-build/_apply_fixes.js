// レビュー(.output)の corrections を各 lang.json に適用。
// 安全策: ja とプレースホルダ集合が変わる修正は不採用。HTMLエンティティは復号。
const fs = require('fs'), path = require('path');
const [, , outPath, dir] = process.argv;
const j = JSON.parse(fs.readFileSync(outPath, 'utf8'));
const data = j.result || j;
const results = data.results || [];
const decode = (s) => String(s)
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ');
const ja = JSON.parse(fs.readFileSync(path.join(dir, 'ja.json'), 'utf8'));
const ph = (s) => (String(s).match(/\{(\w+)\}/g) || []).sort().join(',');

let totA = 0, totS = 0;
for (const r of results) {
  if (!r || !r.lang || !Array.isArray(r.corrections) || !r.corrections.length) continue;
  const file = path.join(dir, r.lang + '.json');
  const obj = JSON.parse(fs.readFileSync(file, 'utf8'));
  let applied = 0; const skipped = [];
  for (const cor of r.corrections) {
    if (!(cor.key in ja)) { skipped.push(cor.key + '(未知)'); continue; }
    if (!cor.fixed || cor.fixed.trim() === '' || cor.fixed.trim().toUpperCase() === 'SKIP') continue; // 非修正(SKIP)
    const fixed = decode(cor.fixed);
    if (fixed === obj[cor.key]) continue; // 変化なし
    if (ph(ja[cor.key]) !== ph(fixed)) { skipped.push(cor.key + '(PH不一致)'); continue; }
    obj[cor.key] = fixed; applied++;
  }
  const sorted = {};
  Object.keys(ja).forEach((k) => { sorted[k] = obj[k]; });
  fs.writeFileSync(file, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
  totA += applied; totS += skipped.length;
  console.log(`${r.lang}: 適用 ${applied} / 見送り ${skipped.length}${skipped.length ? ' [' + skipped.slice(0, 6).join(', ') + ']' : ''}`);
}
console.log(`\n合計 適用 ${totA} / 見送り ${totS}`);
