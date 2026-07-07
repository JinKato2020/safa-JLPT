// 書き取りスコア算出の単体テスト。実行: node --import tsx --test src/kakitori/scoring.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreForMistakes } from './scoring.ts';

test('ミス0は満点', () => { assert.equal(scoreForMistakes(0), 100); });
test('ミス1は92', () => { assert.equal(scoreForMistakes(1), 92); });
test('ミス5は60', () => { assert.equal(scoreForMistakes(5), 60); });
test('大量ミスでも下限60', () => { assert.equal(scoreForMistakes(20), 60); });
test('負値は満点扱い', () => { assert.equal(scoreForMistakes(-1), 100); });
