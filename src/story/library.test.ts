import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  stageOf, restorationPercent, isVolumeComplete, sceneStateOf,
  dueChronicle, isLibraryComplete, LIBRARY_CHRONICLES, STAGES, RESTORABLE_LEVELS,
} from './library';

test('stageOf: 合格率を6段(0..5)へ・境界と範囲外', () => {
  assert.equal(stageOf(0), 0);
  assert.equal(stageOf(0.19), 0);
  assert.equal(stageOf(0.2), 1);
  assert.equal(stageOf(0.4), 2);
  assert.equal(stageOf(0.6), 3);
  assert.equal(stageOf(0.8), 4);
  assert.equal(stageOf(1), 5);
  assert.equal(stageOf(1.5), 5);   // 上限で丸め
  assert.equal(stageOf(-0.3), 0);  // 下限で丸め
  assert.equal(stageOf(NaN), 0);   // NaNは0
});

test('restorationPercent / isVolumeComplete', () => {
  assert.equal(restorationPercent(0.55), 0.55);
  assert.equal(restorationPercent(2), 1);
  assert.equal(restorationPercent(-1), 0);
  assert.equal(isVolumeComplete(1), true);
  assert.equal(isVolumeComplete(0.999), false);
});

test('sceneStateOf: 段が上がるほど書庫の要素が直る(本棚→照明→庭→桜→水路)', () => {
  assert.deepEqual(sceneStateOf(0), { shelf: false, light: false, garden: false, sakura: false, water: false });
  assert.deepEqual(sceneStateOf(0.2), { shelf: true, light: false, garden: false, sakura: false, water: false });
  assert.deepEqual(sceneStateOf(0.6), { shelf: true, light: true, garden: true, sakura: false, water: false });
  assert.deepEqual(sceneStateOf(1), { shelf: true, light: true, garden: true, sakura: true, water: true });
});

test('dueChronicle: 段1到達で最初の記録・既読は次へ・未到達はnull', () => {
  // 合格率0.2=段1到達 → N5巻の段1(chron.1)
  assert.equal(dueChronicle({ level: 'N5', passRate: 0.2, seen: [] })?.id, 'chron.1');
  // 段1既読なら段2の記録(合格率0.4=段2到達)
  assert.equal(dueChronicle({ level: 'N5', passRate: 0.4, seen: ['chron.1'] })?.id, 'chron.2');
  // 段未到達(<0.2)は何も出ない
  assert.equal(dueChronicle({ level: 'N5', passRate: 0.1, seen: [] }), null);
  // 到達段まで全部既読ならnull
  assert.equal(dueChronicle({ level: 'N5', passRate: 0.4, seen: ['chron.1', 'chron.2'] }), null);
});

test('dueChronicle: 巻ごとに記録が分かれる(N4は6番から)・段飛ばしは低い段から拾う', () => {
  assert.equal(dueChronicle({ level: 'N4', passRate: 0.2, seen: [] })?.id, 'chron.6');
  assert.equal(dueChronicle({ level: 'N3', passRate: 0.2, seen: [] })?.id, 'chron.11');
  // いきなり段5(合格率1.0)でも、未読の最も低い段(段1=chron.1)から出す=取りこぼさない
  assert.equal(dueChronicle({ level: 'N5', passRate: 1, seen: [] })?.id, 'chron.1');
  // 巻を持たない級は物語休止=null
  assert.equal(dueChronicle({ level: 'N1', passRate: 1, seen: [] }), null);
});

test('isLibraryComplete: 全巻(N5/N4/N3)完成でtrue', () => {
  assert.equal(isLibraryComplete({ N5: 1, N4: 1, N3: 1 }), true);
  assert.equal(isLibraryComplete({ N5: 1, N4: 1, N3: 0.9 }), false);
  assert.equal(isLibraryComplete({ N5: 1, N4: 1 }), false); // N3欠落=0扱い
  assert.equal(isLibraryComplete({}), false);
});

test('記録データの健全性: 15個・id一意・1文・絵文字なし', () => {
  assert.equal(LIBRARY_CHRONICLES.length, RESTORABLE_LEVELS.length * 5); // 3巻×5段=15
  const ids = new Set(LIBRARY_CHRONICLES.map((c) => c.id));
  assert.equal(ids.size, 15);
  const emoji = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  for (const c of LIBRARY_CHRONICLES) {
    assert.equal(c.text.split('。').filter((s) => s.length > 0).length, 1, `${c.id} は1文であること`);
    assert.ok(!emoji.test(c.text), `${c.id} に絵文字を含めない`);
  }
});

test('STAGESは6段・indexが0..5で連番', () => {
  assert.equal(STAGES.length, 6);
  STAGES.forEach((s, i) => assert.equal(s.index, i));
});
