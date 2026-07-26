// 読解/聴解 問題の生成パイプライン(パイロット)。生成→検証(第2LLM)→品質ゲート→staging出力。
//   ★コスト管理: 単一プロセス・逐次バッチ・サブエージェント不使用・MAX_REQで暴走防止・トークン計上。
//   生成は本データに直接混ぜず data-build/_pilot_passages.json に出す(レビュー後に採用判断)。
//   実行: node data-build/gen_passages.mjs [level=N4] [nReading=10] [nListening=10]   env: OPENAI_API_KEY
import { readFileSync, writeFileSync } from 'node:fs';

const KEY = process.env.OPENAI_API_KEY;
const MODEL = 'gpt-4o';
const D = 'c:/Users/jwpsa/Documents/desktop/claude/JLPTアプリ/app/src/data';
const LEVEL = process.argv[2] || 'N4';
const N_R = Number(process.argv[3] ?? 10);
const N_L = Number(process.argv[4] ?? 10);
const BATCH = 5, MAX_REQ = 20;
if (!KEY) { console.error('OPENAI_API_KEY 未設定'); process.exit(1); }

const reading = JSON.parse(readFileSync(D + '/reading.json', 'utf8'));
const listening = JSON.parse(readFileSync(D + '/listening.json', 'utf8'));
const titlesR = reading.filter((x) => x.level === LEVEL).map((x) => x.title);
const titlesL = listening.filter((x) => x.level === LEVEL).map((x) => x.title);

const LEN = { N5: 'ほぼひらがな・約60〜90字', N4: '日常的・約100〜140字', N3: '説明/意見/情報検索・約200〜280字' };
let tin = 0, tout = 0, reqs = 0;
async function chat(system, user, temperature = 0.7) {
  if (reqs >= MAX_REQ) throw new Error('MAX_REQ到達');
  reqs++;
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, temperature, response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
  });
  const d = await r.json();
  if (!d.choices) throw new Error('API: ' + JSON.stringify(d).slice(0, 200));
  tin += d.usage?.prompt_tokens || 0; tout += d.usage?.completion_tokens || 0;
  return JSON.parse(d.choices[0].message.content);
}

const SYS_R = `あなたはJLPT/JFT-Basic教材の作成者。${LEVEL}レベルの読解問題を作る。
- 場面=生活can-do(駅/病院/役所/店/職場/学校/家庭/お知らせ/メール/掲示/説明書/情報検索/案内 等)。実用的で自然。
- 本文の難度・長さ=${LEN[LEVEL]}。${LEVEL}相応の語彙・文法のみ。
- 漢字には必ず ふりがな を「漢字（よみ）」の形で付ける。
- 設問は1つ・4択。正解を必ず choices[0] に置く。残り3つは紛らわしいが本文から明確に誤りと分かる(正解が一意に決まること)。
- explain=本文の根拠で「なぜ正解か」を1文。固有名詞は一般的なもののみ。政治/宗教/差別/暴力など不適切内容は禁止。
出力はJSONのみ: {"items":[{"format":"お知らせ等","title":"...","body":"...","q":"...","choices":["正解","誤1","誤2","誤3"],"explain":"..."}]}`;

const SYS_L = `あなたはJLPT/JFT-Basic教材の作成者。${LEVEL}レベルの聴解問題(台本)を作る。
- 場面=日常会話/店・公共機関/指示・アナウンス/社交。実用的で自然。${LEVEL}相応。
- 台本(script)は話者ラベルを必ず「女（おんな）：」「男（おとこ）：」「店員：」「客：」「係員：」「先生：」「アナウンス：」等で始め、ターン間は全角スペース「　」で区切る。漢字にふりがな(漢字（よみ）)。長さは短め(2〜5ターン)。
- 設問1つ・4択。正解を必ず choices[0]。残り3つは明確な誤り(台本から一意に決まる)。explain=根拠1文。不適切内容禁止。
- qtype は 課題理解/ポイント理解/概要理解/即時応答/指示・アナウンス/店・公共機関 のいずれか。
出力はJSONのみ: {"items":[{"qtype":"...","title":"...","script":"女（おんな）：…　男（おとこ）：…","q":"...","choices":["正解","誤1","誤2","誤3"],"explain":"..."}]}`;

function verSys(kind) {
  return `次のJLPT${kind === 'r' ? '読解' : '聴解'}問題を厳しく検証する。各itemに判定を返す。
基準: ①${kind === 'r' ? '本文' : '台本'}だけで正解が一意に決まる ②choices[0]が確かに正しい ③他3択は明確に誤り(複数正解・曖昧はNG) ④${LEVEL}相応の難度 ⑤不適切表現なし ⑥ふりがな付き${kind === 'l' ? '・話者ラベル有り' : ''}。
1つでも欠ければ valid:false。出力JSONのみ: {"verdicts":[{"i":0,"valid":true,"reason":"..."}]}`;
}

async function genKind(kind, n, avoidTitles) {
  const out = [];
  const sys = kind === 'r' ? SYS_R : SYS_L;
  for (let made = 0; out.length < n && reqs < MAX_REQ; made += BATCH) {
    const want = Math.min(BATCH, n - out.length);
    let items;
    try {
      const g = await chat(sys, `${want}問。既存タイトルと重複しない: ${JSON.stringify([...avoidTitles, ...out.map((x) => x.title)])}`);
      items = (g.items || []).slice(0, want);
    } catch (e) { console.log('gen err:', String(e).slice(0, 80)); break; }
    if (!items.length) break;
    // 形式ゲート
    const ok = items.filter((it) => it && it.title && (kind === 'r' ? it.body : it.script) && Array.isArray(it.choices) && it.choices.length === 4 && new Set(it.choices).size === 4 && it.q && it.explain);
    // 検証パス
    let verdicts = [];
    try {
      const v = await chat(verSys(kind), JSON.stringify(ok.map((it, i) => ({ i, ...it }))), 0.1);
      verdicts = v.verdicts || [];
    } catch (e) { console.log('verify err:', String(e).slice(0, 80)); }
    const vmap = new Map(verdicts.map((x) => [x.i, x]));
    let pass = 0, fail = 0;
    ok.forEach((it, i) => {
      const vd = vmap.get(i);
      if (vd && vd.valid) { out.push(it); pass++; } else fail++;
    });
    console.log(`  ${kind === 'r' ? '読解' : '聴解'} 生成${items.length}→形式OK${ok.length}→検証合格${pass}(不合格${fail}) 累計${out.length}/${n}`);
  }
  return out.slice(0, n);
}

// staging用に最終id/構造へ整形(answerは常にchoices[0]=index0・規約)。idは仮(pilot)。
function shapeR(items, startIdx) {
  return items.map((it, k) => {
    const id = `${LEVEL.toLowerCase()}-r-p${startIdx + k}`;
    return { id, level: LEVEL, category: 'dokkai', type: 'reading', format: it.format || 'お知らせ', title: it.title, body: it.body,
      questions: [{ id: id + '-q1', q: it.q, choices: it.choices, answerIndex: 0, explain: it.explain }] };
  });
}
function shapeL(items, startIdx) {
  return items.map((it, k) => {
    const id = `${LEVEL.toLowerCase()}-l-p${startIdx + k}`;
    return { id, level: LEVEL, category: 'choukai', type: 'listening', qtype: it.qtype || '課題理解', title: it.title, script: it.script,
      questions: [{ id: id + '-q1', q: it.q, choices: it.choices, answerIndex: 0, explain: it.explain }] };
  });
}

console.log(`パイロット生成: ${LEVEL} 読解${N_R}・聴解${N_L} (model ${MODEL})`);
const rItems = await genKind('r', N_R, titlesR);
const lItems = await genKind('l', N_L, titlesL);
const result = { level: LEVEL, generatedAt: 'pilot', reading: shapeR(rItems, 1), listening: shapeL(lItems, 1) };
const OUT = 'c:/Users/jwpsa/Documents/desktop/claude/JLPTアプリ/data-build/_pilot_passages.json';
writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n');

const usd = tin / 1e6 * 2.5 + tout / 1e6 * 10;
console.log(`\n=== 完了 ===`);
console.log(`読解 採用${rItems.length}/${N_R}・聴解 採用${lItems.length}/${N_L}  リクエスト${reqs}`);
console.log(`トークン in${tin}/out${tout}  概算 $${usd.toFixed(3)} = JPY ${(usd * 150).toFixed(0)}`);
console.log(`出力 -> data-build/_pilot_passages.json (レビュー後に採用判断)`);
