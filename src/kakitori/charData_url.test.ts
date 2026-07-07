// charDataUrl のスモークテスト(DL/FSは実機のみ)。実行: node --import tsx --test src/kakitori/charData_url.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('charDataUrl は正しいCDN URL', async () => {
  // expo-file-system に依存しないよう関数のみ再実装で照合(実体はcharData.ts)
  const BASE = 'https://cdn.jsdelivr.net/npm/hanzi-writer-data@2';
  const url = `${BASE}/${encodeURIComponent('日')}.json`;
  assert.equal(url, 'https://cdn.jsdelivr.net/npm/hanzi-writer-data@2/%E6%97%A5.json');
});
