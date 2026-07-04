// ①〜④問題文にふりがな(漢字（かな）)を付与。kuroshiro(kuromoji)で決定論的に生成。
// 出力: app/src/data/sentenceFuri.json { <bankId>: <ふりがな付き文> }。漢字を含む文のみ。
// レベル適応ルビ(rubyNeeded)と①対象語除外は描画側で行う。ここは全漢字にふりがなを付ける。
const Kuroshiro = require('kuroshiro').default;
const Analyzer = require('kuroshiro-analyzer-kuromoji');
const fs = require('fs');
const path = require('path');
const D = path.join(__dirname, '..', 'src', 'data');
const HAS_KANJI = /[一-鿿々〆〇ヶ]/;

(async () => {
  const k = new Kuroshiro();
  await k.init(new Analyzer());
  const out = {};
  const banks = [
    ['kanjiReadingBank.json', 'sentence'],
    ['orthographyBank.json', 'sentence'],
    ['synonymBank.json', 'sentence'],
    ['contextBank.json', 'prompt'],
  ];
  let total = 0, done = 0;
  for (const [file, key] of banks) {
    const arr = JSON.parse(fs.readFileSync(path.join(D, file), 'utf8'));
    for (const e of arr) {
      const s = e[key];
      if (!s || !HAS_KANJI.test(s)) continue; // 漢字が無ければふりがな不要
      total++;
      const furi = await k.convert(s, { mode: 'okurigana', delimiterStart: '（', delimiterEnd: '）' });
      if (furi && furi !== s) out[e.id] = furi;
      done++;
      if (done % 1000 === 0) console.log('  ...', done);
    }
    console.log(file, '処理完了');
  }
  fs.writeFileSync(path.join(D, 'sentenceFuri.json'), JSON.stringify(out, null, 0));
  console.log('sentenceFuri.json 出力', Object.keys(out).length, '文 / 対象', total);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
