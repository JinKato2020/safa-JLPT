import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  stageOf, restorationPercent, isBookComplete, sceneStateOf,
  bookProgress, dueStory, SMALL_STORIES, STAGES,
} from './library';

test('stageOf: 復元率を6段(0..5)へ・境界と範囲外', () => {
  assert.equal(stageOf(0), 0);
  assert.equal(stageOf(0.19), 0);
  assert.equal(stageOf(0.2), 1);
  assert.equal(stageOf(0.4), 2);
  assert.equal(stageOf(0.6), 3);
  assert.equal(stageOf(0.8), 4);
  assert.equal(stageOf(1), 5);
  assert.equal(stageOf(1.5), 5);
  assert.equal(stageOf(-0.3), 0);
  assert.equal(stageOf(NaN), 0);
});

test('restorationPercent / isBookComplete', () => {
  assert.equal(restorationPercent(0.55), 0.55);
  assert.equal(restorationPercent(2), 1);
  assert.equal(restorationPercent(-1), 0);
  assert.equal(isBookComplete(1), true);
  assert.equal(isBookComplete(0.999), false);
});

test('sceneStateOf: 節目で書庫の要素が一つずつ直る(本棚→照明→庭→桜→水路)', () => {
  assert.deepEqual(sceneStateOf(0), { shelf: false, light: false, garden: false, sakura: false, water: false });
  assert.deepEqual(sceneStateOf(0.2), { shelf: true, light: false, garden: false, sakura: false, water: false });
  assert.deepEqual(sceneStateOf(0.6), { shelf: true, light: true, garden: true, sakura: false, water: false });
  assert.deepEqual(sceneStateOf(1), { shelf: true, light: true, garden: true, sakura: true, water: true });
});

test('bookProgress: 1冊の通しメーター=全級ならし(級ごとに再点火しない)', () => {
  assert.equal(bookProgress({ N5: 1, N4: 1, N3: 1 }), 1);
  assert.equal(bookProgress({}), 0);
  assert.ok(Math.abs(bookProgress({ N5: 1, N4: 0, N3: 0 }) - 1 / 3) < 1e-9);
  assert.equal(bookProgress({ N5: 1, N4: 0.5, N3: 0 }), 0.5); // 欠けた級は0扱いでなく明示0でも同じ
  assert.equal(bookProgress({ N5: 2 }), 1 / 3); // 各級clamp01
});

test('dueStory: 節目到達で解禁・既読は次へ・未達はnull・順に進む', () => {
  // 20%未満は何も出ない
  assert.equal(dueStory({ percent: 0.1, seen: [] }), null);
  // 20%到達→story.1
  assert.equal(dueStory({ percent: 0.2, seen: [] })?.id, 'story.1');
  // story.1既読・まだ40%未満→null(story.2はthreshold0.4)
  assert.equal(dueStory({ percent: 0.3, seen: ['story.1'] }), null);
  // 40%到達・story.1既読→story.2
  assert.equal(dueStory({ percent: 0.4, seen: ['story.1'] })?.id, 'story.2');
  // 途中まで飛んでも未読の最も低い節目から拾う(取りこぼさない)
  assert.equal(dueStory({ percent: 0.8, seen: [] })?.id, 'story.1');
  // 80%・1〜3既読→story.4
  assert.equal(dueStory({ percent: 0.8, seen: ['story.1', 'story.2', 'story.3'] })?.id, 'story.4');
  // 完成→筆を託す(final)
  assert.equal(dueStory({ percent: 1, seen: ['story.1', 'story.2', 'story.3', 'story.4'] })?.id, 'story.final');
  // 全部既読ならnull
  assert.equal(dueStory({ percent: 1, seen: SMALL_STORIES.map((s) => s.id) }), null);
});

test('小ストーリーの健全性: 5本・id一意・threshold昇順・絵文字なし・中身が揃う', () => {
  assert.equal(SMALL_STORIES.length, 5);
  const ids = new Set(SMALL_STORIES.map((s) => s.id));
  assert.equal(ids.size, 5);
  assert.deepEqual(SMALL_STORIES.map((s) => s.threshold), [0.2, 0.4, 0.6, 0.8, 1.0]);
  const emoji = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  for (const s of SMALL_STORIES) {
    assert.ok(s.record.length >= 1, `${s.id} に覚書があること`);
    assert.ok(s.sakura.length > 0, `${s.id} に桜の気づきがあること`);
    assert.ok(s.title.length > 0 && s.theme.length > 0 && s.art.length > 0);
    assert.ok(![...s.record, s.sakura, s.title].some((t) => emoji.test(t)), `${s.id} に絵文字を含めない`);
  }
});

test('STAGESは6段・indexが0..5で連番', () => {
  assert.equal(STAGES.length, 6);
  STAGES.forEach((s, i) => assert.equal(s.index, i));
});
