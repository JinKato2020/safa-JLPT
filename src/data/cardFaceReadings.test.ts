import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardFaceReadings, readingAboveUserLevel, levelRank, KANJI_CARDS } from './index';

// レベル適応の読みリスト: カード表面は「自分のレベル以下の読み」だけ。上の読みは詳細のみ。
// 実データ(kanjiCards.json)を使って外/名の既知の振る舞いを固定する。

test('levelRank orders N5(easy)..N1(hard)', () => {
  assert.equal(levelRank('N5'), 0);
  assert.equal(levelRank('N1'), 4);
  assert.ok(levelRank('N5') < levelRank('N3'));
  assert.equal(levelRank('???'), 4); // 未知はN1相当
});

test('外(N5カード): N5ユーザーはN5読みのみ、N3のゲ/はずは非表示', () => {
  const shown = cardFaceReadings('外', 'N5').map((r) => r.reading);
  assert.ok(shown.includes('ガイ'));
  assert.ok(shown.includes('そと'));
  assert.ok(shown.includes('ほか'));
  assert.ok(!shown.includes('ゲ'), 'ゲ(N3)は表面に出さない');
  assert.ok(!shown.includes('はず'), 'はず(N3)は表面に出さない');
});

test('名(N5カード): N5ユーザーにミョウ(N3)は非表示', () => {
  const shown = cardFaceReadings('名', 'N5').map((r) => r.reading);
  assert.ok(shown.includes('メイ'));
  assert.ok(shown.includes('な'));
  assert.ok(!shown.includes('ミョウ'), 'ミョウ(N3)は表面に出さない');
});

test('外: N3ユーザーはN3読み(ゲ/はず)も表面に出す', () => {
  const shown = cardFaceReadings('外', 'N3').map((r) => r.reading);
  assert.ok(shown.includes('ゲ'));
  assert.ok(shown.includes('はず'));
});

test('しきい値=max(ユーザー, 漢字レベル): 全カードで表面は空にならず、全読み⊆詳細', () => {
  for (const [char, card] of Object.entries(KANJI_CARDS)) {
    for (const lv of ['N5', 'N4', 'N3', 'N2', 'N1']) {
      const face = cardFaceReadings(char, lv);
      assert.ok(face.length >= 1, `${char}@${lv} が空`);
      // 表面の読みはすべて詳細(全読み)の部分集合
      assert.ok(face.length <= card.readings.length);
      // しきい値以下だけ(fallbackの単一読みを除く)
      const threshold = Math.max(levelRank(lv), levelRank(card.level));
      if (face.length > 1 || card.readings.every((r) => levelRank(r.level) <= threshold)) {
        for (const r of face) assert.ok(levelRank(r.level) <= threshold, `${char}@${lv} ${r.reading}=${r.level} がしきい値超え`);
      }
    }
  }
});

test('readingAboveUserLevel', () => {
  assert.equal(readingAboveUserLevel('N3', 'N5'), true);
  assert.equal(readingAboveUserLevel('N5', 'N5'), false);
  assert.equal(readingAboveUserLevel('N5', 'N3'), false);
});
