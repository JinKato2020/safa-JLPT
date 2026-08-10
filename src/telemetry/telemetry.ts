// 利用状況計測(v1.2)。到達度/区分別/新規枯渇/模試/行動イベントを
// Supabase(tel_snapshot / tel_event / tel_mock)へ INSERT する(旧Cloudflare Workerから移管)。
// settings.telemetry=false で完全停止。未ログインは匿名UUIDのみ。ログイン中は account_id(認証ユーザーID)を
// 添えてアカウントに紐づけ分析する(SyncProviderがsetTelemetryAccountで注入)。第三者追跡・IP保存はしない。
// テーブル未作成時はinsert失敗→キューに滞留(無害・作成後にflushで再送)。RLSは anon/authenticated の INSERT のみ許可。
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dayStr, type AppState } from '../store/state';
import { readinessFor, ringsFor, learnedNow, coverageBars, levelRank, daimonMasteryCounts, passageMasteryCounts, expectedScoreFor } from '../store/selectors';
import { stockCounts } from './stock';
import { allItemIdsFor } from '../data';
import { daysBetween } from '../store/state';
import type { Category } from '../engine/engine';
import { supabase } from '../config/supabase';
import { personalityOf, moodMsgOf } from '../plaza/persona';

const APP_VERSION = '1.1.0';

// ── ライフサイクル計測(install / first_session / next_day_open)。願い(wish)非依存の素の継続シグナル。
const M_INSTALL = 'install';
const M_FIRST_SESSION = 'first_session';
const M_NEXT_DAY_OPEN = 'next_day_open';
const LIFECYCLE_DAY_MS = 24 * 3600 * 1000;
function installDayStr(state: AppState): string | null { return state.installedAt ? dayStr(state.installedAt) : null; }
function daysSinceInstall(state: AppState, now: number): number | null {
  if (!state.installedAt) return null;
  return Math.max(0, Math.floor(now / LIFECYCLE_DAY_MS) - Math.floor(state.installedAt / LIFECYCLE_DAY_MS));
}
function lifecycleCohort(state: AppState, now: number): Record<string, unknown> {
  return { installDay: installDayStr(state), daysSinceInstall: daysSinceInstall(state, now) };
}
const CATS: Category[] = ['moji_goi', 'bunpou', 'dokkai', 'choukai'];
const EXHAUST_THRESHOLD = 3; // 新規残数がこれ以下=その区分は“枯渇”(コンテンツ不足シグナル)
const K_ANON = 'safa-jlpt:anonId';
const K_QUEUE = 'safa-jlpt:telemetryQueue';
const K_DAY = 'safa-jlpt:telemetryLastDay';

let enabled = true; // App側で settings.telemetry に同期(既定ON)
export function setTelemetryEnabled(on: boolean): void { enabled = on; }

// ログイン中のアカウントID(認証ユーザーUUID)。SyncProviderがセッション変化で注入。未ログイン=null(匿名)。
// 送信body に accountId として載せ、post() が account_id 列へ格納する。
let accountId: string | null = null;
export function setTelemetryAccount(id: string | null): void { accountId = id; }

// 'react-native' 本体はFlow構文(opaque type等)を含みesbuild(tsx/node:test)で静的import不可のため遅延require。
// store.tsx→telemetry.tsが単体テスト(reducer等)からimportされてもクラッシュしない(実行時は未呼出=無害)。
// RN実行時はMetro(Babel)がrequireを解決するため挙動は従来どおり。
function getPlatform(): { OS: string; Version?: unknown } {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return (require('react-native') as typeof import('react-native')).Platform;
}

// 匿名UUID(PIIなし)。端末ローカルに保存、再インストールで新ID(匿名のため許容)。
function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
async function anonId(): Promise<string> {
  let id = await AsyncStorage.getItem(K_ANON);
  if (!id) { id = uuid(); await AsyncStorage.setItem(K_ANON, id); }
  return id;
}

// 送信先を Supabase テーブルへ INSERT に切替。path(snapshot/mock/events)でテーブルと整形を分岐。
// 失敗(error/例外)は false を返し、既存のキュー(enqueue/flush)が再送する。
async function post(path: string, body: unknown): Promise<boolean> {
  const b = body as Record<string, unknown>;
  try {
    const acc = (b.accountId as string) ?? null; // ログイン中のみ非null(=アカウント紐づけ)
    if (path === 'snapshot') {
      const { error } = await supabase.from('tel_snapshot').insert({ anon_id: b.anonId, account_id: acc, day: b.day, data: b });
      return !error;
    }
    if (path === 'mock') {
      const { error } = await supabase.from('tel_mock').insert({
        anon_id: b.anonId, account_id: acc, level: b.level ?? null, is_full: b.full ?? null,
        pct: b.pct ?? null, sections: b.sections ?? null, timed_out: b.timedOut ?? null, elapsed_sec: b.elapsedSec ?? null,
      });
      return !error;
    }
    // 'events' (answers/error/session/language_changed 等)
    const { error } = await supabase.from('tel_event').insert({ anon_id: b.anonId, account_id: acc, name: b.name, props: b.props ?? null, level: b.level ?? null });
    return !error;
  } catch { return false; }
}
async function enqueue(path: string, body: unknown): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(K_QUEUE);
    const q: { path: string; body: unknown }[] = raw ? JSON.parse(raw) : [];
    q.push({ path, body });
    if (q.length > 200) q.splice(0, q.length - 200); // 上限(オフライン肥大防止)
    await AsyncStorage.setItem(K_QUEUE, JSON.stringify(q));
  } catch { /* noop */ }
}
/** キューを順に再送。オンライン復帰時に呼ぶ。 */
export async function flush(): Promise<void> {
  if (!enabled) return;
  try {
    const raw = await AsyncStorage.getItem(K_QUEUE);
    if (!raw) return;
    const q: { path: string; body: unknown }[] = JSON.parse(raw);
    const rest: { path: string; body: unknown }[] = [];
    for (const it of q) { if (!(await post(it.path, it.body))) rest.push(it); }
    await AsyncStorage.setItem(K_QUEUE, JSON.stringify(rest));
  } catch { /* noop */ }
}
async function send(path: string, body: Record<string, unknown>): Promise<void> {
  if (!enabled) return;
  if (accountId && body.accountId == null) body.accountId = accountId; // ログイン中はアカウントを添付(送信時点で確定・キュー滞留分も保持)
  if (!(await post(path, body))) await enqueue(path, body);
}

function snapshotBody(state: AppState, anon: string, now: number): Record<string, unknown> {
  const level = state.settings.level;
  const r = readinessFor(state, now);
  const rings = ringsFor(state, now);
  const remaining = {} as Record<Category, number>;
  const total = {} as Record<Category, number>;
  for (const c of CATS) {
    const ids = allItemIdsFor(level, c);
    total[c] = ids.length;
    remaining[c] = ids.filter((id) => !state.items[id]).length;
  }
  const exhausted = CATS.filter((c) => remaining[c] <= EXHAUST_THRESHOLD);
  const cov = coverageBars(state, now); // 漢字/語彙/文法 カバー率
  const covMap = Object.fromEntries(cov.map((b) => [b.key, { learned: b.learned, total: b.total }]));
  const rank = levelRank(state, now);
  const exam = state.settings.targetExam ?? 'jlpt';
  const daysToExam = state.settings.examDate ? daysBetween(dayStr(now), state.settings.examDate) : null;
  // 大問別 習得数(正解相当)＝[learned,total] の配列。管理ダッシュボードの「大問別正解数」用。
  // 文字語彙5＋文法3 に、読解4区分・聴解5区分(キー: dokkai_*/choukai_*)を足して全大問を1つの表に載せる。
  const daimonMap = Object.fromEntries([
    ...daimonMasteryCounts(state, now).map((d) => [d.daimon, [d.learned, d.total]]),
    ...passageMasteryCounts(state, now).map((p) => [p.key, [p.learned, p.total]]),
  ]);
  // 得意(=いちばん出来ている区分)を正解率リングから求める。管理ダッシュボードのプロフィール列用。
  const FACET_JA: Record<string, string> = { moji_goi: '文字・語彙', bunpou: '文法', dokkai: '読解', choukai: '聴解' };
  const facetVals: Record<string, number> = { moji_goi: rings.moji_goi ?? 0, bunpou: rings.bunpou ?? 0, dokkai: rings.dokkai ?? 0, choukai: rings.choukai ?? 0 };
  const strongKey = Object.keys(facetVals).reduce((a, b) => (facetVals[b] > facetVals[a] ? b : a), 'moji_goi');
  // 予想得点(アプリの主指標)。expectedScoreFor: { score(得点), max(満点), passTotal(合格ライン) }。失敗時はnull。
  const est = (() => { try { return expectedScoreFor(state, now); } catch { return null; } })();
  return {
    v: 4, anonId: anon, app: APP_VERSION, platform: getPlatform().OS, osVersion: String(getPlatform().Version ?? ''),
    uiLang: state.settings.uiLang || '', level, exam, day: dayStr(now),
    // 質(正解率リング)＋合格率＋信頼幅
    readiness: { total: r.score, passProb: r.passProbability, band: r.band, passing: r.passing,
      moji_goi: rings.moji_goi, bunpou: rings.bunpou, dokkai: rings.dokkai, choukai: rings.choukai,
      // 予想得点(現行の主指標)。管理ダッシュボードの「到達度」列を予想得点に更新するため。
      predScore: est?.score ?? null, predMax: est?.max ?? null, passTotal: est?.passTotal ?? null },
    // 量(カバー率)＋達成ランク
    coverage: covMap, rankPct: rank.pct, rankIndex: rank.rankIndex,
    daimonMastery: daimonMap, // 大問別 [習得数,母数]（8大問: 文字語彙5＋文法3）
    stock: stockCounts(state, level), // 在庫 [未出題の残り,母数]（8大問＋単語タブのドリル3種）
    myListCount: (state.myList ?? []).length, // 私の単語帳 登録単語数
    referredQualified: state.referral?.referredQualified ?? 0, // 自分が紹介して継続に達した人数(管理ダッシュボード用)
    learned: learnedNow(state, now),
    streak: state.streak.current, streakLongest: state.streak.longest, freezes: state.streak.freezes,
    mockCount: (state.mockHistory ?? []).length, studyDays: (state.growth ?? []).length,
    studySeconds: state.studySeconds ?? 0, // 累計学習時間(秒)＝前面滞在の合算
    // 管理ダッシュボードのプロフィール列(名前/母語/国名/気分/性格/得意)。読める日本語で送る(気分/性格はキー→ラベル解決済み)。
    profile: {
      nickname: state.settings.nickname ?? null,
      l1: state.settings.l1 ?? null,
      country: state.settings.country ?? null,
      mood: moodMsgOf(state.settings.moodMsg),
      personality: personalityOf(state.settings.personality)?.label ?? null,
      strong: FACET_JA[strongKey] ?? null,
    },

    daysToExam, badgeSet: state.settings.badgeSet ?? 'gorgeous', theme: state.settings.theme,
    reminderOn: !!state.settings.reminder,
    remaining, total, exhausted,
    // リテンション用: 日次スナップショットの有無×経過日でD1/D7/D30をサーバ集計。§8
    installDay: installDayStr(state), daysSinceInstall: daysSinceInstall(state, now),
  };
}

// ── 問題別の回答ログ(将来資源・難易度較正/コンテンツ改善用)。匿名: content-idと正誤のみ ──
type Ans = { i: string; c: 0 | 1; d: string };
let answerBuf: Ans[] = [];
/** 1回答を記録(店舗action経由で全回答を捕捉)。バッファに溜め、背面化/300件でまとめて送信。 */
export function recordAnswer(itemId: string, correct: boolean): void {
  if (!enabled) return;
  answerBuf.push({ i: itemId, c: correct ? 1 : 0, d: dayStr(Date.now()) });
  if (answerBuf.length >= 300) void flushAnswers();
}
/** 回答バッファを100件ずつ 'answers' イベントで送信。 */
export async function flushAnswers(): Promise<void> {
  if (!enabled || answerBuf.length === 0) return;
  const batch = answerBuf.splice(0, answerBuf.length);
  const anon = await anonId();
  for (let i = 0; i < batch.length; i += 100) {
    await send('events', { v: 1, anonId: anon, app: APP_VERSION, ts: Math.floor(Date.now() / 1000), name: 'answers', props: { items: batch.slice(i, i + 100) } });
  }
}
/** クラッシュ/エラー報告(実機の不具合検知)。 */
export async function sendError(message: string, fatal: boolean, screen?: string): Promise<void> {
  if (!enabled) return;
  await send('events', { v: 1, anonId: await anonId(), app: APP_VERSION, ts: Math.floor(Date.now() / 1000), name: 'error', props: { message: String(message).slice(0, 300), fatal, screen: screen || '' } });
}

/** 到達度スナップショット。force=false(前面化)=同日1回のみ / force=true(アプリを閉じる時)=学習後の状態で必ず更新。
 *  サーバは (anonId, day) で upsert ＝ 1ユーザー/日 1行のまま(送信回数が増えても行は増えない)。 */
export async function sendDailySnapshot(state: AppState, now: number, force = false): Promise<void> {
  if (!enabled || state.settings.telemetry === false) return;
  const day = dayStr(now);
  if (!force && (await AsyncStorage.getItem(K_DAY)) === day) { await flush(); return; }
  await send('snapshot', snapshotBody(state, await anonId(), now));
  await AsyncStorage.setItem(K_DAY, day);
  await flush();
}

/** 模試完了イベント。 */
export async function sendMock(m: {
  level: string; full: boolean; pct: number; sections: Record<string, number | null>; timedOut: boolean; elapsedSec: number;
}): Promise<void> {
  if (!enabled) return;
  await send('mock', { v: 1, anonId: await anonId(), app: APP_VERSION, ts: Math.floor(Date.now() / 1000), ...m });
}

/** 行動イベント(session_start/complete, onboarding_complete, language_changed, listening_download 等)。 */
export async function sendEvent(name: string, props?: Record<string, unknown>, level?: string): Promise<void> {
  if (!enabled) return;
  await send('events', { v: 1, anonId: await anonId(), app: APP_VERSION, ts: Math.floor(Date.now() / 1000), level: level ?? '', name, props: props ?? {} });
}

// ── ライフサイクル計測3点(install / first_session / next_day_open)。各1回だけ・端末ローカルで重複防止。§8
const K_METRICS = 'safa-jlpt:metricsSeen';
async function metricsSeen(): Promise<string[]> {
  try { const r = await AsyncStorage.getItem(K_METRICS); return r ? JSON.parse(r) : []; } catch { return []; }
}
async function markMetricsSeen(names: string[]): Promise<void> {
  try {
    const set = Array.from(new Set([...(await metricsSeen()), ...names]));
    await AsyncStorage.setItem(K_METRICS, JSON.stringify(set));
  } catch { /* noop */ }
}
/** 起動時: install / next_day_open のうち未送信分を1回だけ送る(経過日コホート付き)。 */
export async function sendLifecycleMetrics(state: AppState, now: number): Promise<void> {
  if (!enabled || state.settings.telemetry === false) return;
  const seen = await metricsSeen();
  const cohort = lifecycleCohort(state, now);
  const due: string[] = [];
  if (state.installedAt && !seen.includes(M_INSTALL)) due.push(M_INSTALL);
  const d = daysSinceInstall(state, now);
  if (d != null && d >= 1 && !seen.includes(M_NEXT_DAY_OPEN)) due.push(M_NEXT_DAY_OPEN);
  if (due.length === 0) return;
  for (const name of due) await sendEvent(name, cohort);
  await markMetricsSeen(due);
}
/** 初回セッション完了を1回だけ送る(経過日コホート付き)。学習後の画面から呼ぶ。 */
export async function sendFirstSessionOnce(state: AppState): Promise<void> {
  if (!enabled || state.settings.telemetry === false) return;
  if ((await metricsSeen()).includes(M_FIRST_SESSION)) return;
  await sendEvent(M_FIRST_SESSION, lifecycleCohort(state, Date.now()));
  await markMetricsSeen([M_FIRST_SESSION]);
}
