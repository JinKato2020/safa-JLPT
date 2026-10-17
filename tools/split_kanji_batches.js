// 612パケットを ~30字/バッチ に分割してファイル化(生成エージェントが1バッチずつ担当)。
const fs = require('fs');
const packets = JSON.parse(fs.readFileSync('tools/kanjiCards_packets.json', 'utf8'));
const BATCH = 30;
const inDir = 'tools/kanji_batches';
const outDir = 'tools/kanji_out';
fs.rmSync(inDir, { recursive: true, force: true });
fs.mkdirSync(inDir, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });
let n = 0;
for (let i = 0; i < packets.length; i += BATCH) {
  const batch = packets.slice(i, i + BATCH);
  const idx = String(n).padStart(2, '0');
  fs.writeFileSync(`${inDir}/batch_${idx}.json`, JSON.stringify(batch));
  n++;
}
console.log(`分割: ${packets.length}字 → ${n}バッチ(各最大${BATCH}字) → ${inDir}/batch_00..${String(n-1).padStart(2,'0')}.json`);
console.log(`出力先: ${outDir}/`);
