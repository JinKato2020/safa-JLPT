// 薄い大問を厚くする: 文法形式(grammar_form)と文脈規定(context)の cloze バンク。
//   実在の文法/語彙をseed。生成(mini)→検証→ _cloze_bank.jsonl。cloze=一意判定が容易で品質安定。
//   実行: node data-build/gen_cloze_bank.mjs   env: OPENAI_API_KEY
import { readFileSync, appendFileSync, writeFileSync, existsSync } from 'node:fs';
const KEY = process.env.OPENAI_API_KEY;
const MODEL = 'gpt-4o-mini';
const ROOT = 'c:/Users/jwpsa/Documents/desktop/claude/JLPTアプリ';
const DATA = ROOT + '/app/src/data';
const OUT = ROOT + '/data-build/_cloze_bank.jsonl';
if (!KEY) { console.error('OPENAI_API_KEY 未設定'); process.exit(1); }
const VOCAB = JSON.parse(readFileSync(DATA + '/vocab.json', 'utf8'));
const GRAMMAR = JSON.parse(readFileSync(DATA + '/grammar.json', 'utf8'));

// 厚くする目標数(本番10×＋余裕)。
const BP = {
  grammar_form: { N5: 90, N4: 150, N3: 130 },
  context: { N5: 100 },
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
const seeds = (daimon, lv, k) => daimon === 'context'
  ? shuffle(VOCAB.filter((v) => v.level === lv)).slice(0, k).map((v) => `${v.word}=${v.meaning.split(/[,、]/)[0]}`)
  : shuffle(GRAMMAR.filter((g) => g.level === lv)).slice(0, k).map((g) => `${g.point}=${g.meaning.split(/[,、]/)[0]}`);
function sys(daimon, lv) {
  const base = `あなたはJLPT${lv}の問題作成者。${furi(lv)}4択で正解は必ずchoices[0]、他3つは紛らわしいが文脈から明確に誤り(正解が一意)。explainは根拠1文。不適切禁止。`;
  const schema = `出力JSONのみ: {"items":[{"stem":"〔　〕を1か所含む自然な文","question":"...","choices":["正解","誤1","誤2","誤3"],"explain":"..."}]}`;
  const rule = daimon === 'context'
    ? `大問「文脈規定」: stem=日常的な自然文で1か所だけ〔　〕、question=「〔　〕に入れるのに最もよいものはどれですか。」、choices=語彙(名詞/動詞/形容詞/副詞)。文脈で正解が一意。題材語を正解に使う。`
    : `大問「文法形式の判断」: stem=自然文で1か所だけ〔　〕、question=「〔　〕に入れるのに最もよいものはどれですか。」、choices=文法形式(助詞/活用/文型/接続)。文に合うものが一意。題材の文法を正解に使う。`;
  return `${base}\n${rule}\n${schema}`;
}
const ok = (it) => it && it.stem && it.stem.includes('〔') && it.question && Array.isArray(it.choices) && it.choices.length === 4 && new Set(it.choices).size === 4 && it.explain;

(async () => {
  if (existsSync(OUT)) writeFileSync(OUT, '');
  let total = 0;
  const grand = Object.values(BP).reduce((a, m) => a + Object.values(m).reduce((x, y) => x + y, 0), 0);
  console.log(`cloズバンク生成: 目標${grand}問 model ${MODEL}`);
  for (const daimon of Object.keys(BP)) {
    for (const [lv, target] of Object.entries(BP[daimon])) {
      let made = 0, guard = 0;
      while (made < target && guard++ < target / 6 + 10) {
        const want = Math.min(8, target - made);
        let items;
        try { items = ((await chat(sys(daimon, lv), `${want}問。互いに重複しない。題材: ${JSON.stringify(seeds(daimon, lv, want + 3))}`)).items || []).slice(0, want).filter(ok); }
        catch (e) { console.log(`! ${daimon}/${lv}: ${String(e).slice(0, 50)}`); break; }
        if (!items.length) continue;
        let valid = items.map(() => true);
        try { const v = await chat(`JLPT${lv}「${daimon}」検証。各item ①〔　〕の正答(choices[0])が文脈から一意 ②他3択は明確に誤り ③${lv}相応 ④不適切なし。出力JSON {"v":[bool,...]}`, JSON.stringify(items.map((it) => ({ s: it.stem, q: it.question, c: it.choices }))), 0.1); if (Array.isArray(v.v)) valid = items.map((_, i) => v.v[i] !== false); } catch {}
        for (let i = 0; i < items.length && made < target; i++) {
          if (!valid[i]) continue; const it = items[i];
          appendFileSync(OUT, JSON.stringify({ level: lv, daimon, stem: it.stem, question: it.question, choices: it.choices, answer: it.choices[0], explain: it.explain }) + '\n');
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
