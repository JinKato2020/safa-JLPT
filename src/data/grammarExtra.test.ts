// 【番人】文法辞書の「追加例文」(grammarExtra.json)の健全性を保証する。
//   ・N3 の全文法点に、既存例文とは別バリエーションの追加例文が「ちょうど2つ」ある
//   ・各例文は ja(ルビ付き)・en・10言語訳(tr) がそろう / 既存 exampleJa や相互と重複しない
//   ・想定外(N3文法点でない)キーを混ぜない
// これで「一部の点だけ訳が抜けた」「焼き直し例文が紛れた」等をビルド時に検知する。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GRAMMAR } from './index.ts';
import extra from './shared/grammarExtra.json';

const TR_LANGS = ['ne', 'id', 'bn', 'ko', 'my', 'th', 'vi', 'zh', 'zh2', 'hi'] as const;
type Ex = { ja: string; en: string; tr: Record<string, string> };
const DATA = extra as Record<string, Ex[]>;
const stripFuri = (s: string) => s.replace(/（[^）]*）/g, '');
const hasRuby = (s: string) => /[一-龥][々〆ヶ]?（[ぁ-んァ-ヶー・]+）/.test(s);

// 対象=N5/N4/N3 の全文法点(辞書に載る級)。追加例文はこの3級すべてに2つずつ。
const pts = GRAMMAR.filter((g) => /^n[345]-g-/.test(g.id));
const primById = new Map(pts.map((g) => [g.id, g]));

test('N5/N4/N3の全文法点に追加例文がちょうど2つある', () => {
  const missing = pts.filter((g) => (DATA[g.id]?.length ?? 0) !== 2).map((g) => `${g.id}:${DATA[g.id]?.length ?? 0}`);
  assert.deepEqual(missing, [], '各文法点に追加例文2つが必要(不足/過剰を検知)');
});

test('想定外キー(N5/N4/N3文法点でない)を混ぜない', () => {
  const stray = Object.keys(DATA).filter((k) => !primById.has(k));
  assert.deepEqual(stray, [], 'grammarExtra は N5/N4/N3 文法点idのみ');
});

test('各追加例文は ja(ルビ)・en・10言語訳がそろい、既存/相互と重複しない', () => {
  const problems: string[] = [];
  for (const g of pts) {
    const arr = DATA[g.id] ?? [];
    const prim = stripFuri(g.exampleJa);
    const seen = new Set<string>();
    arr.forEach((ex, i) => {
      const tag = `${g.id}#${i}`;
      if (!ex.ja) problems.push(`${tag}: ja空`);
      else if (!hasRuby(ex.ja) && /[一-龥]/.test(ex.ja)) problems.push(`${tag}: 漢字にルビ無し`);
      if (!ex.en) problems.push(`${tag}: en空`);
      for (const l of TR_LANGS) if (!ex.tr?.[l]) problems.push(`${tag}: 訳欠落(${l})`);
      const sp = stripFuri(ex.ja);
      if (sp && sp === prim) problems.push(`${tag}: 既存例文と同一`);
      if (sp && seen.has(sp)) problems.push(`${tag}: 相互で重複`);
      seen.add(sp);
    });
  }
  assert.deepEqual(problems.slice(0, 30), [], `追加例文の不備 ${problems.length}件`);
});
