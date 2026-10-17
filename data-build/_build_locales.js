// 翻訳ワークフロー(.output)から各言語JSONを書き出し、ja.jsonと整合検証。
// 使い方: node _build_locales.js <translate.output> <app/src/i18n dir>
const fs = require('fs'), path = require('path');
const [, , outPath, dir] = process.argv;
const j = JSON.parse(fs.readFileSync(outPath, 'utf8'));
const data = j.result || j;
const results = data.results || [];
const ja = JSON.parse(fs.readFileSync(path.join(dir, 'ja.json'), 'utf8'));
const jaKeys = Object.keys(ja);
const ph = (s) => (String(s).match(/\{(\w+)\}/g) || []).sort().join(',');
// 翻訳エージェントが混入させがちなHTMLエンティティを復号(RNは解釈しないため)。
const decode = (s) => String(s)
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ');

let wrote = 0;
for (const r of results) {
  if (!r || !r.lang || !Array.isArray(r.entries)) continue;
  const obj = {};
  for (const e of r.entries) obj[e.key] = decode(e.text);
  const missing = jaKeys.filter((k) => !(k in obj));
  const extra = Object.keys(obj).filter((k) => !(k in ja));
  const phBad = jaKeys.filter((k) => k in obj && ph(ja[k]) !== ph(obj[k]));
  // 欠けキーは ja で補完(実行時もjaへフォールバックするが、ファイルを完全にしておく)
  for (const k of missing) obj[k] = ja[k];
  const sorted = {};
  jaKeys.forEach((k) => { sorted[k] = obj[k]; });
  fs.writeFileSync(path.join(dir, r.lang + '.json'), JSON.stringify(sorted, null, 2) + '\n', 'utf8');
  wrote++;
  const flags = [];
  if (missing.length) flags.push(`MISSING ${missing.length}(ja補完)`);
  if (extra.length) flags.push(`EXTRA ${extra.length}`);
  if (phBad.length) flags.push(`PLACEHOLDER不一致 ${phBad.length}: ${phBad.slice(0, 8).join(',')}`);
  console.log(`${r.lang}: ${Object.keys(sorted).length}キー ${flags.length ? '⚠ ' + flags.join(' / ') : '✓ 完全'}`);
}
console.log(`\n書き出し ${wrote} 言語 / 基準 ${jaKeys.length}キー`);
