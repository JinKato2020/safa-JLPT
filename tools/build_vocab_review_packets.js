// 語彙例文の氷山レビュー用パケット。全3526語について
//  {id, w:word, r:reading, lv:level, m:meaning, ex:現行例文(平文)} を作る。
// エージェントは ex を点検し「不適(語が使われていない/語義違い/読み不一致/不自然/括弧混入)」or「無し」なら
// 新例文を出す。良ければ据え置き(出力しない)。分割してファイル化。
const fs = require('fs');
const D = 'app/src/data/';
const V = JSON.parse(fs.readFileSync(D + 'vocab.json', 'utf8'));
const EX = JSON.parse(fs.readFileSync(D + 'vocabExamplesAi.json', 'utf8'));

const packets = V.map((v) => ({
  id: v.id, w: v.word, r: v.reading, lv: v.level,
  m: v.meaning,
  ex: (EX[v.id] && EX[v.id].ja) ? EX[v.id].ja : '',
}));

const BATCH = 175; // ~20バッチ
const inDir = 'tools/vocab_batches';
const outDir = 'tools/vocab_out';
fs.rmSync(inDir, { recursive: true, force: true });
fs.mkdirSync(inDir, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });
let n = 0;
for (let i = 0; i < packets.length; i += BATCH) {
  const idx = String(n).padStart(2, '0');
  fs.writeFileSync(`${inDir}/batch_${idx}.json`, JSON.stringify(packets.slice(i, i + BATCH)));
  n++;
}
const noEx = packets.filter((p) => !p.ex).length;
console.log(`語彙 ${packets.length} → ${n}バッチ(各${BATCH}) / 例文無し ${noEx}語(=要生成)`);
console.log(`入力: ${inDir}/ 出力: ${outDir}/`);
