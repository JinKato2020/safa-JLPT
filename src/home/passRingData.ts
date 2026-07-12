// 合格リングの表示データを既存selectorから算出する純関数。
// 外=5科目カバー率(語彙/文法/漢字は coverageBars、読解/聴解は ringsFor の正答を代理指標)。
// 中=総合正答(ringsFor平均)。中央=合格の称号(合格可能性%で暫定判定)。値欠損は0埋め(クラッシュしない)。
import type { AppState } from '../store/state';
import { coverageBars, ringsFor, readinessFor } from '../store/selectors';

export type PassRingCategory = { key: string; label: string; color: string; coveragePct: number };
export type PassRingData = {
  passPct: number;
  level: string;
  overallAccuracyPct: number;
  tier: string;
  categories: PassRingCategory[];
};

const clamp = (n: number | null | undefined) => Math.max(0, Math.min(100, Math.round(n || 0)));
const COLORS = { vocab: '#e75f86', grammar: '#9a86ef', kanji: '#e8934e', dokkai: '#46b6d6', choukai: '#57c78c' };

export function passRingData(state: AppState, now: number): PassRingData {
  const cov = (() => { try { return coverageBars(state, now); } catch { return [] as ReturnType<typeof coverageBars>; } })();
  const covOf = (k: 'kanji' | 'vocab' | 'grammar') => {
    const b = cov.find((x) => x.key === k);
    return b && b.total > 0 ? (100 * b.learned) / b.total : 0;
  };
  const rings = (() => { try { return ringsFor(state, now); } catch { return {} as ReturnType<typeof ringsFor>; } })();

  const categories: PassRingCategory[] = [
    { key: 'vocab', label: '語彙', color: COLORS.vocab, coveragePct: clamp(covOf('vocab')) },
    { key: 'grammar', label: '文法', color: COLORS.grammar, coveragePct: clamp(covOf('grammar')) },
    { key: 'kanji', label: '漢字', color: COLORS.kanji, coveragePct: clamp(covOf('kanji')) },
    { key: 'dokkai', label: '読解', color: COLORS.dokkai, coveragePct: clamp(rings.dokkai) },
    { key: 'choukai', label: '聴解', color: COLORS.choukai, coveragePct: clamp(rings.choukai) },
  ];

  // 総合正答: 到達度selectorの overallPct を優先、無ければ ringsFor 平均。
  const readiness = (() => { try { return readinessFor(state, now); } catch { return null as ReturnType<typeof readinessFor> | null; } })();
  const accVals = ([rings.moji_goi, rings.bunpou, rings.dokkai, rings.choukai].filter((v) => typeof v === 'number')) as number[];
  const ringsAvg = accVals.length ? accVals.reduce((a, b) => a + b, 0) / accVals.length : 0;
  const overallAccuracyPct = clamp(readiness?.overallPct ?? ringsAvg);
  // 合格可能性: 到達度selectorの passProbability(本物)を使用。無ければ暫定式。
  const covAvg = categories.reduce((a, c) => a + c.coveragePct, 0) / categories.length;
  const passPct = clamp(readiness?.passProbability ?? (covAvg * 0.5 + overallAccuracyPct * 0.5));
  const tier = passPct >= 50 ? '合格' : '挑戦';

  return { passPct, level: state.settings.level, overallAccuracyPct, tier, categories };
}
