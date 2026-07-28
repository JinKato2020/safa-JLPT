// 桜の台詞テーブル＋選択エンジン(純関数)。core(一文目)＋flavor(二文目)の2段合成・反復回避・連載(fragment)。
// 【配分の原則】行数は状態の"重要度"でなく、その棚で"実際に引く回数"に比例させる。
//   daily(出迎え)は streak棚で引く回数が全く違う: A=3回だけ/B=27回/C=無限。均等8枚はAで死蔵・Cで永久周回。
//   → A4 / B14 / C1(31-90)12。C2(91-)20・C3(366-)12 は「在庫の後払い」=ユーザーが到達する直前に書く
//     (31日到達は最短でリリース1か月後・その頃には実使用が分かり良い台詞が書ける)。未執筆なら下の棚へフォールバック。
// 【役割分担】出迎えは「変わらない安心」を担当。挨拶は繰り返すのが自然(毎朝ちがう名言を言う家族は不気味)。
//   危ないのは繰り返しでなく「機械が回してる」と分かること。新鮮味は出迎えでなく"出来事"が運ぶ:
//   季節(年4)・100/365の節目・語の卒業(週1)・連載(週1)・大試/合否(年1-2)。変化の予算を出迎えに全振りしない。
// 【flavorは"同時に使える数"で数える】春は春の在庫しか使えない(夏12本は存在しないのと同じ)。
//   → 季節4×8=32 / 時間3×6=18。掛け算(呼びかけ×本文)は見た目を増やすが新鮮味は本文の数でしか増えない。
// 台詞は500回目に評価される: 口調は正本シートに固定してから書く(後から通すと全書き直し)。
// 正本(口調・禁止表現・価値観): docs/superpowers/specs/桜-口調シート.md / 世界観: 同specs §1.5,§3,§4
// ja が正本。en/ne 等は後で一括翻訳(シートを訳者に添付)。UIはここが返す text をそのまま表示。
import { type Wish } from '../store/state';

// 願い専用台詞を持つ種類(custom/later/未設定は neutral `_` にフォールバック)。
const WISH_KEYS = ['work_live', 'study', 'talk', 'family', 'like', 'self'] as const;

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type TimeBand = 'morning' | 'noon' | 'night';

export interface Line { id: string; text: string }

// 発火の機会。行数は各プールの発火頻度に比例(下の CORE_LINES を参照)。
export type Occasion =
  | { kind: 'daily'; streakDays: number }               // 毎回の出迎え(streakで棚を分ける・最頻)
  | { kind: 'streak_mark' }                              // 連続の節目(まれ・再登場しない)
  | { kind: 'session_end' }                              // 学習後(減衰で none へ)
  | { kind: 'word_graduate' }                            // 手習いの間で苦手語を卒業
  | { kind: 'first' }                                    // 入場・初回(一生に一度)
  | { kind: 'comeback'; absenceDays: number; wish?: Wish } // 復帰(空白の長さで段階・願い依存)
  | { kind: 'exam'; timing: 'eve' | 'day' | 'after'; wish?: Wish } // 大試 前夜/当日/翌日(願い依存)
  | { kind: 'result'; outcome: 'pass' | 'fail'; wish?: Wish }      // 合否の報告(願い依存)
  | { kind: 'milestone'; wish?: Wish };                 // 到達の節目(リング満ち等・願い依存)

// ── core 台詞(ja 正本)。全語ルビ前提のN5語彙・24字2文以内・絵文字なし・数値/比較/能力評価を出さない。
export const CORE_LINES: Record<string, Line[]> = {
  // daily: streak棚。引く回数に比例(A=3回だけ→4本 / B=27回→14本 / C1=無限区間→12本)。片道なので下の棚は二度と出ない。
  'daily:a': [ // 1〜3日(3回だけ引く): 歓迎・そっと。4本で十分
    { id: 'daily.a.1', text: '今日も来てくれたんだね。' },
    { id: 'daily.a.2', text: 'また会えたね。' },
    { id: 'daily.a.3', text: 'ここで待っていたよ。' },
    { id: 'daily.a.4', text: '来たね。うれしいよ。' },
  ],
  'daily:b': [ // 4〜30日(27回引く): 習慣化。14本で27日を2周弱=気づかれにくい
    { id: 'daily.b.1', text: '今日も来たね。いい流れだね。' },
    { id: 'daily.b.2', text: 'また灯りがついたね。' },
    { id: 'daily.b.3', text: '続いているね。うれしいよ。' },
    { id: 'daily.b.4', text: 'おかえり、と言いたくなるね。' },
    { id: 'daily.b.5', text: '今日の分、書こうか。' },
    { id: 'daily.b.6', text: 'そのペース、いいね。' },
    { id: 'daily.b.7', text: '手が慣れてきたね。' },
    { id: 'daily.b.8', text: '今日もここにいるね。' },
    { id: 'daily.b.9', text: 'もう慣れてきたかな。' },
    { id: 'daily.b.10', text: '毎日、顔を見せてくれるね。' },
    { id: 'daily.b.11', text: '机の前が、板についてきたね。' },
    { id: 'daily.b.12', text: '今日の一枚、始めようか。' },
    { id: 'daily.b.13', text: '来るのが、あたりまえになったね。' },
    { id: 'daily.b.14', text: 'きちんと、戻ってくるね。' },
  ],
  'daily:c1': [ // 31〜90日(無限区間の入口): 静かな信頼・変化=18本。C2(91-)/C3(366-)は後払い→この棚へフォールバック
    { id: 'daily.c1.1', text: 'ずいぶん長く、続けているね。' },
    { id: 'daily.c1.2', text: 'この書斎も、見慣れた顔だね。' },
    { id: 'daily.c1.3', text: '遠くまで来たね。' },
    { id: 'daily.c1.4', text: '静かに、続いているね。' },
    { id: 'daily.c1.5', text: '毎日の音になったね。' },
    { id: 'daily.c1.6', text: 'ここが、居場所になったね。' },
    { id: 'daily.c1.7', text: 'よく通う道になったね。' },
    { id: 'daily.c1.8', text: '変わらず、来てくれるね。' },
    { id: 'daily.c1.9', text: 'すっかり、日課になったね。' },
    { id: 'daily.c1.10', text: '長い付き合いになったね。' },
    { id: 'daily.c1.11', text: 'この席、あたたかいままだね。' },
    { id: 'daily.c1.12', text: '変わらないね。それがいいよ。' },
    { id: 'daily.c1.13', text: 'すっかり顔なじみだね。' },
    { id: 'daily.c1.14', text: 'ここに来る音、覚えたよ。' },
    { id: 'daily.c1.15', text: '長いね。ありがとう。' },
    { id: 'daily.c1.16', text: 'まだ隣にいてくれるね。' },
    { id: 'daily.c1.17', text: '慣れた道を、今日も来たね。' },
    { id: 'daily.c1.18', text: '変わらず、灯りがつくね。' },
  ],
  // daily:c2 (91〜365日=20本) / daily:c3 (366日〜=12本) は在庫の後払い。未執筆の間は c1 へフォールバック(pickCore)。
  streak_mark: [
    { id: 'streak_mark.1', text: '灯りが、また一つ増えたね。' },
    { id: 'streak_mark.2', text: 'ここまで続いたね。' },
    { id: 'streak_mark.3', text: '節目だね。よく歩いたね。' },
    { id: 'streak_mark.4', text: '一区切りだね。' },
  ],
  session_end: [
    { id: 'session_end.1', text: '一つ、書き記したよ。' },
    { id: 'session_end.2', text: '今日のぶん、置いておくね。' },
    { id: 'session_end.3', text: 'よく手を動かしたね。' },
    { id: 'session_end.4', text: '一歩、進んだね。' },
    { id: 'session_end.5', text: '今日も一枚、拾えたね。' },
    { id: 'session_end.6', text: '書けたね。ここに残すよ。' },
    { id: 'session_end.7', text: '手を動かした分、残るよ。' },
    { id: 'session_end.8', text: 'お疲れさま。よく来たね。' },
    { id: 'session_end.9', text: '今日の筆、置いておくね。' },
    { id: 'session_end.10', text: '少しずつだね。それでいいよ。' },
    { id: 'session_end.11', text: '続きは、また今度でいいよ。' },
    { id: 'session_end.12', text: 'ここまでにしようか。' },
  ],
  word_graduate: [
    { id: 'word_graduate.1', text: 'この言葉、もう手になじんだね。' },
    { id: 'word_graduate.2', text: '一つ、卒業だね。' },
    { id: 'word_graduate.3', text: 'つまずいた場所、越えたね。' },
    { id: 'word_graduate.4', text: 'この字、書けるようになったね。' },
    { id: 'word_graduate.5', text: '苦手が、一つ減ったね。' },
    { id: 'word_graduate.6', text: 'よく覚えたね。もう大丈夫。' },
    { id: 'word_graduate.7', text: 'ここは、もう任せられるね。' },
    { id: 'word_graduate.8', text: '手習いが、実ったね。' },
  ],
  // comeback: 空白の長さで段階(short/mid/long)。復帰は効きどころ=願いを預かったままと伝える(責めない)。
  'comeback:short:_': [{ id: 'comeback.short._.1', text: 'おかえり。待っていたよ。' }],
  'comeback:short:work_live': [{ id: 'comeback.short.work_live.1', text: 'おかえり。暮らしの言葉、預かったままだよ。' }],
  'comeback:short:study': [{ id: 'comeback.short.study.1', text: 'おかえり。学びへの道、覚えているよ。' }],
  'comeback:short:talk': [{ id: 'comeback.short.talk.1', text: 'おかえり。話したい人のこと、忘れていないよ。' }],
  'comeback:short:family': [{ id: 'comeback.short.family.1', text: 'おかえり。家族への言葉、ここにあるよ。' }],
  'comeback:short:like': [{ id: 'comeback.short.like.1', text: 'おかえり。好きの言葉、まだ光ってるよ。' }],
  'comeback:short:self': [{ id: 'comeback.short.self.1', text: 'おかえり。挑む気持ち、預かったままだよ。' }],
  'comeback:mid:_': [{ id: 'comeback.mid._.1', text: 'おかえり。ちゃんといたよ。' }],
  'comeback:mid:work_live': [{ id: 'comeback.mid.work_live.1', text: 'おかえり。暮らしの願い、消えてないよ。' }],
  'comeback:mid:study': [{ id: 'comeback.mid.study.1', text: 'おかえり。学びへの道、閉じてないよ。' }],
  'comeback:mid:talk': [{ id: 'comeback.mid.talk.1', text: 'おかえり。あの人のこと、まだここにあるよ。' }],
  'comeback:mid:family': [{ id: 'comeback.mid.family.1', text: 'おかえり。家族への想い、預かってるよ。' }],
  'comeback:mid:like': [{ id: 'comeback.mid.like.1', text: 'おかえり。好きは、そのままだよ。' }],
  'comeback:mid:self': [{ id: 'comeback.mid.self.1', text: 'おかえり。挑む気持ち、まだあるよ。' }],
  'comeback:long:_': [{ id: 'comeback.long._.1', text: 'おかえり。ずっと、ここにいたよ。' }],
  'comeback:long:work_live': [{ id: 'comeback.long.work_live.1', text: 'おかえり。暮らしの言葉、ずっと持ってたよ。' }],
  'comeback:long:study': [{ id: 'comeback.long.study.1', text: 'おかえり。学びへの道、ずっとあけてたよ。' }],
  'comeback:long:talk': [{ id: 'comeback.long.talk.1', text: 'おかえり。話したい人のこと、ずっと覚えてた。' }],
  'comeback:long:family': [{ id: 'comeback.long.family.1', text: 'おかえり。家族への言葉、ずっとここに。' }],
  'comeback:long:like': [{ id: 'comeback.long.like.1', text: 'おかえり。好きの言葉、消さずにいたよ。' }],
  'comeback:long:self': [{ id: 'comeback.long.self.1', text: 'おかえり。挑む気持ち、ずっと預かってた。' }],
  // exam: 前夜/当日/翌日。前夜=「◯◯のために始めたね。いってらっしゃい」。
  'exam:eve:_': [{ id: 'exam.eve._.1', text: 'いってらっしゃい。ここで待つよ。' }],
  'exam:eve:work_live': [{ id: 'exam.eve.work_live.1', text: '暮らしのために始めたね。いってらっしゃい。' }],
  'exam:eve:study': [{ id: 'exam.eve.study.1', text: '学ぶために始めたね。いってらっしゃい。' }],
  'exam:eve:talk': [{ id: 'exam.eve.talk.1', text: '話すために始めたね。いってらっしゃい。' }],
  'exam:eve:family': [{ id: 'exam.eve.family.1', text: '家族のために始めたね。いってらっしゃい。' }],
  'exam:eve:like': [{ id: 'exam.eve.like.1', text: '好きのために始めたね。いってらっしゃい。' }],
  'exam:eve:self': [{ id: 'exam.eve.self.1', text: '自分のために始めたね。いってらっしゃい。' }],
  'exam:day:_': [{ id: 'exam.day._.1', text: '今日だね。いってらっしゃい。' }],
  'exam:day:work_live': [{ id: 'exam.day.work_live.1', text: '暮らしへの一日だね。いってらっしゃい。' }],
  'exam:day:study': [{ id: 'exam.day.study.1', text: '学びへの一日だね。いってらっしゃい。' }],
  'exam:day:talk': [{ id: 'exam.day.talk.1', text: 'あの人へ近づく日だね。いってらっしゃい。' }],
  'exam:day:family': [{ id: 'exam.day.family.1', text: '家族への一日だね。いってらっしゃい。' }],
  'exam:day:like': [{ id: 'exam.day.like.1', text: '好きへ向かう日だね。いってらっしゃい。' }],
  'exam:day:self': [{ id: 'exam.day.self.1', text: '挑む日だね。いってらっしゃい。' }],
  'exam:after:_': [{ id: 'exam.after._.1', text: 'おかえり。よく行ってきたね。' }],
  'exam:after:work_live': [{ id: 'exam.after.work_live.1', text: 'おかえり。暮らしへ、一歩進んだね。' }],
  'exam:after:study': [{ id: 'exam.after.study.1', text: 'おかえり。学びへ、一歩進んだね。' }],
  'exam:after:talk': [{ id: 'exam.after.talk.1', text: 'おかえり。あの人へ、近づいたね。' }],
  'exam:after:family': [{ id: 'exam.after.family.1', text: 'おかえり。家族へ、また一歩だね。' }],
  'exam:after:like': [{ id: 'exam.after.like.1', text: 'おかえり。好きへ、まっすぐだったね。' }],
  'exam:after:self': [{ id: 'exam.after.self.1', text: 'おかえり。よく挑んだね。' }],
  // result: 合格=まず「叶ったね」。不合格=慰めない・願いが消えないことにだけ静かに触れる。
  'result:pass:_': [{ id: 'result.pass._.1', text: '叶ったね。' }],
  'result:pass:work_live': [{ id: 'result.pass.work_live.1', text: '叶ったね。暮らしへの一歩だね。' }],
  'result:pass:study': [{ id: 'result.pass.study.1', text: '叶ったね。学びへ進めるね。' }],
  'result:pass:talk': [{ id: 'result.pass.talk.1', text: '叶ったね。あの人と話せるね。' }],
  'result:pass:family': [{ id: 'result.pass.family.1', text: '叶ったね。家族に届いたね。' }],
  'result:pass:like': [{ id: 'result.pass.like.1', text: '叶ったね。好きにまっすぐだね。' }],
  'result:pass:self': [{ id: 'result.pass.self.1', text: '叶ったね。よく挑んだね。' }],
  'result:fail:_': [{ id: 'result.fail._.1', text: 'また、ここから書こう。' }],
  'result:fail:work_live': [{ id: 'result.fail.work_live.1', text: '暮らしへの道は、消えないよ。' }],
  'result:fail:study': [{ id: 'result.fail.study.1', text: '学びへの道は、まだ続くよ。' }],
  'result:fail:talk': [{ id: 'result.fail.talk.1', text: '話したい気持ちは、そのままだよ。' }],
  'result:fail:family': [{ id: 'result.fail.family.1', text: '家族への想いは、変わらないよ。' }],
  'result:fail:like': [{ id: 'result.fail.like.1', text: '好きは、消えないよ。' }],
  'result:fail:self': [{ id: 'result.fail.self.1', text: '挑む気持ちは、まだここにあるよ。' }],
  // milestone: 到達の節目(リングが満ちる等)。
  'milestone:_': [{ id: 'milestone._.1', text: '輪が満ちたね。ここまで来たね。' }],
  'milestone:work_live': [{ id: 'milestone.work_live.1', text: '輪が満ちたね。暮らしへ、また一歩。' }],
  'milestone:study': [{ id: 'milestone.study.1', text: '輪が満ちたね。学びへ、また一歩。' }],
  'milestone:talk': [{ id: 'milestone.talk.1', text: '輪が満ちたね。あの人へ、近づいたね。' }],
  'milestone:family': [{ id: 'milestone.family.1', text: '輪が満ちたね。家族へ、届きそうだね。' }],
  'milestone:like': [{ id: 'milestone.like.1', text: '輪が満ちたね。好きへ、まっすぐだね。' }],
  'milestone:self': [{ id: 'milestone.self.1', text: '輪が満ちたね。よく挑んできたね。' }],
  first: [
    { id: 'first.1', text: 'はじめまして。わたしは桜。' },
    { id: 'first.2', text: 'この書斎へ、ようこそ。' },
  ],
};

// ── flavor 台詞(二文目・付いたり付かなかったり)。"同時に使える数"で数える: season 4×8 ／ time 3×6。
//    春は春の8本しか使えない(夏の在庫は存在しないのと同じ)。1季あたり2〜3周に収める狙い。
export const FLAVOR_SEASON: Record<Season, Line[]> = {
  spring: [
    { id: 'fl.spring.1', text: '桜が咲きはじめたよ。' }, { id: 'fl.spring.2', text: '春の風だね。' },
    { id: 'fl.spring.3', text: '花の匂いがするね。' }, { id: 'fl.spring.4', text: '日が長くなったね。' },
    { id: 'fl.spring.5', text: 'あたたかくなってきたね。' }, { id: 'fl.spring.6', text: '鳥の声が増えたね。' },
    { id: 'fl.spring.7', text: '芽が出てきたね。' }, { id: 'fl.spring.8', text: '空がやわらかいね。' },
  ],
  summer: [
    { id: 'fl.summer.1', text: '日ざしが強いね。' }, { id: 'fl.summer.2', text: '夏の音がするよ。' },
    { id: 'fl.summer.3', text: '風が生ぬるいね。' }, { id: 'fl.summer.4', text: '空が高いね。' },
    { id: 'fl.summer.5', text: '蝉が鳴いているね。' }, { id: 'fl.summer.6', text: '夕立が来そうだね。' },
    { id: 'fl.summer.7', text: '汗ばむ日だね。' }, { id: 'fl.summer.8', text: '緑が濃いね。' },
  ],
  autumn: [
    { id: 'fl.autumn.1', text: '葉が色づいてきたね。' }, { id: 'fl.autumn.2', text: '秋の匂いだね。' },
    { id: 'fl.autumn.3', text: '日が短くなったね。' }, { id: 'fl.autumn.4', text: '風が涼しいね。' },
    { id: 'fl.autumn.5', text: '月がきれいだね。' }, { id: 'fl.autumn.6', text: '虫の声がするね。' },
    { id: 'fl.autumn.7', text: '空が澄んできたね。' }, { id: 'fl.autumn.8', text: '少し肌寒いね。' },
  ],
  winter: [
    { id: 'fl.winter.1', text: '息が白いね。' }, { id: 'fl.winter.2', text: '静かな冬だね。' },
    { id: 'fl.winter.3', text: '手がかじかむね。' }, { id: 'fl.winter.4', text: '空気が澄んでるね。' },
    { id: 'fl.winter.5', text: '日暮れが早いね。' }, { id: 'fl.winter.6', text: '雪になりそうだね。' },
    { id: 'fl.winter.7', text: '温かいお茶がほしいね。' }, { id: 'fl.winter.8', text: '星がよく見えるね。' },
  ],
};
export const FLAVOR_TIME: Record<TimeBand, Line[]> = {
  morning: [
    { id: 'fl.morning.1', text: 'いい朝だね。' }, { id: 'fl.morning.2', text: '朝の光だね。' },
    { id: 'fl.morning.3', text: 'まだ静かだね。' }, { id: 'fl.morning.4', text: '目が覚めたね。' },
    { id: 'fl.morning.5', text: '一日が始まるね。' }, { id: 'fl.morning.6', text: '空が明るいね。' },
  ],
  noon: [
    { id: 'fl.noon.1', text: 'お昼だね。' }, { id: 'fl.noon.2', text: '日が高いね。' },
    { id: 'fl.noon.3', text: '明るいね。' }, { id: 'fl.noon.4', text: 'ひと休みだね。' },
    { id: 'fl.noon.5', text: 'お腹がすく頃だね。' }, { id: 'fl.noon.6', text: '日なたが気持ちいいね。' },
  ],
  night: [
    { id: 'fl.night.1', text: 'もう夜だね。' }, { id: 'fl.night.2', text: '静かな夜だね。' },
    { id: 'fl.night.3', text: '月が出てるね。' }, { id: 'fl.night.4', text: '灯りが優しいね。' },
    { id: 'fl.night.5', text: '一日、お疲れさま。' }, { id: 'fl.night.6', text: 'そろそろ休む頃かな。' },
  ],
};

// ── 連載(fragment)。世界のかけらを順不同・短く・答えを出さず話す。棚に増えいつでも読み返せる。再登場しない。
export const FRAGMENTS: Line[] = [
  { id: 'frag.1', text: 'この書斎、昔は誰かの部屋だったの。' },
  { id: 'frag.2', text: 'この筆、どこで拾ったか覚えてないな。' },
  { id: 'frag.3', text: '貝殻を集める理由、いつか話すね。' },
  { id: 'frag.4', text: '棚の奥の本、まだ読めないんだ。' },
  { id: 'frag.5', text: '窓の外の桜、毎年少し違うんだよ。' },
  { id: 'frag.6', text: '昔ここに、犬がもう一匹いた気がする。' },
  { id: 'frag.7', text: 'この墨、香りが少し不思議なんだ。' },
  { id: 'frag.8', text: '屋根裏に、開かない戸があるの。' },
  { id: 'frag.9', text: '掛け軸の絵、時々変わる気がするんだ。' },
  { id: 'frag.10', text: '井戸の水、昔はもっと澄んでたよ。' },
  { id: 'frag.11', text: '庭の灯籠、誰が灯したんだろうね。' },
  { id: 'frag.12', text: 'この鈴、風がないのに鳴る時がある。' },
  { id: 'frag.13', text: '古い手紙が一通、まだ読めていない。' },
  { id: 'frag.14', text: '桜の樹は、わたしより歳上なんだよ。' },
  { id: 'frag.15', text: '縁側の猫、名前をまだ知らないんだ。' },
  { id: 'frag.16', text: '蔵の鍵、どこかにしまい忘れたな。' },
  { id: 'frag.17', text: '夜になると、本の頁が動く気がする。' },
  { id: 'frag.18', text: 'この地図、行き先が書いてないんだ。' },
  { id: 'frag.19', text: '昔の主のこと、少しだけ覚えてる。' },
  { id: 'frag.20', text: '貝殻の一つに、小さな傷があるの。' },
];

// 願いの棚キー(6種のいずれか、または neutral `_`)。
export function wishKey(wish?: Wish): string {
  const k = wish?.kind;
  return k && (WISH_KEYS as readonly string[]).includes(k) ? k : '_';
}

export type DailyShelf = 'a' | 'b' | 'c1' | 'c2' | 'c3';
const DAILY_SHELVES: readonly DailyShelf[] = ['a', 'b', 'c1', 'c2', 'c3'];

// streak日数 → daily の棚。片道でしか進まない(下の棚は二度と出ない)。c2/c3 は在庫の後払い。
export function streakShelf(days: number): DailyShelf {
  if (days <= 3) return 'a';
  if (days <= 30) return 'b';
  if (days <= 90) return 'c1';
  if (days <= 365) return 'c2';
  return 'c3';
}

// 目標棚から下位棚へ降りるキー列(後払いで未執筆の c2/c3 は c1 等へフォールバック)。
function dailyKeysFrom(shelf: DailyShelf): string[] {
  const i = DAILY_SHELVES.indexOf(shelf);
  return DAILY_SHELVES.slice(0, i + 1).reverse().map((s) => `daily:${s}`);
}

// 空白日数 → comeback の段階。
export function comebackStage(days: number): 'short' | 'mid' | 'long' {
  if (days <= 6) return 'short';
  if (days <= 14) return 'mid';
  return 'long';
}

// 機会 → core の(第一候補)キー。daily は未執筆棚へのフォールバックを pickCore が処理。
export function coreKeyFor(o: Occasion): string {
  switch (o.kind) {
    case 'daily': return `daily:${streakShelf(o.streakDays)}`;
    case 'comeback': return `comeback:${comebackStage(o.absenceDays)}:${wishKey(o.wish)}`;
    case 'exam': return `exam:${o.timing}:${wishKey(o.wish)}`;
    case 'result': return `result:${o.outcome}:${wishKey(o.wish)}`;
    case 'milestone': return `milestone:${wishKey(o.wish)}`;
    default: return o.kind; // streak_mark / session_end / word_graduate / first
  }
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

/** core を1本選ぶ。daily は目標棚→下位棚の順で最初の非空プールを使う(後払い棚のフォールバック)。 */
export function pickCore(o: Occasion, seed: number, recent: readonly string[] = []): Line | null {
  const keys = o.kind === 'daily' ? dailyKeysFrom(streakShelf(o.streakDays)) : [coreKeyFor(o)];
  for (const k of keys) {
    const pool = CORE_LINES[k];
    if (pool && pool.length) return pickLine(pool, seed, recent);
  }
  return null;
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
 * flavor は core が1文のときだけ付ける(合成後も最大2文を保つ・口調シート)。→ 主に daily を希釈。
 * ids は反復回避用に呼び出し側が recent へ積む。core が無ければ空文字(UIは出さない)。
 */
export function composeVoice(opts: {
  occasion: Occasion;
  variant?: 'full' | 'short';
  now: number;
  seed: number;
  seedFlavor?: number;
  recent?: readonly string[];
}): VoiceResult {
  const recent = opts.recent ?? [];
  const core = pickCore(opts.occasion, opts.seed, recent);
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
