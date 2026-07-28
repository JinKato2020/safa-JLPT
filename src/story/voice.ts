// 桜の台詞テーブル＋選択エンジン(純関数)。core(一文目)＋flavor(二文目)の2段合成・反復回避・連載(fragment)。
// 台詞は500回目に評価される: 反復と揺れを防ぐため、口調は正本シートに固定してから書く。
// 正本(口調・禁止表現・価値観): docs/superpowers/specs/桜-口調シート.md / 世界観: 同specs §1.5,§3,§4
// ja が正本。en/ne 等は後で一括翻訳(シートを訳者に添付)。UIはここが返す text をそのまま表示。
import { type Wish } from '../store/state';

// 状態(core 一文目)。願い依存は4状態のみ(復帰・大試前夜・合格・不合格)。他3状態は願い非依存。
export type VoiceState =
  | 'daily'       // 通常の出迎え(願い非依存)
  | 'first'       // 入場・初回(願い非依存)
  | 'study_done'  // 学習後の一言(願い非依存)
  | 'return'      // 久しぶりの復帰(願い依存)
  | 'exam_eve'    // 大試/受験の前夜(願い依存)
  | 'pass'        // 合格の日(願い依存)
  | 'fail';       // 不合格の報告(願い依存・慰めない/願いにだけ触れる)

const WISH_DEPENDENT: readonly VoiceState[] = ['return', 'exam_eve', 'pass', 'fail'];
// 願い専用台詞を持つ種類(custom/later は neutral `_` にフォールバック)。
const WISH_KEYS = ['work_live', 'study', 'talk', 'family', 'like', 'self'] as const;

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type TimeBand = 'morning' | 'noon' | 'night';

export interface Line { id: string; text: string }

// ── core 台詞(ja 正本)。全語ルビ前提のN5語彙・24字2文以内・絵文字なし・数値/比較/能力評価を出さない。
// 願い依存4状態は key = `${state}:${wish}`(neutral は `:_`)。他は key = state。
export const CORE_LINES: Record<string, Line[]> = {
  daily: [
    { id: 'daily.1', text: '今日も来てくれたんだね。' },
    { id: 'daily.2', text: 'また会えたね。' },
    { id: 'daily.3', text: 'ここで待っていたよ。' },
  ],
  first: [
    { id: 'first.1', text: 'はじめまして。わたしは桜。' },
    { id: 'first.2', text: 'この書斎へ、ようこそ。' },
  ],
  study_done: [
    { id: 'study_done.1', text: '一つ、書き記したよ。' },
    { id: 'study_done.2', text: '今日のぶん、置いておくね。' },
    { id: 'study_done.3', text: 'よく手を動かしたね。' },
  ],
  // 復帰: 願いを預かったままだと伝える(責めない・煽らない)。
  'return:_': [{ id: 'return._.1', text: 'おかえり。待っていたよ。' }],
  'return:work_live': [{ id: 'return.work_live.1', text: 'おかえり。暮らしの言葉、預かったままだよ。' }],
  'return:study': [{ id: 'return.study.1', text: 'おかえり。学びへの道、忘れていないよ。' }],
  'return:talk': [{ id: 'return.talk.1', text: 'おかえり。話したい人のこと、覚えているよ。' }],
  'return:family': [{ id: 'return.family.1', text: 'おかえり。家族への言葉、ここにあるよ。' }],
  'return:like': [{ id: 'return.like.1', text: 'おかえり。好きの言葉、まだ光っているよ。' }],
  'return:self': [{ id: 'return.self.1', text: 'おかえり。挑む気持ち、預かったままだよ。' }],
  // 大試前夜: 「◯◯のために始めたね。いってらっしゃい」。
  'exam_eve:_': [{ id: 'exam_eve._.1', text: 'いってらっしゃい。ここで待つよ。' }],
  'exam_eve:work_live': [{ id: 'exam_eve.work_live.1', text: '暮らしのために始めたね。いってらっしゃい。' }],
  'exam_eve:study': [{ id: 'exam_eve.study.1', text: '学ぶために始めたね。いってらっしゃい。' }],
  'exam_eve:talk': [{ id: 'exam_eve.talk.1', text: '話すために始めたね。いってらっしゃい。' }],
  'exam_eve:family': [{ id: 'exam_eve.family.1', text: '家族のために始めたね。いってらっしゃい。' }],
  'exam_eve:like': [{ id: 'exam_eve.like.1', text: '好きのために始めたね。いってらっしゃい。' }],
  'exam_eve:self': [{ id: 'exam_eve.self.1', text: '自分のために始めたね。いってらっしゃい。' }],
  // 合格: まず「叶ったね」。書き換えの勧めはUIフロー側。
  'pass:_': [{ id: 'pass._.1', text: '叶ったね。' }],
  'pass:work_live': [{ id: 'pass.work_live.1', text: '叶ったね。暮らしへの一歩だね。' }],
  'pass:study': [{ id: 'pass.study.1', text: '叶ったね。学びへ進めるね。' }],
  'pass:talk': [{ id: 'pass.talk.1', text: '叶ったね。あの人と話せるね。' }],
  'pass:family': [{ id: 'pass.family.1', text: '叶ったね。家族に届いたね。' }],
  'pass:like': [{ id: 'pass.like.1', text: '叶ったね。好きにまっすぐだね。' }],
  'pass:self': [{ id: 'pass.self.1', text: '叶ったね。よく挑んだね。' }],
  // 不合格: 慰めない。願いが消えないことにだけ静かに触れる(責め・励ましの押し付けをしない)。
  'fail:_': [{ id: 'fail._.1', text: 'また、ここから書こう。' }],
  'fail:work_live': [{ id: 'fail.work_live.1', text: '暮らしへの道は、消えないよ。' }],
  'fail:study': [{ id: 'fail.study.1', text: '学びへの道は、まだ続くよ。' }],
  'fail:talk': [{ id: 'fail.talk.1', text: '話したい気持ちは、そのままだよ。' }],
  'fail:family': [{ id: 'fail.family.1', text: '家族への想いは、変わらないよ。' }],
  'fail:like': [{ id: 'fail.like.1', text: '好きは、消えないよ。' }],
  'fail:self': [{ id: 'fail.self.1', text: '挑む気持ちは、まだここにあるよ。' }],
};

// ── flavor 台詞(二文目・付いたり付かなかったり)。season / time の2系統。
export const FLAVOR_SEASON: Record<Season, Line[]> = {
  spring: [{ id: 'fl.spring.1', text: '桜が咲きはじめたよ。' }, { id: 'fl.spring.2', text: '春の風だね。' }],
  summer: [{ id: 'fl.summer.1', text: '日ざしが強いね。' }, { id: 'fl.summer.2', text: '夏の音がするよ。' }],
  autumn: [{ id: 'fl.autumn.1', text: '葉が色づいてきたね。' }, { id: 'fl.autumn.2', text: '秋の匂いだね。' }],
  winter: [{ id: 'fl.winter.1', text: '息が白いね。' }, { id: 'fl.winter.2', text: '静かな冬だね。' }],
};
export const FLAVOR_TIME: Record<TimeBand, Line[]> = {
  morning: [{ id: 'fl.morning.1', text: 'いい朝だね。' }, { id: 'fl.morning.2', text: '朝の光だね。' }],
  noon: [{ id: 'fl.noon.1', text: 'お昼だね。' }, { id: 'fl.noon.2', text: '日が高いね。' }],
  night: [{ id: 'fl.night.1', text: 'もう夜だね。' }, { id: 'fl.night.2', text: '静かな夜だね。' }],
};

// ── 連載(fragment)。世界のかけらを順不同・短く・答えを出さず話す。棚に増えいつでも読み返せる。
export const FRAGMENTS: Line[] = [
  { id: 'frag.1', text: 'この書斎、昔は誰かの部屋だったの。' },
  { id: 'frag.2', text: 'この筆、どこで拾ったか覚えていないな。' },
  { id: 'frag.3', text: '貝殻を集める理由、いつか話すね。' },
  { id: 'frag.4', text: '棚の奥の本、まだ読めないんだ。' },
  { id: 'frag.5', text: '窓の外の桜、毎年少し違うんだよ。' },
];

// 願い依存状態かつ実願いなら `${state}:${wish}`、それ以外は neutral/state のキーを返す。
export function coreKey(state: VoiceState, wish?: Wish): string {
  if (!WISH_DEPENDENT.includes(state)) return state;
  const k = wish?.kind;
  if (k && (WISH_KEYS as readonly string[]).includes(k)) return `${state}:${k}`;
  return `${state}:_`;
}

// 反復回避: 直近IDを除いて seed で1本選ぶ。全部除外なら除外を無視。seed∈[0,1)。
export function pickLine(cands: Line[], seed: number, recent: readonly string[] = []): Line | null {
  if (cands.length === 0) return null;
  const pool = cands.filter((l) => !recent.includes(l.id));
  const use = pool.length > 0 ? pool : cands;
  const i = Math.min(use.length - 1, Math.max(0, Math.floor(seed * use.length)));
  return use[i];
}

// epoch ms → 季節/時間帯(ローカル基準・dayStr と揃える)。
export function seasonOf(now: number): Season {
  const m = new Date(now).getMonth() + 1;
  if (m >= 3 && m <= 5) return 'spring';
  if (m >= 6 && m <= 8) return 'summer';
  if (m >= 9 && m <= 11) return 'autumn';
  return 'winter';
}
export function timeBandOf(now: number): TimeBand {
  const h = new Date(now).getHours();
  if (h < 11) return 'morning';
  if (h < 17) return 'noon';
  return 'night';
}

/** core を1本選ぶ(状態＋願いでキーを決めて反復回避)。 */
export function pickCore(state: VoiceState, wish: Wish | undefined, seed: number, recent: readonly string[] = []): Line | null {
  return pickLine(CORE_LINES[coreKey(state, wish)] ?? [], seed, recent);
}

/** flavor を1本選ぶ。season と time を交互(seedの上位ビット)に選び反復回避。 */
export function pickFlavor(now: number, seed: number, recent: readonly string[] = []): Line | null {
  const useTime = seed >= 0.5;
  const s2 = (seed % 0.5) * 2; // 0..1 に正規化
  const pool = useTime ? FLAVOR_TIME[timeBandOf(now)] : FLAVOR_SEASON[seasonOf(now)];
  return pickLine(pool, s2, recent);
}

export interface VoiceResult { text: string; ids: string[] }

/** 文の数(。区切り・体言止めも1文)。「最大2文」判定用。 */
export function sentenceCount(text: string): number {
  return text.split('。').filter((s) => s.length > 0).length;
}

/**
 * 台詞を合成する。variant='full' なら flavor を付け、'short' なら core だけ(減衰レイヤーと連動)。
 * flavor は core が1文のときだけ付ける(合成後も最大2文を保つ・口調シート)。
 * ids は反復回避用に呼び出し側が recent へ積む。core が無ければ空文字(UIは出さない)。
 */
export function composeVoice(opts: {
  state: VoiceState;
  wish?: Wish;
  variant?: 'full' | 'short';
  now: number;
  seed: number;
  seedFlavor?: number;
  recent?: readonly string[];
}): VoiceResult {
  const recent = opts.recent ?? [];
  const core = pickCore(opts.state, opts.wish, opts.seed, recent);
  if (!core) return { text: '', ids: [] };
  if (opts.variant === 'short' || sentenceCount(core.text) >= 2) return { text: core.text, ids: [core.id] };
  const flavor = pickFlavor(opts.now, opts.seedFlavor ?? opts.seed, recent);
  if (!flavor) return { text: core.text, ids: [core.id] };
  return { text: core.text + flavor.text, ids: [core.id, flavor.id] };
}

/** 連載のかけらを1つ選ぶ(反復回避)。 */
export function pickFragment(seed: number, recent: readonly string[] = []): Line | null {
  return pickLine(FRAGMENTS, seed, recent);
}
