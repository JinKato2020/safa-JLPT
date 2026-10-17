// ホームのゲーム風ステータスパネルの表示データを既存selectorから算出する純関数。
// 合格Lv=合格率、5区分=各正解率(漢字/語彙=文字語彙を大問で分割、文法/読解/聴解=ringsFor)。
// 継続日数=streak、学習時間=studySeconds。値欠損は0埋め(クラッシュしない)。
import type { AppState } from '../store/state';
import type { Daimon } from '../data/examBlueprint';
import { ringsFor, idsRingPct, expectedScoreFor } from '../store/selectors';
import { daimonUnitIds } from '../data/daimon';

// 到達度tier(0→9 = 0%→90%台)。badges.ts は画像requireを含むためここでは同式を内包。
const tierIndex = (pct: number) => Math.min(9, Math.max(0, Math.floor(pct / 10)));

export type StatusSubject = { key: string; labelKey: string; color: string; pct: number };
export type HomeStatus = {
  reachPct: number;     // 合格ライン到達度(0-100・内部指標/非表示)。当てずっぽう水準(満点25%)起点→合格ラインで100%。合格率(廃止指標)の代わりに称号/勲章/ごほうびを駆動。
  predScore: number;    // 予想得点(受験レベル・期待値)
  predMax: number;      // 総得点(JLPTは180)
  passTotal: number;    // 合格ライン(総合)
  rankTitleKey: string; // ランク称号(到達度tierのタイトルキー)
  streakDays: number;
  studySeconds: number;
  subjects: StatusSubject[]; // 並び=漢字→語彙→文法→読解→聴解(5区分)
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
  // 分野別の正解率は「生の正答率」で表示する(4択の偶然25%が下限＝直感的。ユーザー確定2026-08-23)。
  //  ※当て推量補正(当てずっぽう=0%)は予想得点・合格判定の計算側にだけ残す。ここは表示専用なので raw=true。
  const rings = (() => { try { return ringsFor(state, now, true); } catch { return {} as ReturnType<typeof ringsFor>; } })();
  const idsOf = (...ds: Daimon[]) => ds.flatMap((d) => { try { return daimonUnitIds(lv, d); } catch { return [] as string[]; } });
  const acc = (ids: string[]) => { try { return idsRingPct(state, now, ids, true); } catch { return null; } };

  // 予想得点(受験レベル・期待値)。開発用 devPassPct を設定した時は、その割合で得点も連動させ挙動確認できるように。
  const est = (() => { try { return expectedScoreFor(state, now); } catch { return null; } })();
  const predMax = est?.max ?? 180;
  const predScore = state.settings.devPassPct != null ? Math.round((clamp(state.settings.devPassPct) / 100) * predMax) : (est?.score ?? 0);
  const passTotal = est?.passTotal ?? 0;
  // 合格ライン到達度(0-100)。合格率(廃止指標)の代わりに段階/称号/ごほうびを駆動する内部指標(数値は画面に出さない)。
  //  「当てずっぽう水準(満点の25%≈45/180)」を起点0%とし、予想得点が合格ラインに達して100%。
  //  ＝未学習の初学者は0%から始まり、初日に称号中位/桜貝が付かない(当てずっぽうの下駄を差し引く)。
  // 【開発用】devPassPct を設定したらこの到達度を固定(各連動UIの挙動確認)。null/未設定=自動計算。
  const guessFloor = 0.25 * predMax; // 4択の当てずっぽう下限(満点の25%)
  const reachPct = state.settings.devPassPct != null
    ? clamp(state.settings.devPassPct)
    : (passTotal > guessFloor ? clamp(((predScore - guessFloor) / (passTotal - guessFloor)) * 100) : 0);
  // 5区分(漢字ID有効化で漢字面が習得を持つため分割・ユーザー確定2026-08-23)。漢字=漢字読み/表記、語彙=文脈規定/言い換え/用法。
  const subjects: StatusSubject[] = [
    { key: 'kanji', labelKey: 'cards.kanji', color: COL.kanji, pct: clamp(acc(idsOf('kanji_read', 'orthography'))) },
    { key: 'vocab', labelKey: 'cards.vocab', color: COL.vocab, pct: clamp(acc(idsOf('context', 'synonym', 'usage'))) },
    { key: 'grammar', labelKey: 'cards.grammar', color: COL.grammar, pct: clamp(rings.bunpou) },
    { key: 'dokkai', labelKey: 'home.cat_dokkai', color: COL.dokkai, pct: clamp(rings.dokkai) },
    { key: 'choukai', labelKey: 'home.cat_choukai', color: COL.choukai, pct: clamp(rings.choukai) },
  ];

  return {
    reachPct,
    predScore,
    predMax,
    passTotal,
    rankTitleKey: 'home.passTitle' + tierIndex(reachPct),
    streakDays: state.streak?.current ?? 0,
    studySeconds: state.studySeconds ?? 0,
    subjects,
  };
}
