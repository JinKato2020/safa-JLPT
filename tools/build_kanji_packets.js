// 漢字カード再生成の「決定論 前計算」。
// 各 app漢字(612)について、生成エージェントが判断に使うソースパケットを作る。
//  - KANJIDIC(ja-kanji.json): 権威ある on/kun読み(送り仮名ドット付)・全義meanings・freq
//  - app kanji.json: カードlevel
//  - app vocab.json + vocabFreq.json: その漢字を含む「学習者が出会う語」= 例語候補(頻度順)
// 出力: tools/kanjiCards_packets.json （generで args 経由で渡す。read-agent禁止=規#9）
const fs = require('fs');
const d = 'app/src/data/';
const KANJI = JSON.parse(fs.readFileSync(d + 'kanji.json', 'utf8'));              // 612 app cards
const KJD = JSON.parse(fs.readFileSync('app/shared/JLPT-Listening/dict/data/ja-kanji.json', 'utf8')); // KANJIDIC
const VOCAB = JSON.parse(fs.readFileSync(d + 'vocab.json', 'utf8'));
const VF = JSON.parse(fs.readFileSync(d + 'vocabFreq.json', 'utf8'));
const LR = JSON.parse(fs.readFileSync(d + 'kanjiLevelReadings.json', 'utf8'));
const CR = JSON.parse(fs.readFileSync(d + 'kanjiCardReadings.json', 'utf8'));

const kjdByChar = {};
for (const k of KJD) kjdByChar[k.char] = k;

// 漢字 -> その字を含む app語彙 [{word,reading,level,freq}] 頻度昇順(freq小=高頻度)
const vocabByChar = {};
for (const v of VOCAB) {
  const freq = VF[v.id] ?? 99999;
  for (const ch of new Set(v.word)) {
    if (!/[一-龿々〆]/.test(ch)) continue;
    (vocabByChar[ch] ||= []).push({ word: v.word, reading: v.reading, level: v.level, freq });
  }
}
for (const ch of Object.keys(vocabByChar)) vocabByChar[ch].sort((a, b) => a.freq - b.freq);

const packets = [];
let noVocab = 0;
for (const k of KANJI) {
  const ch = k.char;
  const kjd = kjdByChar[ch] || {};
  // 例語候補=app語彙(頻度上位20)。word/reading/level のみ(freqは並び順で表現)。
  const vw = (vocabByChar[ch] || []).slice(0, 20).map((v) => ({ word: v.word, reading: v.reading, level: v.level }));
  if (!vw.length) noVocab++;
  packets.push({
    char: ch,
    level: k.level,
    on: kjd.on || [],
    kun: kjd.kun || [],       // 送り仮名ドット付 例: "い.きる"
    meanings: kjd.meanings || (k.meaning ? [k.meaning] : []),
    vocabWords: vw,           // 例語候補(app語彙・頻度順・音声あり)
  });
}

fs.writeFileSync('tools/kanjiCards_packets.json', JSON.stringify(packets));
// サマリ
const levels = {};
for (const p of packets) levels[p.level] = (levels[p.level] || 0) + 1;
const avgVocab = (packets.reduce((s, p) => s + p.vocabWords.length, 0) / packets.length).toFixed(1);
console.log('packets:', packets.length, 'levels:', JSON.stringify(levels));
console.log('例語候補なしの漢字:', noVocab, '字 / 平均候補語数:', avgVocab);
console.log('サイズ:', (fs.statSync('tools/kanjiCards_packets.json').size / 1024).toFixed(0), 'KB');
// 例語候補なしの字を列挙(標準語で補う必要=agentへ通知)
const none = packets.filter(p => !p.vocabWords.length).map(p => p.char);
console.log('候補なし字:', none.join(''));
