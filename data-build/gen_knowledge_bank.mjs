// 知識区分のうち実データから作れない3大問(用法/文の組み立て/文章の文法)をバンク生成。
//   生成(gpt-4o-mini)→検証→ _knowledge_bank.jsonl。各 daimon=blueprint×MULT。seed=実vocab/grammar。
//   実行: node data-build/gen_knowledge_bank.mjs [mult=10]   env: OPENAI_API_KEY
import { readFileSync, appendFileSync, writeFileSync, existsSync } from 'node:fs';
const KEY = process.env.OPENAI_API_KEY;
const MODEL = 'gpt-4o-mini';
const ROOT = 'c:/Users/jwpsa/Documents/desktop/claude/JLPTアプリ';
const DATA = ROOT + '/app/src/data';
const MULT = Number(process.argv[2] ?? 10);
const OUT = ROOT + '/data-build/_knowledge_bank.jsonl';
if (!KEY) { console.error('OPENAI_API_KEY 未設定'); process.exit(1); }
const VOCAB = JSON.parse(readFileSync(DATA + '/vocab.json', 'utf8'));
const GRAMMAR = JSON.parse(readFileSync(DATA + '/grammar.json', 'utf8'));

// 大問別 本番出題数(blueprint)。
const BP = {
  usage: { N4: 5, N3: 5 },
  order: { N5: 4, N4: 5, N3: 5 },
  passage_grammar: { N5: 4, N4: 5, N3: 5 },
};
let tin = 0, tout = 0, reqs = 0;
async function chat(sys, user, temperature = 0.7) {
  reqs++;
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: MODEL, temperature, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: sys }, { role: 'user', content: user }] }) });
      const d = await r.json(); if (!d.choices) throw new Error(JSON.stringify(d).slice(0, 150));
      tin += d.usage?.prompt_tokens || 0; tout += d.usage?.completion_tokens || 0;
      return JSON.parse(d.choices[0].message.content);
    } catch (e) { if (a === 2) throw e; await new Promise((s) => setTimeout(s, 1500)); }
  }
}
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; };
const furi = (lv) => (lv === 'N5' || lv === 'N4' ? '漢字にふりがな(漢字（よみ）)。' : '');
function seeds(daimon, lv, k) {
  if (daimon === 'usage') return shuffle(VOCAB.filter((v) => v.level === lv)).slice(0, k).map((v) => `${v.word}=${v.meaning.split(/[,、]/)[0]}`);
  return shuffle(GRAMMAR.filter((g) => g.level === lv)).slice(0, k).map((g) => `${g.point}=${g.meaning.split(/[,、]/)[0]}`);
}
function sys(daimon, lv) {
  const base = `あなたはJLPT${lv}の問題作成者。${furi(lv)}4択で正解は必ずchoices[0]、他3つは紛らわしいが明確な誤り(一意)。explainは根拠1文。不適切禁止。`;
  const schema = `出力JSONのみ: {"items":[{"stem":"...","question":"...","choices":["正解","誤1","誤2","誤3"],"explain":"..."}]}`;
  let rule;
  if (daimon === 'usage') rule = `大問「用法」: question=「『(語)』の使い方が正しい文は？」、choices=その語を使った4文(正解1=正用法・誤3=誤用法)。stemは空文字。題材語: 各問1語ずつ使う。`;
  else if (daimon === 'order') rule = `大問「文の組み立て」: 語句を並べ替える問題。stem=「★」を1か所含む文(他は通常文)、その下に並べ替える4つの語句を「／」で示す。question=「★に入るのは？」、choices=4語句のうち★位置に来るもの(正解=choices[0])。自然な文・一意に決まること。`;
  else rule = `大問「文章の文法」: stem=2〜3文の短い文章で1か所〔　〕、question=「〔　〕に入る最も適切なものは？」、choices=文法表現。文脈の流れで一意。`;
  return `${base}\n${rule}\n${schema}`;
}
const ok = (it) => it && it.question && Array.isArray(it.choices) && it.choices.length === 4 && new Set(it.choices).size === 4 && it.explain;

(async () => {
  if (existsSync(OUT)) writeFileSync(OUT, '');
  let total = 0;
  const grand = Object.values(BP).reduce((a, m) => a + Object.values(m).reduce((x, y) => x + y * MULT, 0), 0);
  console.log(`知識バンク生成: 目標${grand}問(×${MULT}) model ${MODEL}`);
  for (const daimon of Object.keys(BP)) {
    for (const [lv, c] of Object.entries(BP[daimon])) {
      const target = c * MULT; let made = 0, guard = 0;
      while (made < target && guard++ < target / 4 + 8) {
        const want = Math.min(6, target - made);
        let items;
        try { items = ((await chat(sys(daimon, lv), `${want}問。互いに重複しない。題材: ${JSON.stringify(seeds(daimon, lv, want + 2))}`)).items || []).slice(0, want).filter(ok); }
        catch (e) { console.log(`! ${daimon}/${lv}: ${String(e).slice(0, 50)}`); break; }
        if (!items.length) continue;
        let valid = items.map(() => true);
        try { const v = await chat(`JLPT${lv}「${daimon}」検証。各item ①正答(choices[0])が正しく一意 ②${lv}相応 ③不適切なし。出力JSON {"v":[bool,...]}`, JSON.stringify(items.map((it) => ({ q: it.question, c: it.choices }))), 0.1); if (Array.isArray(v.v)) valid = items.map((_, i) => v.v[i] !== false); } catch {}
        for (let i = 0; i < items.length && made < target; i++) {
          if (!valid[i]) continue; const it = items[i];
          appendFileSync(OUT, JSON.stringify({ level: lv, daimon, stem: it.stem || '', question: it.question, choices: it.choices, answer: it.choices[0], explain: it.explain }) + '\n');
          made++;
        }
      }
      total += made;
      const usd = tin / 1e6 * 0.15 + tout / 1e6 * 0.6;
      console.log(`✓ ${daimon} ${lv}: ${made}/${target} [累計${total}/${grand} ¥${(usd * 150).toFixed(0)}]`);
    }
  }
  const usd = tin / 1e6 * 0.15 + tout / 1e6 * 0.6;
  console.log(`=== 完了 ${total}/${grand} ・ req${reqs} ・ ¥${(usd * 150).toFixed(0)} -> ${OUT}`);
})();
