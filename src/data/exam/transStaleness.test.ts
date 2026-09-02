import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

// ── 翻訳ズレ番人 ───────────────────────────────────────────────────────────
// 日本語(正本)を改定したのに en/ne 訳が古いまま、という事故を止める。
// 種 = src/data/exam/transSrcHash.json (tools/trans_staleness.py が生成)。
//   baseline[unitKey] = 訳作成時点の 正規化日本語hash。
//   knownStale        = 現時点で既知の「訳が古い」unitKey(=既知の借金)。
// このテストは現在の日本語hashを再計算し、baseline と食い違う unit(=stale)を集める。
// stale集合が knownStale と一致していれば緑。日本語を直して訳を放置すると新しい stale が
// 増えて赤くなる → その場で訳も直す(or 意図的なら python tools/trans_staleness.py で種を再生成)。
//
// ★ 種を再生成したら KNOWN_STALE は自動で追随する(このテストは json から読む)。
//    Python(norm) と TS(norm) は同じ正規化でなければならない。もし食い違えば
//    大量の unit が baseline と不一致になり、このテストが即座に落ちて気づける。
// ──────────────────────────────────────────────────────────────────────────

type Seed = { baseline: Record<string, string>; knownStale: string[] };
const seed: Seed = JSON.parse(readFileSync(join('src', 'data', 'exam', 'transSrcHash.json'), 'utf8'));

// --- 正規化 (tools/trans_staleness.py の norm と一致させること) ---
const RUBY = /[（(]\s*[぀-ヿー]+\s*[）)]/g; // かなだけの丸カッコ = ふりがな
const SEP = '\n'; // 配列連結の区切り。tools/trans_staleness.py の SEP と一致させること。
function canonNum(s: string): string {
  s = s.replace(/[０-９]/g, (d) => String('０１２３４５６７８９'.indexOf(d)));
  s = s.replace(/(?<=\d),(?=\d{3}(?!\d))/g, '');
  const unit: Record<string, number> = { 千: 1000, 万: 10000, 億: 100000000 };
  s = s.replace(/(\d+)([千万億])/g, (_m, n, u) => String(Number(n) * unit[u]));
  return s;
}
function norm(v: unknown): string {
  let s = '';
  if (v == null) s = '';
  else if (Array.isArray(v)) s = v.map((x) => (x == null ? '' : String(x))).join(SEP);
  else s = String(v);
  s = s.replace(RUBY, '');
  s = canonNum(s);
  s = s.replace(/\s+/g, '');
  return s;
}
function h(s: string): string {
  return createHash('sha1').update(s, 'utf8').digest('hex').slice(0, 12);
}

// --- item から翻訳 unit を列挙 (Python の units_for_item と一致させること) ---
function explainSource(it: any): unknown {
  const ja = (it.i18n || {}).ja || {};
  if (ja.explain) return ja.explain;
  const fb = [it.stem || '', it.question || '', it.answer || '', ...(it.choices || [])];
  return fb.join(SEP);
}
// (unitKey suffix, ja source, langsPresent[])
function unitsForItem(it: any): Array<[string, unknown, string[]]> {
  const i18n = it.i18n || {};
  const out: Array<[string, unknown, string[]]> = [];
  const langsWith = (obj: any, k: string) => ['en', 'ne'].filter((l) => obj[l] && obj[l][k] != null);
  if (langsWith(i18n, 'body').length) out.push(['body', it.body, langsWith(i18n, 'body')]);
  if (langsWith(i18n, 'explain').length) out.push(['explain', explainSource(it), langsWith(i18n, 'explain')]);
  for (const q of it.questions || []) {
    const qi = q.i18n || {};
    if (langsWith(qi, 'q').length) out.push([`q:${q.id}:q`, q.question, langsWith(qi, 'q')]);
    if (langsWith(qi, 'choices').length) out.push([`q:${q.id}:choices`, q.choices, langsWith(qi, 'choices')]);
  }
  return out;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.json')) out.push(p);
  }
  return out;
}

// 現在の日本語から stale unit を算出
function currentStale(): { stale: string[]; missingBaseline: string[] } {
  const stale: string[] = [];
  const missingBaseline: string[] = [];
  for (const f of walk(join('content', 'problems'))) {
    const doc = JSON.parse(readFileSync(f, 'utf8'));
    for (const it of doc.items || []) {
      for (const [suffix, src, langs] of unitsForItem(it)) {
        const curHash = h(norm(src));
        for (const lang of langs) {
          const key = `${it.id}|${suffix}|${lang}`;
          const base = seed.baseline[key];
          if (base === undefined) missingBaseline.push(key);
          else if (base !== curHash) stale.push(key);
        }
      }
    }
  }
  return { stale, missingBaseline };
}

const { stale, missingBaseline } = currentStale();
const known = new Set(seed.knownStale);

test('翻訳の種(baseline)が全翻訳unitを網羅している', () => {
  // 新しい翻訳を足したのに種を再生成していない場合ここで気づく
  assert.equal(
    missingBaseline.length,
    0,
    `baseline未登録の翻訳unitが ${missingBaseline.length} 件。` +
      `翻訳を追加したら python tools/trans_staleness.py で種を再生成すること。例: ${missingBaseline.slice(0, 5)}`,
  );
});

test('日本語を改定して訳を放置した新しいズレが増えていない', () => {
  const added = stale.filter((k) => !known.has(k)); // 新規に古くなった訳
  assert.equal(
    added.length,
    0,
    `日本語を直したのに en/ne 訳が古いままの unit が新たに ${added.length} 件。` +
      `訳も直す(推奨) か、意図的な改定なら python tools/trans_staleness.py で種を再生成すること。例: ${added.slice(0, 8)}`,
  );
});

test('解消済みの既知ズレは種を更新する', () => {
  const resolved = seed.knownStale.filter((k) => !stale.includes(k)); // もう stale でない
  assert.equal(
    resolved.length,
    0,
    `既知ズレ ${resolved.length} 件が解消済み。訳を直したなら python tools/trans_staleness.py で種を再生成して knownStale から外すこと。例: ${resolved.slice(0, 8)}`,
  );
});
