// 仮想学習者(NPC)の「単語帳」見本を、レベル相応の語/漢字/文法から決定的に生成する(純関数)。
// 友だち(実在)は本物の単語帳(id参照)をサーバーから受け取るのでこれは使わない=NPC専用。
// 決定的(id文字列をseed化)＝同じNPCは毎回同じ見本。中身は端末の辞書(VOCAB/KANJI/GRAMMAR)にある語のidだけ。
import { VOCAB, GRAMMAR, KANJI } from '../data';
import type { SaveRef } from '../quiz/quiz';

const LV = ['N5', 'N4', 'N3'];
type Pools = { kanji: string[]; vocab: string[]; grammar: string[] };
// レベル別id一覧(モジュール読み込み時に1度だけ構築)。
const byLevel: Record<string, Pools> = (() => {
  const o: Record<string, Pools> = {};
  for (const lv of LV) o[lv] = { kanji: [], vocab: [], grammar: [] };
  KANJI.forEach((k) => { if (o[k.level]) o[k.level].kanji.push(k.id); });
  VOCAB.forEach((v) => { if (o[v.level]) o[v.level].vocab.push(v.id); });
  GRAMMAR.forEach((g) => { if (o[g.level]) o[g.level].grammar.push(g.id); });
  return o;
})();

function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
// seed固定のシャッフルから先頭n件(決定的サンプリング)。
function pick(ids: readonly string[], seed: number, n: number): string[] {
  const a = ids.slice();
  let s = (seed >>> 0) || 1;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; };
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, Math.min(n, a.length));
}

/** レベルとseed文字列(NPCのid)から、見本の単語帳(漢字/語彙/文法)を決定的に作る。 */
export function sampleNotebook(level: string, seedStr: string): SaveRef[] {
  const p = byLevel[level] ?? byLevel.N5;
  const h = hashStr(seedStr);
  const nk = 8 + (h % 5), nv = 12 + (h % 7), ng = 5 + (h % 4); // NPCごとに件数を少しだけ変える
  const out: SaveRef[] = [];
  pick(p.kanji, h ^ 0x1, nk).forEach((id) => out.push({ type: 'kanji', id }));
  pick(p.vocab, h ^ 0x2, nv).forEach((id) => out.push({ type: 'vocab', id }));
  pick(p.grammar, h ^ 0x3, ng).forEach((id) => out.push({ type: 'grammar', id }));
  return out;
}
