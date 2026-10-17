// 【番人・2026-08-14】即時応答(sokuji)の ID帯規約と正解位置バランスを守る。
//  - ID帯: 0001-0500 一般 / 0501-0700 枯渇プール / 0701-1000 模試専用(src/listening/pool.ts と対応)。
//  - 正解位置(answerIndex)は audioChoices で音声に焼き込まれる→一般帯は①②③を均等に保つ
//    (旧40問は 27/7/6=①偏重で「①を選ぶだけで得点」できた。二度と偏らせない)。
//  作問は tools/choukai/sokuji_build.py が①②③を均等割当する。手で足す時もこの番人で崩れを検出。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { idBand } from './pool';

const LEVELS = ['N5', 'N4', 'N3'] as const;
function load(lv: string) {
  const p = join(process.cwd(), 'content', 'problems', 'choukai', `sokuji_${lv}.json`);
  return JSON.parse(readFileSync(p, 'utf8')).items as Array<{ id: string; questions: { answerIndex: number }[] }>;
}
const num = (id: string) => parseInt(id.split('-').pop() ?? '', 10);

for (const lv of LEVELS) {
  test(`sokuji ${lv}: ID帯が規約内(1-1000)・重複なし`, () => {
    const items = load(lv);
    const nums = items.map((it) => num(it.id));
    assert.equal(new Set(nums).size, nums.length, 'id重複あり');
    for (const n of nums) assert.ok(n >= 1 && n <= 1000, `id帯外: ${n}`);
  });

  test(`sokuji ${lv}: 一般帯(≤500)の正解位置が均等(①②③の差≤3)`, () => {
    const items = load(lv).filter((it) => idBand(it.id) === 'general');
    if (items.length < 6) return; // 少数なら検査しない
    const c = [0, 0, 0];
    for (const it of items) c[it.questions[0].answerIndex]++;
    const spread = Math.max(...c) - Math.min(...c);
    assert.ok(spread <= 3, `一般帯の正解位置が偏っている ①${c[0]} ②${c[1]} ③${c[2]} (差${spread}>3)`);
  });
}
