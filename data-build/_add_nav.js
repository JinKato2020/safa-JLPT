// ボトムタブの Home ラベル用キー nav.home を全言語JSONに追加(他タブは既存キー再利用)。
const fs = require('fs'), path = require('path');
const dir = process.argv[2];
const HOME = { ja: 'ホーム', en: 'Home', ne: 'होम', vi: 'Trang chủ', my: 'ပင်မ', id: 'Beranda', ko: '홈', zh: '首页', bn: 'হোম', th: 'หน้าแรก' };
for (const [lang, val] of Object.entries(HOME)) {
  const f = path.join(dir, lang + '.json');
  const o = JSON.parse(fs.readFileSync(f, 'utf8'));
  o['nav.home'] = val;
  const sorted = {};
  Object.keys(o).sort().forEach((k) => { sorted[k] = o[k]; });
  fs.writeFileSync(f, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
  console.log(lang, '+ nav.home =', val);
}
