// 【今後の作問除外・永久】動詞の丁寧形・時制(ます/ました/ません/ましょう)だけを問う語は
// これ以上 文法点として増やさない(学習効果が薄く設問数を水増しするだけ)。既存は n5-g-87 の1点に集約。
// CLAUDE.md §1 の永久ルール。この番人が「バラ活用形だけの文法点」の新規追加を検知して止める。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GRAMMAR } from './index.ts';

// 文法の form が「ます/ました/ません/ませんでした/ましょう」の羅列だけ(説明文なし)なら除外対象。
// 集約点 n5-g-87 は説明入り("動詞の丁寧形・時制(…)")なので自然に非該当。
function isBareTenseForm(form: string): boolean {
  const parts = form.replace(/（[^）]*）/g, '').split(/[／/・、,]/).map((s) => s.trim()).filter(Boolean);
  return parts.length > 0 && parts.every((p) => /^(ます|ました|ません|ませんでした|ましょう)$/.test(p));
}

test('動詞の丁寧形・時制のバラ活用点は増やさない(n5-g-87に集約)', () => {
  const offenders = GRAMMAR.filter((g) => g.id !== 'n5-g-87' && isBareTenseForm(g.point));
  assert.deepEqual(
    offenders.map((g) => `${g.id}:${g.point}`),
    [],
    '丁寧形・時制だけの文法点は n5-g-87 のみ。新規追加は CLAUDE.md §1 の永久ルールで禁止。',
  );
});
