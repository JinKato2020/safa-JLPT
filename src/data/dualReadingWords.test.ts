// 複数読みの熟語(漢字読み問題)の読み統一ルールの番人。CLAUDE.md §1 の方針。
//   A群(answer!=null): その語の答えは必ずその読み。他の登録読みは答え・誤答に出さない。
//   B群(answer=null) : 両読みとも正解。片方を答えにした問題では、もう片方を誤答に混ぜない。
// ルール正本 = ./dualReadingWords.json / 適用ツール = tools/fix_dual_reading.py
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

type Rule = { answer: string | null; readings: string[] };
type Item = { id: string; underline: string; answer: string; choices: string[] };

const WORDS: Record<string, Rule> = JSON.parse(
  readFileSync(new URL('./dualReadingWords.json', import.meta.url), 'utf8'),
).words;

const CONTENT = fileURLToPath(new URL('../../content/problems/moji_goi/', import.meta.url));
// 通常プールと模試プール(mock/)の両方を検査＝全クラスで潰す
const files = (['N5', 'N4', 'N3'] as const).flatMap((lv) => [
  `kanji_read_${lv}.json`,
  `mock/kanji_read_${lv}.json`,
]);
const items = (rel: string): Item[] => JSON.parse(readFileSync(CONTENT + rel, 'utf8')).items;

test('複数読みの熟語は答えが統一され、別の正しい読みを誤答に混ぜない(通常+模試)', () => {
  for (const rel of files) {
    for (const it of items(rel)) {
      const rule = WORDS[it.underline];
      if (!rule) continue;
      const valid = new Set(rule.readings);

      // A群: 答えは正規の読みでなければならない
      if (rule.answer) {
        assert.equal(it.answer, rule.answer, `${it.id} ${it.underline} の答えは ${rule.answer} であるべき`);
      }
      // 誤答に「答え自身」や「別の正しい読み」があってはならない(=第2の正解の排除)
      for (const c of it.choices) {
        assert.notEqual(c, it.answer, `${it.id} 誤答が答えと同じ: ${c}`);
        assert.ok(
          !(valid.has(c) && c !== it.answer),
          `${it.id} ${it.underline} の誤答 "${c}" は別の正しい読み(第2の正解)。非読みに差し替えを`,
        );
      }
    }
  }
});
