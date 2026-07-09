import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AUDIO_BASE_URL, vocabAudioUrl, kanjiAudioUrl } from './audioBase.ts';

test('AUDIO_BASE_URL は既存の聴解と同じ配信ルート', () => {
  assert.equal(AUDIO_BASE_URL, 'https://jinkato2020.github.io/safa-JLPT/assets/audio/');
});

test('vocabAudioUrl は vocab/ サブディレクトリの mp3 を指す', () => {
  assert.equal(vocabAudioUrl('n5-v-1'), 'https://jinkato2020.github.io/safa-JLPT/assets/audio/vocab/n5-v-1.mp3');
  assert.equal(vocabAudioUrl('n3-v-999'), 'https://jinkato2020.github.io/safa-JLPT/assets/audio/vocab/n3-v-999.mp3');
});

test('kanjiAudioUrl は kanji/ サブディレクトリの mp3 を指す(URLエンコード済)', () => {
  assert.equal(kanjiAudioUrl('川'), `${AUDIO_BASE_URL}kanji/${encodeURIComponent('川')}.mp3`);
});
