// 漢字の「音読み・訓読み 例語（複数読み・頻度順）」を生成。要件:
//   ・音/訓の例を頻度順に示す ・音/訓がそれぞれ複数読みを持つ場合、高頻度の読みなら例を追加する。
// 出力: app/src/data/kanjiExamplesMulti.json
//   { "<漢字>": { on:[{reading(カナ),word,wordReading}...], kun:[{reading(かな),word,wordReading}...] } }
// 品質担保: 例語の読みが その字の当該音/訓を実際に含むか(連濁・促音・長音を正規化して照合)＝捏造ゼロ。
// 頻度: コーパス(辞書語彙)で その読みを使う語数＋語の使用頻度(pri/VOCAB_FREQ)で順位付け。
// データ源(無料・同梱): dict/kanji_dict.json(全N5-N1漢字 on/kun) + dict/dict_n5n1.json + app vocab.json
//   + app/kanjiReadings.json(N5-N3 整え読み=古語/稀除外) + app/kanjiExamples.json(N5-N3 検証済プライマリ例=品質アンカー)。
const fs = require('fs');
const ROOT = __dirname;
const D = ROOT + '/../app/src/data';
const rd = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

const kanjiDict = rd(ROOT + '/dict/kanji_dict.json');           // [{char,on[],kun[],...}]
const dictVocab = rd(ROOT + '/dict/dict_n5n1.json');            // [{word,reading,pri[]}]
const appVocab = rd(D + '/vocab.json');                         // [{word,reading,...}]
const curatedReadings = rd(D + '/kanjiReadings.json');          // {char:{on,kun}} 整え(頻度/常用順)
const curatedEx = rd(D + '/kanjiExamples.json');               // {char:{word,reading,kun?}}
const appKanji = rd(D + '/kanji.json');                         // N5-N3 漢字(level)

const MAX_ON = 3, MAX_KUN = 3;

// --- 仮名正規化 ---
const KATA2HIRA = (s) => String(s || '').replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const VOICE = { が:'か',ぎ:'き',ぐ:'く',げ:'け',ご:'こ',ざ:'さ',じ:'し',ず:'す',ぜ:'せ',ぞ:'そ',だ:'た',ぢ:'ち',づ:'つ',で:'て',ど:'と',ば:'は',び:'ひ',ぶ:'ふ',べ:'へ',ぼ:'ほ',ぱ:'は',ぴ:'ひ',ぷ:'ふ',ぺ:'へ',ぽ:'ほ' };
const norm = (s) => Array.from(String(s || '')).map((c) => VOICE[c] || c).join('').replace(/っ/g, 'つ').replace(/ー/g, '');
const sokuon = (r) => r.replace(/[くきつちふ]$/, 'っ');
const contains = (host, sub) => sub && [sub, sokuon(sub)].some((c) => norm(host).includes(norm(c)));
const KANJI_RE = /[一-龯㐀-䶿]/;
const ALL_HIRA = /^[ぁ-ゖー]+$/;
const kanjiCount = (w) => Array.from(w).filter((c) => KANJI_RE.test(c)).length;
const stripWave = (s) => String(s || '').replace(/[～~]/g, '');

// --- 読み一覧(KANJIDIC全件=網羅。頻度順は後段の例語頻度ソートで決定。稀読みは例語が無く自然に除外される) ---
// ※curatedReadingsは一部の常用外読み(例: 分のフン)を削っていたため、網羅性のためKANJIDICを基底にする。
const kdMap = {}; for (const k of kanjiDict) kdMap[k.char] = k;
function onList(char) {
  const arr = (kdMap[char] ? (kdMap[char].on || []) : []).map((x) => x.replace(/[-.]/g, '').trim()).filter(Boolean);
  return [...new Set(arr)]; // カナ
}
function kunList(char) {
  const arr = (kdMap[char] ? (kdMap[char].kun || []) : []).map((x) => x.replace(/-/g, '').trim()).filter(Boolean);
  return [...new Set(arr)]; // 「い.きる」「なま」等(送り仮名.付)
}

// --- 語彙コーパス(word, reading, freq) 統合(漢字を含む語のみ) ---
const wfreqMap = {}; // 語の頻度: 小さいほど高頻度(VOCAB_FREQ流用が無いのでpriで近似)
function priScore(pri) { // nf01..nf48 → 1..48 / ichi/news/spec → 中位 / 無 → 99
  if (!pri || !pri.length) return 99;
  let best = 99;
  for (const p of pri) {
    const m = /nf(\d+)/.exec(p); if (m) best = Math.min(best, +m[1]);
    else if (/^(ichi1|news1|spec1|gai1)$/.test(p)) best = Math.min(best, 12);
    else if (/^(ichi2|news2|spec2|gai2)$/.test(p)) best = Math.min(best, 30);
  }
  return best;
}
// VOCAB_FREQ(学習者向け頻度=小さいほど高頻度)を語キーに対応付け(最優先)。pri は dict のフォールバック。
const vocabFreq = (() => { try { return rd(D + '/vocabFreq.json'); } catch { return {}; } })();
const appFreqByKey = {};
for (const v of appVocab) { const f = vocabFreq[v.id]; if (f != null) appFreqByKey[stripWave(v.word) + '|' + v.reading] = f; }
const words = [];
const seenW = new Set();
for (const v of dictVocab) {
  const w = stripWave(v.word), r = v.reading; if (!w || !r) continue;
  const key = w + '|' + r; if (seenW.has(key)) continue; seenW.add(key);
  const af = appFreqByKey[key];
  words.push({ w, r, f: af != null ? af : priScore(v.pri) });
}
for (const v of appVocab) {
  const w = stripWave(v.word), r = v.reading; if (!w || !r) continue;
  const key = w + '|' + r; if (seenW.has(key)) continue; seenW.add(key);
  const af = appFreqByKey[key];
  words.push({ w, r, f: af != null ? af : 50 });
}
// 漢字→その字を含む語
const byChar = {};
for (const it of words) for (const ch of new Set(it.w.split(''))) if (KANJI_RE.test(ch)) (byChar[ch] ||= []).push(it);

// 例語選定スコア: 頻度を主に効かせ(×4)、語長は従(×1.5)。音は2字熟語を優先。
const onPenalty = (it) => it.f * 4 + it.w.length * 1.5 + (kanjiCount(it.w) >= 2 ? 0 : 10);
const kunPenalty = (it) => it.f * 4 + it.w.length * 1.5;
// 読みのサニタイズ: ソースに紛れる「する動詞」混入(食事→しょくじする 等)を、語が する で終わらないなら除去。
const cleanRd = (w, r) => (r.endsWith('する') && !w.endsWith('する') ? r.slice(0, -2) : r);

function bestOn(char, oh, cands) {
  // 音=漢字2字以上の熟語が望ましい・送り仮名なし・読みに当該音(連濁/促音)を含む
  const ok = cands.filter((it) => it.w.includes(char) && !ALL_HIRA.test(it.w.slice(1)) && contains(it.r, oh));
  if (!ok.length) return null;
  return ok.sort((a, b) => onPenalty(a) - onPenalty(b))[0];
}
function bestKun(char, stem, okuri, cands) {
  // ① 厳格: 「漢字+送り仮名」 or 単漢字(名詞訓)。読みが stem で始まり、送り仮名があれば一致。
  const strict = cands.filter((it) => {
    if (it.w[0] !== char) return false;
    const tail = it.w.slice(1);
    if (tail && !ALL_HIRA.test(tail)) return false;        // 漢字+かな のみ
    if (!norm(it.r).startsWith(norm(stem))) return false;  // 読みが訓語幹で始まる
    if (okuri) return tail === okuri || it.r.endsWith(okuri); // 送り仮名一致(あれば)
    return true;
  });
  if (strict.length) return strict.sort((a, b) => kunPenalty(a) - kunPenalty(b))[0];
  // ② フォールバック: 訓が熟語/複合で使われる字(夕方=ゆう, 小麦=むぎ, 豚肉=ぶた, 双子=ふた, 繰り返す=く)。
  //    漢字の位置で読みを照合(先頭=読みが stem で始まる / 末尾=stem で終わる / 中間=部分一致)。norm で連濁吸収。
  const ns = norm(stem);
  if (!ns) return null;
  const compound = cands.filter((it) => {
    const idx = it.w.indexOf(char);
    if (idx < 0 || it.w.length < 2) return false;
    const nr = norm(it.r);
    if (idx === 0) return nr.startsWith(ns);
    if (idx === it.w.length - 1) return nr.endsWith(ns);
    return nr.includes(ns);
  });
  if (!compound.length) return null;
  return compound.sort((a, b) => kunPenalty(a) - kunPenalty(b))[0];
}

// --- 全漢字(N5-N1: kanji_dict 全件) を対象 ---
const out = {};
let nOnMulti = 0, nKunMulti = 0, nBoth = 0;
for (const kd of kanjiDict) {
  const char = kd.char;
  const cands = byChar[char] || [];
  if (!cands.length) continue;

  // 音: 読みごとに最良例 → 採用できた読みを頻度(例語頻度)順に
  const onEntries = [];
  for (const o of onList(char)) {
    const oh = KATA2HIRA(o);
    const ex = bestOn(char, oh, cands);
    if (ex) onEntries.push({ reading: o, word: ex.w, wordReading: cleanRd(ex.w, ex.r), _p: onPenalty(ex) });
  }
  onEntries.sort((a, b) => a._p - b._p);

  // 訓: 読み(語幹.送り)ごとに最良例
  const kunEntries = [];
  for (const k of kunList(char)) {
    const dot = k.indexOf('.');
    const stem = dot >= 0 ? k.slice(0, dot) : k;
    const okuri = dot >= 0 ? k.slice(dot + 1) : '';
    const ex = bestKun(char, stem, okuri, cands);
    if (ex) kunEntries.push({ reading: (dot >= 0 ? stem + okuri : k), word: ex.w, wordReading: cleanRd(ex.w, ex.r), _p: kunPenalty(ex) });
  }
  kunEntries.sort((a, b) => a._p - b._p);

  // 重複語の除去(同じ例語が音/訓双方に出ないよう・読み内重複も)
  // 重複排除は「語＋その読み」単位。注ぐ(そそぐ)と注ぐ(つぐ)は別読み＝両方残す。
  const dedup = (arr, n) => {
    const seen = new Set(), res = [];
    for (const e of arr) { const key = e.word + '|' + e.wordReading; if (seen.has(key)) continue; seen.add(key); res.push({ reading: e.reading, word: e.word, wordReading: e.wordReading }); if (res.length >= n) break; }
    return res;
  };
  const on = dedup(onEntries, MAX_ON);
  const kun = dedup(kunEntries, MAX_KUN);
  if (!on.length && !kun.length) continue;
  // 注: データ駆動の各例は「その読みが例語の読みに実在する」検証済(norm/連濁/促音照合)＝読みラベルと例語は必ず整合。
  //     キュレーション例の差し込みは読みラベル不整合を生むため行わない。

  out[char] = {};
  if (on.length) out[char].on = on;
  if (kun.length) out[char].kun = kun;
  if (on.length >= 2) nOnMulti++;
  if (kun.length >= 2) nKunMulti++;
  if (on.length && kun.length) nBoth++;
}

const sorted = {}; Object.keys(out).sort().forEach((c) => { sorted[c] = out[c]; });
const OUT = D + '/kanjiExamplesMulti.json';
fs.writeFileSync(OUT, JSON.stringify(sorted, null, 0) + '\n', 'utf8');

// --- 音訓ラベル(kanjiReadings.json)を例と整合: 例にある読みは必ずラベルにも含める ---
// (例: 注=つぐ がキュレーションで誤って削除されていた → 例にあるので復活。送り仮名付き形はKANJIDICから)。
// ※このスクリプトは _build_kanji_readings.js の後に実行する(その出力を補正する)。N5-N3(curatedReadings)のみ対象。
function dottedKun(char, bare) {
  const kd = kdMap[char]; if (!kd) return bare;
  for (const k of (kd.kun || [])) { if (k.replace(/[-.]/g, '') === bare) return k.replace(/-/g, ''); }
  return bare;
}
const readingsOut = JSON.parse(JSON.stringify(curatedReadings));
let fixedKun = 0;
for (const char of Object.keys(out)) {
  const cur = readingsOut[char]; if (!cur) continue;          // N5-N3 のラベルのみ補正
  const ex = out[char];
  if (ex.kun && cur.kun != null) {
    const have = new Set((cur.kun || '').split('、').map((x) => x.replace(/[-.]/g, '').trim()).filter(Boolean));
    const add = [];
    for (const e of ex.kun) { const bare = e.reading.replace(/[-.]/g, ''); if (!have.has(bare)) { add.push(dottedKun(char, bare)); have.add(bare); } }
    if (add.length) { cur.kun = [cur.kun, ...add].filter(Boolean).join('、'); fixedKun++; }
  }
}
const rsorted = {}; Object.keys(readingsOut).sort().forEach((c) => { rsorted[c] = readingsOut[c]; });
fs.writeFileSync(D + '/kanjiReadings.json', JSON.stringify(rsorted, null, 0) + '\n', 'utf8');
console.log(`ラベル整合補正(訓): ${fixedKun}字 (例にある読みをラベルへ復活)`);

const appChars = new Set(appKanji.map((k) => k.char));
const covApp = appKanji.filter((k) => sorted[k.char]).length;
console.log(`漢字 ${Object.keys(sorted).length} 字に例 / kanji_dict ${kanjiDict.length}`);
console.log(`  音が複数読み: ${nOnMulti} / 訓が複数読み: ${nKunMulti} / 音訓両方: ${nBoth}`);
console.log(`  N5-N3(app kanji ${appKanji.length})カバー: ${covApp}`);
console.log(`  出力 ${Math.round(fs.statSync(OUT).size / 1024)}KB -> kanjiExamplesMulti.json`);
for (const c of ['生','上','下','日','人','行','楽','重','生','明','分']) if (sorted[c]) console.log('  ', c, JSON.stringify(sorted[c]));
