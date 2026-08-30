// 用法【模試プール】(pool='mock')のダミーが「ワンパターン」でないかの番人。
// 学習用(src/data/usageDistractor.test.ts)と同じ P1/P2 を、模試専用プールにも独立適用する。
// 実行: node --import tsx --test src/data/usageMockDistractor.test.ts
// タグ元: src/data/shared/usageMockDistractorTags.json (独立QA=Opusタグ付け+違反修正済)。
//   誤答は choices[0]=正解 を除いた choices[1..] の順で対応。
// P1(ハード): 1問内で repl(置換語)がユニーク(自他2連発を締め出す)。※模試は既知違反allowなし=常に緑必須。
// P2(ハード): 3ダミーの type が全同型でない(2種以上)。選択制限型/否定呼応型の正当な単一型のみ monoTypeAllow。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const R = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
type Tag = { repl: string; type: string };
type Item = { id: string; answer: string; choices: string[] };
const LEVELS = ['N4', 'N3'] as const; // N5に用法は無い
const TYPEVOCAB = new Set(['自他', '別義', '近接', '選択', 'コロケ', '対義', '呼応', '授受']);

const side: { monoTypeAllow: string[]; tags: Record<string, Tag[]> } = R(
  join('src/data/shared/usageMockDistractorTags.json'),
);
const mono = new Set(side.monoTypeAllow ?? []);
const itemsOf = (lv: string): Item[] => R(join('content/problems/moji_goi/mock', `usage_${lv}.json`)).items;
const allItems = () => LEVELS.flatMap((lv) => itemsOf(lv));
const distractorsOf = (it: Item) => it.choices.filter((c) => c !== it.answer);

test('カバー: 模試の4択(誤答3)全itemがタグ登録されている', () => {
  for (const it of allItems()) {
    assert.equal(it.choices.length, 4, `${it.id}: 4択でない`);
    assert.ok(side.tags[it.id], `未タグ: ${it.id} → tools/tag_usage_mock 等でタグ付けを`);
  }
});

test('タグ整合: type語彙が正当 かつ 誤答数=タグ数=3', () => {
  for (const it of allItems()) {
    const tg = side.tags[it.id];
    if (!tg) continue;
    assert.equal(tg.length, 3, `タグ数が3でない: ${it.id} (${tg.length})`);
    assert.equal(distractorsOf(it).length, 3, `誤答数が3でない: ${it.id}`);
    for (const t of tg) assert.ok(TYPEVOCAB.has(t.type), `未知の殺し方type: ${it.id} "${t.type}"`);
  }
});

test('P1(ハード): 1問内で置換語replがユニーク(自他2連発を締め出す)', () => {
  for (const it of allItems()) {
    const tg = side.tags[it.id];
    if (!tg) continue;
    const repls = tg.map((t) => t.repl);
    assert.equal(new Set(repls).size, repls.length, `置換語が重複(ワンパターン): ${it.id} [${repls.join(' / ')}]`);
  }
});

test('P2(ハード): 3ダミーの殺し方typeが全同型でない(単一型はmonoTypeAllowのみ)', () => {
  for (const it of allItems()) {
    const tg = side.tags[it.id];
    if (!tg) continue;
    const kinds = new Set(tg.map((t) => t.type));
    if (mono.has(it.id)) assert.equal(kinds.size, 1, `monoTypeAllowだが単一型でない: ${it.id}`);
    else assert.ok(kinds.size >= 2, `殺し方が全て同型(ワンパターン): ${it.id} [${[...kinds].join(',')}]`);
  }
});
