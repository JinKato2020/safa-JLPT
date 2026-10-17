// 模試組み立て(純ロジック)の挙動テスト。MockScreen.tsx から切り出したことで node で直接テスト可能に。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildExam, knowledgeForDaimon } from './buildExam';

// Risk2 回帰: 大問横断の語ユニーク化で本番出題数に届かない時、避けた候補(spill)で穴埋めして本番比率を守る。
test('knowledgeForDaimon: 全語が既使用でも spill 穴埋めで本番出題数を満たす', () => {
  const used = new Set<string>();
  // まず context プールを汲み尽くし、全 wkey を used に載せる。
  knowledgeForDaimon(['N5'], 'context', 100000, {}, used);
  assert.ok(used.size >= 5, `context プールに十分な語がある前提(size=${used.size})`);
  // 全語が既使用の状態で 5 問要求 → 修正前は 0 問(全スキップ)、修正後は spill で 5 問。
  const again = knowledgeForDaimon(['N5'], 'context', 5, {}, used);
  assert.equal(again.length, 5);
});

test('knowledgeForDaimon: 語が枯れていなければ既使用語を避けてユニークに出す', () => {
  const used = new Set<string>();
  const first = knowledgeForDaimon(['N5'], 'context', 3, {}, used);
  assert.equal(first.length, 3);
  // 同じ used を引き継いで再要求。プールは十分広いので、避けても新しい語で 3 問埋まる。
  const second = knowledgeForDaimon(['N5'], 'context', 3, {}, used);
  assert.equal(second.length, 3);
  // first と second の wkey(saveRef or id語部)は重ならない(ユニーク化が効いている)。
  const key = (x: { saveRef?: { type: string; id: string }; id: string }) => x.saveRef ? `${x.saveRef.type}:${x.saveRef.id}` : x.id.split('#')[0];
  const overlap = new Set(first.map(key));
  assert.ok(second.every((x) => !overlap.has(key(x))), '2回目に1回目と同じ語が出ている(ユニーク化が壊れている)');
});

test('buildExam: JLPTフル模試を生成できる(十分な問題数・文字語彙を含む)', () => {
  const exam = buildExam(['N4'], true, false, {});
  assert.ok(exam.length > 10, `exam が十分な問題数(${exam.length})`);
  const secs = new Set(exam.map((it) => it.section));
  assert.ok(secs.has('moji_goi'), '文字語彙セクションを含む');
});
