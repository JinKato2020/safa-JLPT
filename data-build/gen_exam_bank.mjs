// 試験構造(JLPT_出題構成)に厳密一致した問題バンクを量産。各区分=目安×倍率。
//   生成(gpt-4o-mini)→検証(同)→品質ゲート→ _exam_bank.jsonl に逐次追記(長時間/背面実行・部分結果保全)。
//   文字語彙/文法は実データ(vocab/kanji/grammar)をseed=真正性。読解/聴解は新規生成。
//   実行: node data-build/gen_exam_bank.mjs [multiplier=10] [onlyLevel=]   env: OPENAI_API_KEY
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';

const KEY = process.env.OPENAI_API_KEY;
const MODEL = 'gpt-4o-mini';
const ROOT = 'c:/Users/jwpsa/Documents/desktop/claude/JLPTアプリ';
const DATA = ROOT + '/app/src/data';
const MULT = Number(process.argv[2] ?? 10);
const ONLY = process.argv[3] || '';
const OUT = ROOT + `/data-build/_exam_bank${MULT === 10 ? '' : '_m' + MULT}.jsonl`;
if (!KEY) { console.error('OPENAI_API_KEY 未設定'); process.exit(1); }

const struct = JSON.parse(readFileSync(ROOT + '/scratchpad_struct.json', 'utf8')).JLPT;
const VOCAB = JSON.parse(readFileSync(DATA + '/vocab.json', 'utf8'));
const KANJI = JSON.parse(readFileSync(DATA + '/kanji.json', 'utf8'));
const GRAMMAR = JSON.parse(readFileSync(DATA + '/grammar.json', 'utf8'));

let tin = 0, tout = 0, reqs = 0;
async function chat(system, user, temperature = 0.7) {
  reqs++;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST', headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MODEL, temperature, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
      });
      const d = await r.json();
      if (!d.choices) throw new Error(JSON.stringify(d).slice(0, 150));
      tin += d.usage?.prompt_tokens || 0; tout += d.usage?.completion_tokens || 0;
      return JSON.parse(d.choices[0].message.content);
    } catch (e) { if (attempt === 2) throw e; await new Promise((s) => setTimeout(s, 1500)); }
  }
}

const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; };
const furiNote = (lv) => (lv === 'N5' || lv === 'N4' ? '漢字には必ずふりがなを「漢字（よみ）」で付ける。' : 'N3相当の漢字はふりがな任意。');

// 区分→生成戦略。seedType: 実データの種類。LLMは設問・4択・解説を作り、正解は必ずchoices[0]。
function buildPrompt(row, seeds) {
  const [lv, block, kubun, daimon, power] = row;
  const base = `あなたはJLPT${lv}の問題作成者。大問「${daimon}」(${power})の問題を作る。${furiNote(lv)} 4択で正解を必ずchoices[0]に置き、他3つは紛らわしいが明確な誤り(正解が一意)。explainは根拠を1文。不適切内容禁止。`;
  const schema = `出力JSONのみ: {"items":[{"stem":"提示文/本文/台本/語","question":"設問","choices":["正解","誤1","誤2","誤3"],"explain":"..."}]}`;
  const seedTxt = seeds.length ? `次の実在語句を題材に使う(これらを核に): ${JSON.stringify(seeds)}。` : '';
  let rule = '';
  switch (daimon) {
    case '漢字読み': rule = `stem=漢字を含む語または短文、question=「__の読みは？」、choices=読み(ひらがな)。${seedTxt}`; break;
    case '表記': rule = `stem=ひらがな表記の語/文、question=「正しい漢字表記は？」、choices=漢字表記。${seedTxt}`; break;
    case '文脈規定': rule = `stem=空所〔　〕のある自然な文、question=「〔　〕に入る語は？」、choices=語。文脈で一意に決まること。${seedTxt}`; break;
    case '言い換え類義': rule = `stem=語または短文、question=「意味がいちばん近いのは？」、choices=語。${seedTxt}`; break;
    case '用法': rule = `question=「${seeds[0] ?? 'この語'}の使い方が正しい文は？」、choices=その語を使った4文(正解1・誤用3)。stemは空文字でよい。${seedTxt}`; break;
    case '文法形式の判断': rule = `stem=空所〔　〕のある文、question=「〔　〕に入るものは？」、choices=文法形式。${seedTxt}`; break;
    case '文の組み立て': rule = `語句を並べ替える問題。stem=「★」を含む文と、並べ替える4語句、question=「★に入るのは？」、choices=4語句のうち★位置に来るもの。${seedTxt}`; break;
    case '文章の文法': rule = `stem=2〜3文の短い文章で1か所〔　〕、question=「〔　〕に入る最も自然な表現は？」、choices=表現。流れに合うもの一意。${seedTxt}`; break;
    case '内容理解(短文)': rule = `stem=${power}の本文(お知らせ/メモ/メール等・生活場面)、question=内容理解の設問、choices=選択肢。`; break;
    case '内容理解(中文)': rule = `stem=${power}の本文(説明/体験/手紙等・生活場面)、question=設問、choices=選択肢。`; break;
    case '内容理解(長文)': rule = `stem=${power}の本文(意見/説明・まとまった文章)、question=設問、choices=選択肢。`; break;
    case '情報検索': rule = `stem=案内/掲示/料金表/説明書など情報文、question=「必要情報」を問う設問、choices=選択肢。`; break;
    case '課題理解': rule = `聴解。stem=話者ラベル付き台本(女（おんな）：/男（おとこ）：/店員：等・全角スペース区切り)、question=「このあと何をするか/すべきこと」、choices=行動。`; break;
    case 'ポイント理解': rule = `聴解。stem=話者ラベル付き台本、question=要点(理由/時刻/場所等)を問う、choices=選択肢。`; break;
    case '概要理解': rule = `聴解。stem=やや長い話者ラベル付き台本、question=「話の主旨・意図は？」、choices=要旨。`; break;
    case '発話表現': rule = `聴解。stem=場面の説明1文(例:友だちに道をゆずるとき)、question=「何と言うか」、choices=発話。`; break;
    case '即時応答': rule = `聴解。stem=短い発話1つ(例:「お先に失礼します」)、question=「最も適切な応答は？」、choices=応答。`; break;
    default: rule = `stem/question/choicesを${daimon}に合う形で。`;
  }
  return { sys: `${base}\n${rule}\n${schema}` };
}

// 区分→seed(実データ)。レベル一致を優先、不足は近接レベルで補う。
function seedsFor(row, k) {
  const [lv, , kubun, daimon] = row;
  const lvl = (arr) => arr.filter((x) => x.level === lv);
  if (kubun === '言語知識:文字語彙') {
    if (daimon === '漢字読み' || daimon === '表記') {
      const pool = lvl(VOCAB).filter((v) => /[一-龯]/.test(v.word));
      return shuffle(pool).slice(0, k).map((v) => `${v.word}(${v.reading})=${v.meaning.split(/[,、]/)[0]}`);
    }
    const pool = lvl(VOCAB);
    return shuffle(pool).slice(0, k).map((v) => `${v.word}=${v.meaning.split(/[,、]/)[0]}`);
  }
  if (kubun === '言語知識:文法') {
    const pool = lvl(GRAMMAR);
    return shuffle(pool).slice(0, k).map((g) => `${g.point}=${g.meaning.split(/[,、]/)[0]}`);
  }
  return []; // 読解/聴解はseedなし(新規場面)
}

const okItem = (it) => it && typeof it.question === 'string' && it.question && Array.isArray(it.choices) && it.choices.length === 4 && new Set(it.choices).size === 4 && it.explain;

async function genRow(row) {
  const [lv, block, kubun, daimon, power, cnt] = row;
  const target = Number(cnt) * MULT;
  const isRL = kubun === '読解' || kubun === '聴解';
  const batch = isRL ? 4 : 8;
  let made = 0, guard = 0;
  while (made < target && guard++ < target / batch + 8) {
    const want = Math.min(batch, target - made);
    const seeds = seedsFor(row, want + 2);
    const { sys } = buildPrompt(row, seeds);
    let items;
    try { items = ((await chat(sys, `${want}問。互いに重複しない。`)).items || []).slice(0, want).filter(okItem); }
    catch (e) { console.log(`  ! gen ${lv}/${daimon}: ${String(e).slice(0, 60)}`); break; }
    if (!items.length) continue;
    // 検証(軽量・同モデル): 一意正答&レベル相応か
    let valid = items.map(() => true);
    try {
      const v = await chat(`JLPT${lv}「${daimon}」を検証。各itemが①正答(choices[0])が正しく一意 ②${lv}相応 ③不適切なし か判定。出力JSON: {"v":[true/false,...]}`, JSON.stringify(items.map((it) => ({ q: it.question, c: it.choices }))), 0.1);
      if (Array.isArray(v.v)) valid = items.map((_, i) => v.v[i] !== false);
    } catch { /* 検証失敗時は通す */ }
    for (let i = 0; i < items.length; i++) {
      if (!valid[i]) continue;
      const it = items[i];
      appendFileSync(OUT, JSON.stringify({ level: lv, block, section: kubun, daimon, power, stem: it.stem || '', question: it.question, choices: it.choices, answer: it.choices[0], explain: it.explain }) + '\n');
      made++;
      if (made >= target) break;
    }
  }
  return made;
}

(async () => {
  if (existsSync(OUT)) writeFileSync(OUT, ''); // 再実行はクリア
  const KUBUN_SET = ['読解', '聴解']; // 今回は読解・聴解のみ(文字語彙/文法は別途)
  const rows = struct.slice(1).filter((r) => r[0] && ['N5', 'N4', 'N3'].includes(r[0]) && KUBUN_SET.includes(r[2]) && (!ONLY || r[0] === ONLY));
  let total = 0;
  const grand = rows.reduce((a, r) => a + Number(r[5]) * MULT, 0);
  console.log(`量産開始: ${rows.length}区分 ・ 目標${grand}問 (×${MULT}) ・ model ${MODEL}`);
  for (const row of rows) {
    const n = await genRow(row);
    total += n;
    const usd = tin / 1e6 * 0.15 + tout / 1e6 * 0.6;
    console.log(`✓ ${row[0]} ${row[3]} : ${n}/${Number(row[5]) * MULT}  [累計${total}/${grand} ・ req${reqs} ・ ¥${(usd * 150).toFixed(0)}]`);
  }
  const usd = tin / 1e6 * 0.15 + tout / 1e6 * 0.6;
  console.log(`=== 完了 ${total}/${grand}問 ・ req${reqs} ・ in${tin}/out${tout} ・ 概算 $${usd.toFixed(3)}=¥${(usd * 150).toFixed(0)} ===`);
  console.log(`出力 -> ${OUT}`);
})();
