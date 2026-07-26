// ワークフロー抽出結果(.output JSON)から ja.json(基準辞書 {key:ja}) を生成。
const fs = require('fs');
const [, , outPath, destPath] = process.argv;
let raw = fs.readFileSync(outPath, 'utf8');
let json;
try { json = JSON.parse(raw); } catch {
  const a = raw.indexOf('{'); const b = raw.lastIndexOf('}');
  json = JSON.parse(raw.slice(a, b + 1));
}
const data = json.result || json;
const entries = data.entries || [];
const obj = {};
const dups = [];
for (const e of entries) {
  if (Object.prototype.hasOwnProperty.call(obj, e.key) && obj[e.key] !== e.ja) dups.push(e.key + ' :: ' + obj[e.key] + ' | ' + e.ja);
  obj[e.key] = e.ja;
}
const sorted = {};
Object.keys(obj).sort().forEach((k) => { sorted[k] = obj[k]; });
fs.writeFileSync(destPath, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
console.log('total entries:', entries.length, '/ unique keys:', Object.keys(sorted).length);
if (dups.length) { console.log('DUP (conflicting):', dups.length); dups.slice(0, 30).forEach((d) => console.log('  ', d)); }
else console.log('no conflicting duplicates');
