// ホームのゲーム風ステータスパネルの表示データを既存selectorから算出する純関数。
// 合格Lv=合格率、5区分=各正解率(漢字/語彙=文字語彙を大問で分割、文法/読解/聴解=ringsFor)。
// 継続日数=streak、学習時間=studySeconds。値欠損は0埋め(クラッシュしない)。
import type { AppState } from '../store/state';
import type { Daimon } from '../data/examBlueprint';
import { readinessFor, ringsFor, idsRingPct } from '../store/selectors';
import { daimonUnitIds } from '../data/daimon';

// 合格率tier(0→9 = 0%→90%台)。badges.ts は画像requireを含むためここでは同式を内包。
const tierIndex = (pct: number) => Math.min(9, Math.max(0, Math.floor(pct / 10)));

export type StatusSubject = { key: string; labelKey: string; color: string; pct: number };
export type HomeStatus = {
  passPct: number;
  rankTitleKey: string; // ランク称号(合格率tierのタイトルキー)
  streakDays: number;
  studySeconds: number;
  subjects: StatusSubject[]; // 並び=漢字→語彙→文法→読解→聴解
};

const clamp = (n: number | null | undefined) => Math.max(0, Math.min(100, Math.round(n ?? 0)));
const COL = { kanji: '#d9743f', vocab: '#3f9d5a', grammar: '#7b6bd6', dokkai: '#2f80b8', choukai: '#57c78c' };

/** 秒 → 時・分(純関数・テスト可能)。 */
export function studyHM(sec: number): { h: number; m: number } {
  const s = Math.max(0, Math.floor(sec || 0));
  return { h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60) };
}

export function homeStatus(state: AppState, now: number): HomeStatus {
  const lv = state.settings.level;
  const rings = (() => { try { return ringsFor(state, now); } catch { return {} as ReturnType<typeof ringsFor>; } })();
  const readiness = (() => { try { return readinessFor(state, now); } catch { return null as ReturnType<typeof readinessFor> | null; } })();
  const idsOf = (...ds: Daimon[]) => ds.flatMap((d) => { try { return daimonUnitIds(lv, d); } catch { return [] as string[]; } });
  const acc = (ids: string[]) => { try { return idsRingPct(state, now, ids); } catch { return null; } };

  const passPct = clamp(readiness?.passProbability);
  const subjects: StatusSubject[] = [
    { key: 'kanji', labelKey: 'cards.kanji', color: COL.kanji, pct: clamp(acc(idsOf('kanji_read', 'orthography'))) },
    { key: 'vocab', labelKey: 'cards.vocab', color: COL.vocab, pct: clamp(acc(idsOf('context', 'synonym', 'usage'))) },
    { key: 'grammar', labelKey: 'cards.grammar', color: COL.grammar, pct: clamp(rings.bunpou) },
    { key: 'dokkai', labelKey: 'home.cat_dokkai', color: COL.dokkai, pct: clamp(rings.dokkai) },
    { key: 'choukai', labelKey: 'home.cat_choukai', color: COL.choukai, pct: clamp(rings.choukai) },
  ];

  return {
    passPct,
    rankTitleKey: 'home.passTitle' + tierIndex(passPct),
    streakDays: state.streak?.current ?? 0,
    studySeconds: state.studySeconds ?? 0,
    subjects,
  };
}
