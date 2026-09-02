import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// ── 解説・翻訳の方針 番人 ─────────────────────────────────────────────────
// ユーザー確定(2026-09-02):
//   (1) 解説は不要 … 文脈規定/漢字読み/表記/言い換え/用法 の5大問は item.i18n.<lang>.explain を持たない。
//       (これらは下線語・空所の解読/選択の課題で、解説文は出さない方針)
//   (2) 翻訳は不要 … 漢字読み/表記 は i18n の翻訳(en/ne)を一切持たない(本文が下線語の解読課題ゆえ)。
// content JSON に explain / 翻訳が再混入したらここで落ちる(方針の逆戻り防止)。
// 各大問md(01〜05)にも同方針を明記。仕組みの正本はこのテスト。
// ──────────────────────────────────────────────────────────────────────────

// 解説不要の大問。naiyou_tan(読解内容理解 短)は設問(question)レベルの解説を持たない。
// ※文の組み立て(order)は explain=「回答後に見せる正しい並びの文＋母語訳」で解説ではないため対象外(維持)。
const NO_EXPLAIN = new Set(['context', 'kanji_read', 'orthography', 'synonym', 'usage', 'naiyou_tan']);
const NO_TRANS = new Set(['kanji_read', 'orthography']);
const TRANS_LANGS = ['en', 'ne'];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.json') && e !== '_manifest.json') out.push(p);
  }
  return out;
}

type I18n = Record<string, Record<string, unknown>>;
type Q = { id: string; i18n?: I18n };
type Doc = { daimon?: string; items?: Array<{ id: string; i18n?: I18n; questions?: Q[] }> };
const files = walk(join('content', 'problems')).map((f) => [f, JSON.parse(readFileSync(f, 'utf8')) as Doc] as const);

const hasExplain = (i18n: I18n | undefined): boolean =>
  Object.values(i18n ?? {}).some((obj) => obj && typeof obj === 'object' && 'explain' in obj);

test('解説不要: 文脈規定/漢字読み/表記/言い換え/用法/内容理解(短) に explain が無い', () => {
  const bad: string[] = [];
  for (const [f, doc] of files) {
    if (!doc.daimon || !NO_EXPLAIN.has(doc.daimon)) continue;
    for (const it of doc.items ?? []) {
      if (hasExplain(it.i18n)) bad.push(`${it.id} item.explain (${f})`); // item(語彙系)
      for (const q of it.questions ?? []) if (hasExplain(q.i18n)) bad.push(`${q.id} q.explain (${f})`); // 設問(読解)
    }
  }
  assert.equal(bad.length, 0, `解説(explain)が残っている箇所が ${bad.length} 件。対象6大問は解説不要(2026-09-02確定)。例: ${bad.slice(0, 8)}`);
});

test('翻訳不要: 漢字読み/表記 に en/ne の翻訳が無い', () => {
  const bad: string[] = [];
  for (const [f, doc] of files) {
    if (!doc.daimon || !NO_TRANS.has(doc.daimon)) continue;
    for (const it of doc.items ?? []) {
      for (const lang of TRANS_LANGS) {
        const obj = it.i18n?.[lang];
        if (obj && Object.keys(obj).length) bad.push(`${it.id}#${lang} (${f})`);
      }
    }
  }
  assert.equal(bad.length, 0, `漢字読み/表記 に翻訳(en/ne)が残っている item が ${bad.length} 件。両大問は翻訳不要(2026-09-02確定)。例: ${bad.slice(0, 8)}`);
});
