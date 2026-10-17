// 使用キー(コード中の t('x.y') 等)と ja.json の整合チェック。MISSING=生キー表示の原因。
const fs = require('fs'), path = require('path');
const root = process.argv[2];
const ja = JSON.parse(fs.readFileSync(path.join(root, 'i18n', 'ja.json'), 'utf8'));
const jaKeys = new Set(Object.keys(ja));
const prefixes = new Set([...jaKeys].map((k) => k.split('.')[0]));
const refs = new Set();
const re = /['"]([a-z][a-z0-9]*\.[a-zA-Z0-9_]+)['"]/g;
function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) { if (f !== 'i18n') walk(p); }
    else if (/\.tsx?$/.test(f)) {
      const s = fs.readFileSync(p, 'utf8');
      let m;
      while ((m = re.exec(s))) if (prefixes.has(m[1].split('.')[0])) refs.add(m[1]);
    }
  }
}
walk(root);
// App.tsx(src外)もタブラベル等で i18n キーを参照するので走査
try {
  const appTsx = fs.readFileSync(path.join(root, '..', 'App.tsx'), 'utf8');
  re.lastIndex = 0;
  let mm;
  while ((mm = re.exec(appTsx))) if (prefixes.has(mm[1].split('.')[0])) refs.add(mm[1]);
} catch { /* noop */ }
const missing = [...refs].filter((k) => !jaKeys.has(k));
const unused = [...jaKeys].filter((k) => !refs.has(k));
console.log('referenced i18n keys:', refs.size, ' / ja.json keys:', jaKeys.size);
console.log('MISSING (used in code, NOT in ja.json):', missing.length);
missing.forEach((k) => console.log('   ', k));
console.log('UNUSED (in ja.json, not referenced):', unused.length);
unused.forEach((k) => console.log('   ', k));
