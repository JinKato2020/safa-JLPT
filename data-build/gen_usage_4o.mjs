// 用法バンクを gpt-4o で品質再生成。誤答は「明確な誤用」に限定=正答が一意。
//   出力 _usage_4o.jsonl (用法のみ・N4/N3 各50)。env: OPENAI_API_KEY
import { readFileSync, appendFileSync, writeFileSync, existsSync } from 'node:fs';
const KEY = process.env.OPENAI_API_KEY;
const MODEL = 'gpt-4o';
const ROOT = 'c:/Users/jwpsa/Documents/desktop/claude/JLPTアプリ';
const OUT = ROOT + '/data-build/_usage_4o.jsonl';
if (!KEY) { console.error('OPENAI_API_KEY 未設定'); process.exit(1); }
const VOCAB = JSON.parse(readFileSync(ROOT + '/app/src/data/vocab.json', 'utf8'));
const BP = { N4: 50, N3: 50 };
let tin = 0, tout = 0, reqs = 0;
async function chat(sys, user, temperature = 0.6) {
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
const sys = (lv) => `あなたはJLPT${lv}の「用法」問題作成者。語の正しい使い方を選ぶ問題を作る。${lv === 'N4' ? '漢字にふりがな(漢字（よみ）)。' : ''}
厳守:
- 各問、指定の語をすべての選択肢で使う。choices[0]=その語を【正しく自然に】使った文。
- 誤答3つ=その語を使うが【明確に誤用】(意味が合わない/接続が不自然/共起しない/品詞が違う 等、ネイティブが見て明らかに不自然)。
- 許容できる用法は choices[0] の1つだけ(正答が一意)。曖昧・複数正解は禁止。
- question=「『(語)』の使い方として最もよいものはどれですか。」 stemは空文字。explain=なぜ他が誤用かを簡潔に。
出力JSONのみ: {"items":[{"word":"語","question":"...","choices":["正用法の文","誤用1","誤用2","誤用3"],"explain":"..."}]}`;
const ok = (it) => it && it.question && Array.isArray(it.choices) && it.choices.length === 4 && new Set(it.choices).size === 4 && it.explain;

(async () => {
  if (existsSync(OUT)) writeFileSync(OUT, '');
  let total = 0; const grand = Object.values(BP).reduce((a, b) => a + b, 0);
  console.log(`用法4o再生成: 目標${grand}問 model ${MODEL}`);
  for (const [lv, target] of Object.entries(BP)) {
    let made = 0, guard = 0;
    while (made < target && guard++ < target / 4 + 12) {
      const want = Math.min(5, target - made);
      const seed = shuffle(VOCAB.filter((v) => v.level === lv)).slice(0, want).map((v) => `${v.word}=${v.meaning.split(/[,、]/)[0]}`);
      let items;
      try { items = ((await chat(sys(lv), `${want}問。語: ${JSON.stringify(seed)} を各1問。互いに重複しない。`)).items || []).slice(0, want).filter(ok); }
      catch (e) { console.log(`! ${lv}: ${String(e).slice(0, 50)}`); break; }
      if (!items.length) continue;
      // 厳格検証(4o): choices[0]だけが正しい用法か
      let valid = items.map(() => true);
      try { const v = await chat(`JLPT${lv}用法問題の検証。各itemで choices[0]だけが語の正しい自然な用法で、他3つは明確な誤用か。許容できる用法が2つ以上ならfalse。出力JSON {"v":[bool,...]}`, JSON.stringify(items.map((it) => ({ q: it.question, c: it.choices }))), 0.1); if (Array.isArray(v.v)) valid = items.map((_, i) => v.v[i] !== false); } catch {}
      for (let i = 0; i < items.length && made < target; i++) {
        if (!valid[i]) continue; const it = items[i];
        appendFileSync(OUT, JSON.stringify({ level: lv, daimon: 'usage', stem: '', question: it.question, choices: it.choices, answer: it.choices[0], explain: it.explain }) + '\n');
        made++;
      }
    }
    total += made; const usd = tin / 1e6 * 2.5 + tout / 1e6 * 10;
    console.log(`✓ usage ${lv}: ${made}/${target} [累計${total}/${grand} ¥${(usd * 150).toFixed(0)}]`);
  }
  const usd = tin / 1e6 * 2.5 + tout / 1e6 * 10;
  console.log(`=== 完了 ${total}/${grand} ・ req${reqs} ・ ¥${(usd * 150).toFixed(0)} -> ${OUT}`);
})();
