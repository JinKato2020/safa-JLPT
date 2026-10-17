// 情報検索(joho)「需要側＝正解に必要な情報源数(answer_sources)」の番人。
// 供給側(figure_pattern/情報源の構造)は johoSolvability/johoSkeletonBalance が見張る。ここは需要の分布を守る。
// 目標(ユーザー指示2026-08-21)：N4 ≥2源必要=66%(40/60)／N3 ≥2源=100%(60)・≥3源=50%(30)／N5据置。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('../../content/problems/dokkai/', import.meta.url));
type Item = { id: string; skeleton?: { answer_sources?: number } };
function load(name: string): Item[] {
  return JSON.parse(readFileSync(DIR + name + '.json', 'utf8')).items as Item[];
}
function tags(name: string): number[] {
  return load(name).map((it) => it.skeleton?.answer_sources ?? 0);
}

test('全itemに answer_sources(1/2/3) が付いている', () => {
  for (const name of ['joho_N5', 'joho_N4', 'joho_N3']) {
    const bad = load(name).filter((it) => ![1, 2, 3].includes(it.skeleton?.answer_sources as number)).map((it) => it.id);
    assert.equal(bad.length, 0, `${name} answer_sources未付与/不正: ${bad.slice(0, 5).join(',')}`);
  }
});

test('N4：答えに2源以上が必要な問題が66%以上(40/60)', () => {
  const t = tags('joho_N4');
  const ge2 = t.filter((v) => v >= 2).length;
  assert.ok(ge2 >= 40, `N4 ≥2源=${ge2} < 40 (${Math.round((ge2 / t.length) * 100)}%)`);
});

test('N3：答えに2源以上が100%(60)・3源以上が50%以上(30)', () => {
  const t = tags('joho_N3');
  const ge2 = t.filter((v) => v >= 2).length;
  const ge3 = t.filter((v) => v >= 3).length;
  assert.equal(ge2, t.length, `N3 ≥2源=${ge2} ≠ 全${t.length}（=1源が残っている）`);
  assert.ok(ge3 >= 30, `N3 ≥3源=${ge3} < 30 (${Math.round((ge3 / t.length) * 100)}%)`);
});
