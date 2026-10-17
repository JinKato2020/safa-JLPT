// 聴解 骨組みパラメータ(develop/kanten/genre/q_type)の番人。ワンパターン化を機械で止める。
// 設計正本＝md/聴解_作問フロー.md「骨組みパラメータの最適化」。付与ツール＝tools/choukai/skeleton_tag.py。
// ここはビルドで走る硬いガード＝①各itemにフィールドがある ②1つの値が過半(≥50%)を占めない ③気持ち観点は必ずある。
// 細かい均し(≤35%)は作問前の助言(skeleton_tag.py check)で扱い、ここは「これ以上ワンパターンにしない」最低線。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('../../content/problems/choukai/', import.meta.url));
type Item = Record<string, unknown> & { id: string };
function load(name: string): Item[] {
  return (JSON.parse(readFileSync(DIR + name + '.json', 'utf8')).items as Item[]);
}
const KADAI = ['kadai_N5', 'kadai_N4', 'kadai_N3'];
const POINT = ['point_N5', 'point_N4', 'point_N3'];
const GAIYOU = ['gaiyou_N3'];
const PRESENT: [string[], string][] = [
  [KADAI, 'develop'], [POINT, 'kanten'], [GAIYOU, 'genre'], [GAIYOU, 'q_type'],
];
// q_type は音声に焼き込まれ無償で直せない(店・概要は選択肢も音声)ので過半ガードの対象外＝存在のみ確認。
const MAJORITY: [string[], string][] = [
  [KADAI, 'develop'], [POINT, 'kanten'], [GAIYOU, 'genre'],
];

test('骨組みフィールドは全itemに付いている(タグ漏れ=作問がメタ抜けで増える穴)', () => {
  for (const [files, field] of PRESENT) {
    for (const name of files) {
      const miss = load(name).filter((it) => !it[field]).map((it) => it.id);
      assert.equal(miss.length, 0, `${name}.${field} 未付与: ${miss.slice(0, 5).join(',')}`);
    }
  }
});

test('1つの値が過半(≥50%)を占めない=ワンパターン化の最低線', () => {
  for (const [files, field] of MAJORITY) {
    for (const name of files) {
      const items = load(name);
      const c = new Map<string, number>();
      for (const it of items) { const v = String(it[field]); c.set(v, (c.get(v) ?? 0) + 1); }
      const [top, cnt] = [...c.entries()].sort((a, b) => b[1] - a[1])[0];
      assert.ok(cnt / items.length < 0.5, `${name}.${field} 偏り『${top}』${Math.round((cnt / items.length) * 100)}%≥50%`);
    }
  }
});

test('ポイント理解の観点「気持ち」は各レベルに必ずある(公式必須)', () => {
  for (const name of POINT) {
    assert.ok(load(name).some((it) => it.kanten === '気持ち'), `${name} に気持ち観点が無い`);
  }
});
