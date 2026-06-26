// 匿名・追跡なしの利用状況計測(v1.1)。到達度/区分別/新規枯渇/模試/行動イベントを
// Cloudflare Worker へ送る。settings.telemetry=false で完全停止。PII一切なし(匿名UUIDのみ)。
// 設計=計測設計_v1.1.md。送信先は AUDIO_BASE 同様 BASE 1行差替で移行可。
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { dayStr, type AppState } from '../store/state';
import { readinessFor, ringsFor, learnedNow, coverageBars, levelRank } from '../store/selectors';
import { allItemIdsFor } from '../data';
import { daysBetween } from '../store/state';
import type { Category } from '../engine/engine';

const BASE = 'https://t.safa-lang.com/jlpt/v1'; // Cloudflare Worker。未デプロイ時は送信失敗→キューに滞留(無害)。
const APP_VERSION = '1.1.0';
const CATS: Category[] = ['moji_goi', 'bunpou', 'dokkai', 'choukai'];
const EXHAUST_THRESHOLD = 3; // 新規残数がこれ以下=その区分は“枯渇”(コンテンツ不足シグナル)
const K_ANON = 'safa-jlpt:anonId';
const K_QUEUE = 'safa-jlpt:telemetryQueue';
const K_DAY = 'safa-jlpt:telemetryLastDay';

let enabled = true; // App側で settings.telemetry に同期(既定ON)
export function setTelemetryEnabled(on: boolean): void { enabled = on; }

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

async function post(path: string, body: unknown): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    return res.ok;
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
  return {
    v: 2, anonId: anon, app: APP_VERSION, platform: Platform.OS, osVersion: String(Platform.Version ?? ''),
    uiLang: state.settings.uiLang || '', level, exam, day: dayStr(now),
    // 質(正解率リング)＋合格率＋信頼幅
    readiness: { total: r.score, passProb: r.passProbability, band: r.band, passing: r.passing,
      moji_goi: rings.moji_goi, bunpou: rings.bunpou, dokkai: rings.dokkai, choukai: rings.choukai },
    // 量(カバー率)＋達成ランク
    coverage: covMap, rankPct: rank.pct, rankIndex: rank.rankIndex,
    learned: learnedNow(state, now),
    streak: state.streak.current, streakLongest: state.streak.longest, freezes: state.streak.freezes,
    mockCount: (state.mockHistory ?? []).length, studyDays: (state.growth ?? []).length,
    daysToExam, badgeSet: state.settings.badgeSet ?? 'gorgeous', theme: state.settings.theme,
    reminderOn: !!state.settings.reminder,
    remaining, total, exhausted,
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
