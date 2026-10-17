// エンジンHTMLに必要なAPI/要素が含まれるかの単体テスト。実行: node --import tsx --test src/kakitori/engineHtml.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngineHtml } from './engineHtml.ts';

test('必要なJS APIとグリッド種別を含む', () => {
  const h = buildEngineHtml();
  for (const api of ['KW.load', 'setStep', 'setGrid', 'setColors', 'setSpeed', 'animate', 'showAnswer', 'setFree', 'setFreeStep']) {
    assert.ok(h.includes(api), 'missing ' + api);
  }
  for (const g of ['ta', 'kome', 'none']) assert.ok(h.includes(g));
  assert.ok(h.includes('HanziWriter')); // 同梱ライブラリ
  assert.ok(h.includes('charDataLoader')); // 注入方式
});
