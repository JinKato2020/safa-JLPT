// 垂直スライス: 実在庫(inventory)＋マスタリー store から JLPT大問の期待正答率μを組み、
// Plan①のモンテカルロ合格率に流す。設計書 §6。app面→大問の対応は第一近似(下記DAIMON_MAP)。
// 読解/聴解は有限在庫なし＝観測正答率(observed)を渡す(未観測は推測下限0.25=未測定扱い)。
import { Level } from './facets';
import { Facet, FacetState, newFacetState, effectiveM } from './mastery';
import { LadderItem, ItemType } from './inventory';
import { itemP, DaimonExpectation, passProbability } from './passRate';

export type StoreGet = (itemId: string, facet: Facet) => FacetState | undefined;
export interface Observed { reading?: number; listening?: number }

// app面 → JLPT大問。漢字読み←kanji_reading / 表記←kanji_write / 意味系(文脈・言換・用法)←vocab meaning / 文法←g_*。
const DAIMON_MAP: { daimon: string; type: ItemType; facet: Facet; n: number }[] = [
  { daimon: 'kanji_reading', type: 'kanji', facet: 'kanji_reading', n: 8 },
  { daimon: 'orthography', type: 'kanji', facet: 'kanji_write', n: 6 },
  { daimon: 'context', type: 'vocab', facet: 'meaning', n: 11 },
  { daimon: 'synonym', type: 'vocab', facet: 'meaning', n: 5 },
  { daimon: 'usage', type: 'vocab', facet: 'meaning', n: 5 },
  { daimon: 'grammar_form', type: 'grammar', facet: 'g_meaning', n: 13 },
  { daimon: 'sentence_order', type: 'grammar', facet: 'g_order', n: 5 },
  { daimon: 'passage_grammar', type: 'grammar', facet: 'g_order', n: 5 },
];

// その大問のプール平均μ(=予測正答率の平均)。プール空なら推測下限。
function poolMu(level: Level, type: ItemType, facet: Facet, inventory: LadderItem[], get: StoreGet, now: number): number {
  let sum = 0, cnt = 0;
  for (const it of inventory) {
    if (it.level !== level || it.type !== type || !it.facets.includes(facet)) continue;
    const st = get(it.id, facet) ?? newFacetState(now);
    sum += itemP(effectiveM(st, now));
    cnt += 1;
  }
  return cnt > 0 ? sum / cnt : itemP(0);
}

export function buildDaimonExpectations(level: Level, get: StoreGet, inventory: LadderItem[], now: number, observed: Observed = {}): DaimonExpectation[] {
  const out: DaimonExpectation[] = DAIMON_MAP.map((d) => ({
    daimon: d.daimon, n: d.n, mu: poolMu(level, d.type, d.facet, inventory, get, now),
  }));
  // 読解・聴解: 観測正答率(未観測は 0.25=未測定)。
  out.push({ daimon: 'reading', n: 10, mu: observed.reading ?? itemP(0) });
  out.push({ daimon: 'listening', n: 10, mu: observed.listening ?? itemP(0) });
  return out;
}

export function estimatePassRate(level: Level, get: StoreGet, inventory: LadderItem[], now: number, observed: Observed = {}, draws = 2000, seed = 1): number {
  return passProbability(level, buildDaimonExpectations(level, get, inventory, now, observed), draws, seed);
}
