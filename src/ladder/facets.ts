// 面/大問/公式得点区分の定義。設計書 §1.2, §6.2 準拠。React非依存。
export type Level = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

export interface ScoringSection { key: string; max: number; minPoint: number }
export interface LevelSpec { level: Level; sections: ScoringSection[]; passTotal: number }

// N1/N2/N3: 3区分(言語知識/読解/聴解 各0-60・基準19)。N4/N5: 2区分(言語知識+読解 0-120・基準38 / 聴解 0-60・基準19)。
const THREE = (): ScoringSection[] => [
  { key: 'gengo', max: 60, minPoint: 19 },
  { key: 'dokkai', max: 60, minPoint: 19 },
  { key: 'choukai', max: 60, minPoint: 19 },
];
const TWO = (): ScoringSection[] => [
  { key: 'gengo', max: 120, minPoint: 38 }, // 言語知識+読解を合算
  { key: 'choukai', max: 60, minPoint: 19 },
];

export const LEVEL_SPECS: Record<Level, LevelSpec> = {
  N1: { level: 'N1', sections: THREE(), passTotal: 100 },
  N2: { level: 'N2', sections: THREE(), passTotal: 90 },
  N3: { level: 'N3', sections: THREE(), passTotal: 95 },
  N4: { level: 'N4', sections: TWO(), passTotal: 90 },
  N5: { level: 'N5', sections: TWO(), passTotal: 80 },
};

// 大問キー(小リング) → 得点区分キー。読解は N4/N5 で gengo に合算される。
const GENGO_DAIMON = new Set([
  'kanji_reading', 'orthography', 'context', 'synonym', 'usage', 'word_formation',
  'grammar_form', 'sentence_order', 'passage_grammar',
]);

export function scoringSectionForDaimon(level: Level, daimon: string): string {
  if (daimon === 'listening') return 'choukai';
  if (daimon === 'reading') return level === 'N4' || level === 'N5' ? 'gengo' : 'dokkai';
  if (GENGO_DAIMON.has(daimon)) return 'gengo';
  throw new Error(`unknown daimon: ${daimon}`);
}
