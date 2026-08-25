// 用法(語の使い方)大問が語彙idを「バランスよく」カバーしているかの番人。
// 実行: node --import tsx --test src/data/usageCoverage.test.ts
// 最終目標=可能な限り語彙をカバー(breadth%→100%)。この番人はそこへ後退なく近づくための3不変条件を守る:
//   ①測定可能: 全itemが有効なvocabId(存在・級≤大問級)を持つ or 未収録stemは許容リストに明示(未紐づけの放置=測定不能を禁止)
//   ②1語彙id=1問(全大問通算): 重複禁止=問題数はカバー語彙id数と一致(同じ語に積む前に未カバー語へ=均等に広く)
//   ③後退させない(ラチェット): カバー語数は基準(usageCoverage.json)を下回らない。基準の引き上げは
//      `python tools/usage_coverage_report.py --set-baseline`(記録=在庫Excel「⑤ 用法カバー×バランス」も同時更新)。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const R = (p: string) => JSON.parse(readFileSync(join('src/data', p), 'utf8'));
type V = { id: string; level: 'N5' | 'N4' | 'N3' };
type Item = { id: string; stem: string; vocabId?: string };
const vocab: V[] = R('shared/vocab.json');
const lvlOf = new Map(vocab.map((v) => [v.id, v.level]));
const RANK: Record<string, number> = { N5: 0, N4: 1, N3: 2 };
const DAIMON_LEVELS = ['N4', 'N3'] as const; // 用法はN4/N3のみ(N5に用法大問は無い)

const base: {
  baseline: Record<string, { covered: number; total: number }>;
  unlinkedAllowlist: string[];
} = R('shared/usageCoverage.json');
const allow = new Set(base.unlinkedAllowlist);

const itemsOf = (lv: string): Item[] => R(`../../content/problems/moji_goi/usage_${lv}.json`).items;

test('①測定可能: 全itemが有効vocabId(級≤大問級) or 未収録stemは許容リストに明示', () => {
  for (const dlv of DAIMON_LEVELS) {
    for (const it of itemsOf(dlv)) {
      assert.ok(it.stem, `stemが空: ${it.id}`);
      const vid = it.vocabId;
      if (vid) {
        const wl = lvlOf.get(vid);
        assert.ok(wl, `vocab.jsonに無いvocabId: ${it.id} -> ${vid}`);
        assert.ok(RANK[wl] <= RANK[dlv], `出題語が大問級より上: ${it.id} (${vid}=${wl} > ${dlv})`);
      } else {
        assert.ok(
          allow.has(it.stem),
          `未紐づけstemが許容リストに無い: ${dlv} ${it.id} "${it.stem}" ` +
            `(vocabIdを付けるか tools/usage_coverage_report.py --set-baseline で許容リスト更新)`,
        );
      }
    }
  }
});

test('②1語彙id=1問(全大問通算・重複禁止=問題数はカバー語彙id数と一致)', () => {
  // 級跨ぎ含め通算で1語1問。同じ語に積む前に未カバー語へ=均等に広くカバー。
  const cnt = new Map<string, number>();
  for (const dlv of DAIMON_LEVELS) {
    for (const it of itemsOf(dlv)) {
      if (it.vocabId) cnt.set(it.vocabId, (cnt.get(it.vocabId) ?? 0) + 1);
    }
  }
  for (const [vid, n] of cnt) {
    assert.ok(n <= 1, `語彙idが重複(${n}問): ${vid}。1語彙id=1問(未カバー語を優先)`);
  }
});

test('③後退させない(ラチェット): カバー語数は基準以上', () => {
  const cov: Record<string, Set<string>> = { N4: new Set(), N3: new Set() };
  for (const dlv of DAIMON_LEVELS) {
    for (const it of itemsOf(dlv)) {
      const wl = it.vocabId && lvlOf.get(it.vocabId);
      if (wl && cov[wl]) cov[wl].add(it.vocabId!);
    }
  }
  for (const lv of DAIMON_LEVELS) {
    const b = base.baseline[lv];
    assert.ok(b, `基準にレベルが無い: ${lv}`);
    assert.ok(
      cov[lv].size >= b.covered,
      `${lv} カバー語数が後退: 現在${cov[lv].size} < 基準${b.covered}(意図的な削減なら --set-baseline で基準更新)`,
    );
  }
});
