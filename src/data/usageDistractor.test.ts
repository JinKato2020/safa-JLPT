// 用法(語の使い方)のダミー選択肢が「ワンパターン」でないかの番人。
// 実行: node --import tsx --test src/data/usageDistractor.test.ts
// 背景: 自他ペア等で3ダミーの2つが同じ殺し方(=同じ置換語)になると、学習者が
//   「自他のワナ」と気づいた瞬間パターンで解けてしまい弁別を測れない(05_用法.md:37)。
//   公式N4は同じ語でも別義/コロケーション/選択制限を混ぜて外す。これを仕組みで担保する。
// タグ元: src/data/shared/usageDistractorTags.json (repl=確認用Excel由来 / type=人手レビュー)。
//   ※アプリは読まない純・作問QAデータ。誤答は choices[0]=正解 を除いた choices[1..] の順で対応。
// 2パラメータ:
//   P1(客観・ハード): 1問内で repl(置換語=その誤答が正しくなる語)がユニーク。
//     └ 自他2連発は必ず同一置換語になるのでここで落ちる。既知違反は knownDupRepl(縮小のみ)。
//   P2(殺し方分散・ハード): 1問の3ダミーの type が全同型でない(=2種以上)。
//     └ 選択制限型/否定呼応型など公式が認める単一型の良問だけ monoTypeAllow で明示例外。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const R = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
type Tag = { repl: string; type: string };
type Item = { id: string; answer: string; choices: string[] };
const DAIMON = ['N4', 'N3'] as const;
const TYPEVOCAB = new Set(['自他', '別義', '近接', '選択', 'コロケ', '対義', '呼応', '授受']);

const side: {
  monoTypeAllow: string[];
  knownDupRepl: string[];
  tags: Record<string, Tag[]>;
  legacyAllowlist: string[];
} = R(join('src/data/shared/usageDistractorTags.json'));
const mono = new Set(side.monoTypeAllow);
const knownDup = new Set(side.knownDupRepl);
const legacy = new Set(side.legacyAllowlist);

const itemsOf = (lv: string): Item[] =>
  R(join('content/problems/moji_goi', `usage_${lv}.json`)).items;
const allItems = () => DAIMON.flatMap((lv) => itemsOf(lv));
const distractorsOf = (it: Item) => it.choices.filter((c) => c !== it.answer);

test('カバー: 4択(誤答3)の全itemが タグ登録 or legacyAllowlist(新規は必ずタグ必須)', () => {
  for (const it of allItems()) {
    if (it.choices.length !== 4) continue; // 旧型5-7択は対象外(段階移行)
    assert.ok(
      side.tags[it.id] || legacy.has(it.id),
      `4択itemが未タグ: ${it.id}。tools/build_usage_distractor_tags.py でタグ付けするか legacyAllowlist へ`,
    );
  }
});

test('タグ整合: type語彙が正当 かつ 誤答数=タグ数=3', () => {
  for (const it of allItems()) {
    const tg = side.tags[it.id];
    if (!tg) continue;
    const nd = distractorsOf(it).length;
    assert.equal(tg.length, 3, `タグ数が3でない: ${it.id} (${tg.length})`);
    assert.equal(nd, 3, `誤答数が3でない(選択肢構成変更?): ${it.id} (${nd})`);
    for (const t of tg)
      assert.ok(TYPEVOCAB.has(t.type), `未知の殺し方type: ${it.id} "${t.type}"`);
  }
});

test('P1(ハード): 1問内で置換語replがユニーク(自他2連発を締め出す)', () => {
  for (const it of allItems()) {
    const tg = side.tags[it.id];
    if (!tg) continue;
    const repls = tg.map((t) => t.repl);
    const isDup = new Set(repls).size < repls.length;
    if (knownDup.has(it.id)) {
      // 既知違反(ラチェット): 直ったら knownDupRepl から外す
      assert.ok(isDup, `直済なのに knownDupRepl に残存: ${it.id} → リストから削除せよ`);
    } else {
      assert.ok(!isDup, `置換語が重複(ワンパターン): ${it.id} [${repls.join(' / ')}] → 1つを別タイプの誤答へ差替`);
    }
  }
});

test('P2(ハード): 3ダミーの殺し方typeが全同型でない(単一型はmonoTypeAllowのみ)', () => {
  for (const it of allItems()) {
    const tg = side.tags[it.id];
    if (!tg) continue;
    const kinds = new Set(tg.map((t) => t.type));
    if (mono.has(it.id)) {
      // 明示例外(選択制限型/否定呼応型): 本当に単一型か(緩んだら外す)
      assert.equal(kinds.size, 1, `monoTypeAllowだが単一型でない: ${it.id} → リストから外すか設計見直し`);
    } else {
      assert.ok(kinds.size >= 2, `殺し方が全て同型(ワンパターン): ${it.id} [${[...kinds].join(',')}] → 1つを別タイプへ`);
    }
  }
});
