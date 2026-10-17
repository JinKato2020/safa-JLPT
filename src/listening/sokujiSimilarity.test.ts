// 【番人・2026-08-14】即時応答(sokuji)の近似重複ガード＝層2。
//  場面(scenario)を廃したので、多様性/重複の軸は「発話の機能」と「言葉の表面」。
//  ここでは表面類似(文字bigram＋漢字熟語)を測り、一般帯に「言葉違いの実質コピー」が混ざるのを防ぐ。
//  作問時は tools/choukai/sokuji_build.py が類似度≥0.50を却下。番人は≥0.55で失敗(現行データのmaxは約0.42)。
//  ※ ロジックは tools/choukai/sokuji_sim.py と一致させること。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { idBand } from './pool';

const LEVELS = ['N5', 'N4', 'N3'] as const;
const GUARD = 0.55;

function load(lv: string) {
  const p = join(process.cwd(), 'content', 'problems', 'choukai', `sokuji_${lv}.json`);
  return JSON.parse(readFileSync(p, 'utf8')).items as Array<{ id: string; script: string }>;
}

const isKanji = (ch: string) => ch >= '一' && ch <= '鿿';
function norm(s: string): string {
  return (s || '').replace(/（[^）]*）/g, '').replace(/[\s、。！？…「」『』（）().,!?~ー－・:：;；]/g, '');
}
function bigrams(s: string): Set<string> {
  const out = new Set<string>();
  if (s.length < 2) { if (s) out.add(s); return out; }
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
  return out;
}
function kanjiBigrams(s: string): Set<string> {
  const out = new Set<string>();
  let run = '';
  const flush = () => { for (let i = 0; i < run.length - 1; i++) out.add(run.slice(i, i + 2)); run = ''; };
  for (const ch of s) { if (isKanji(ch)) run += ch; else flush(); }
  flush();
  return out;
}
function jac(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}
function sim(a: string, b: string): number {
  const na = norm(a), nb = norm(b);
  const cj = jac(bigrams(na), bigrams(nb));
  const ka = kanjiBigrams(na), kb = kanjiBigrams(nb);
  let shared = 0;
  for (const x of ka) if (kb.has(x)) shared++;
  const kj = shared >= 3 ? jac(ka, kb) : 0;
  return Math.max(cj, 0.9 * kj);
}

for (const lv of LEVELS) {
  test(`sokuji ${lv}: 一般帯に近似重複ペアが無い(類似度<${GUARD})`, () => {
    const items = load(lv).filter((it) => idBand(it.id) === 'general');
    let worst = 0;
    let pair = '';
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const v = sim(items[i].script, items[j].script);
        if (v > worst) { worst = v; pair = `${items[i].id}~${items[j].id}`; }
      }
    }
    assert.ok(worst < GUARD, `近似重複の疑い ${pair} 類似度${worst.toFixed(2)}≥${GUARD}`);
  });
}
