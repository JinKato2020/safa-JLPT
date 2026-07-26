// 案A(gpt-4o) vs 案B(gpt-4o-mini) 比較生成。各モデルで読解5＋聴解5。検証は共通(gpt-4o)で揃える。
// 全生成item＋検証結果(合格/不合格+理由)を _compare.json に出力(全件=品質を目で比較するため)。使い捨て検証用。
import { readFileSync, writeFileSync } from 'node:fs';
const KEY = process.env.OPENAI_API_KEY;
const LEVEL = 'N4', N = 5;
const D = 'c:/Users/jwpsa/Documents/desktop/claude/JLPTアプリ/app/src/data';
if (!KEY) { console.error('OPENAI_API_KEY 未設定'); process.exit(1); }
const reading = JSON.parse(readFileSync(D + '/reading.json', 'utf8'));
const listening = JSON.parse(readFileSync(D + '/listening.json', 'utf8'));
const titlesR = reading.filter((x) => x.level === LEVEL).map((x) => x.title);
const titlesL = listening.filter((x) => x.level === LEVEL).map((x) => x.title);

let tin = 0, tout = 0;
async function chat(model, system, user, temperature) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, temperature, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
  });
  const d = await r.json();
  if (!d.choices) throw new Error('API: ' + JSON.stringify(d).slice(0, 200));
  tin += d.usage?.prompt_tokens || 0; tout += d.usage?.completion_tokens || 0;
  return JSON.parse(d.choices[0].message.content);
}
const SYS_R = `あなたはJLPT/JFT-Basic教材の作成者。${LEVEL}レベルの読解問題を作る。
- 場面=生活can-do(駅/病院/役所/店/職場/学校/家庭/お知らせ/メール/掲示/説明書/情報検索/案内)。実用的で自然。${LEVEL}相応・日常的・約100〜140字。
- 漢字に必ず ふりがな を「漢字（よみ）」で付ける。
- 設問1つ・4択。正解を必ず choices[0]。残り3つは紛らわしいが本文から明確に誤り(一意に決まる)。explain=根拠1文。不適切内容禁止。
出力JSONのみ: {"items":[{"format":"...","title":"...","body":"...","q":"...","choices":["正解","誤1","誤2","誤3"],"explain":"..."}]}`;
const SYS_L = `あなたはJLPT/JFT-Basic教材の作成者。${LEVEL}レベルの聴解(台本)を作る。
- 場面=日常会話/店・公共機関/指示・アナウンス/社交。${LEVEL}相応・短め(2〜5ターン)。
- 台本は話者ラベル「女（おんな）：」「男（おとこ）：」「店員：」「客：」「係員：」「アナウンス：」等で始め、ターン間は全角スペース「　」。漢字にふりがな。
- 設問1つ・4択。正解を必ず choices[0]。explain=根拠1文。qtype=課題理解/ポイント理解/概要理解/即時応答/指示・アナウンス/店・公共機関 のいずれか。不適切禁止。
出力JSONのみ: {"items":[{"qtype":"...","title":"...","script":"女（おんな）：…　男（おとこ）：…","q":"...","choices":["正解","誤1","誤2","誤3"],"explain":"..."}]}`;
const verSys = (kind) => `JLPT${kind === 'r' ? '読解' : '聴解'}問題を厳しく検証。基準:①${kind === 'r' ? '本文' : '台本'}だけで正解が一意に決まる ②choices[0]が正しい ③他3択は明確に誤り(複数正解/曖昧はNG) ④${LEVEL}相応 ⑤不適切なし ⑥ふりがな${kind === 'l' ? '・話者ラベル' : ''}。1つでも欠ければvalid:false。出力JSON: {"verdicts":[{"i":0,"valid":true,"reason":"短く"}]}`;

const all = [];
for (const model of ['gpt-4o', 'gpt-4o-mini']) {
  const tag = model === 'gpt-4o' ? '案A(4o)' : '案B(mini)';
  for (const kind of ['r', 'l']) {
    const g = await chat(model, kind === 'r' ? SYS_R : SYS_L, `${N}問。既存タイトルと重複しない: ${JSON.stringify(kind === 'r' ? titlesR : titlesL)}`, 0.7);
    const items = (g.items || []).slice(0, N);
    let verdicts = [];
    try { verdicts = (await chat('gpt-4o', verSys(kind), JSON.stringify(items.map((it, i) => ({ i, ...it }))), 0.1)).verdicts || []; } catch {}
    const vmap = new Map(verdicts.map((x) => [x.i, x]));
    items.forEach((it, i) => { const v = vmap.get(i) || {}; all.push({ tag, model, kind: kind === 'r' ? '読解' : '聴解', it, valid: !!v.valid, reason: v.reason || '' }); });
    console.log(`${tag} ${kind === 'r' ? '読解' : '聴解'}: 生成${items.length} 合格${items.filter((_, i) => (vmap.get(i) || {}).valid).length}`);
  }
}
writeFileSync('c:/Users/jwpsa/Documents/desktop/claude/JLPTアプリ/data-build/_compare.json', JSON.stringify(all, null, 2) + '\n');
const usd = tin / 1e6 * 2.5 + tout / 1e6 * 10; // 4o基準の概算(miniは実際もっと安い)
console.log(`計${all.length}件 -> _compare.json  概算 ${'$' + usd.toFixed(3)} = JPY ${(usd * 150).toFixed(0)} (上限見積)`);
