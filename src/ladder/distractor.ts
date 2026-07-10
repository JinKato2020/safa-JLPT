// 受容4択の distractor(ダミー選択肢)を決定論で選ぶ。設計書 §3.5。
// 「紛らわしさ」= 同じ bucket(品詞/同音読み 等) を優先し、足りなければ他バケツで補完。
// 産出系(かなタイル/並べ替え/書き取り)はダミー不要なのでここでは扱わない。
import { mulberry32 } from './rng';

export interface Candidate<T> { key: string; bucket: string; item: T }

// 英語 gloss から粗く品詞推定(名詞に動詞ダミーが混じる等の易しすぎを防ぐ最小限)。
export function inferPos(meaning: string): 'verb' | 'other' {
  return meaning.trim().toLowerCase().startsWith('to ') ? 'verb' : 'other';
}

// seed で決定論シャッフルした pool から、correctKey を除外し、同 bucket を優先して n 件返す。
export function pickSimilar<T>(correctKey: string, correctBucket: string, pool: Candidate<T>[], n: number, seed: number): T[] {
  const rng = mulberry32(seed);
  const shuffled = [...pool]
    .filter((c) => c.key !== correctKey)
    .map((c) => ({ c, r: rng() }))
    .sort((a, b) => a.r - b.r)
    .map((x) => x.c);
  const same = shuffled.filter((c) => c.bucket === correctBucket);
  const rest = shuffled.filter((c) => c.bucket !== correctBucket);
  const out: T[] = [];
  const seen = new Set<string>();
  for (const c of [...same, ...rest]) {
    if (seen.has(c.key)) continue;
    seen.add(c.key);
    out.push(c.item);
    if (out.length >= n) break;
  }
  return out;
}
