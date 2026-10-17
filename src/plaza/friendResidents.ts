// 友だちの公開プロフィールを「町の住人(VirtualLearner)」に変換するヘルパ(純関数・テスト可能)。
// 町の描画・会話は VirtualLearner 型を前提にしているので、実データをこの形へ写す。
import type { FriendProfile } from './friendsClient';
import type { VirtualLearner } from './virtualLearners';
import { flagOf } from './countries';
import { AVATAR_CODES } from './avatars';
import { MAP_G } from './mapCollision';

type Home = { col: number; row: number };
const LEVELS = ['N5', 'N4', 'N3'] as const;

/** FriendProfile → VirtualLearner(会話カード/スプライトが読む形)。home は町側で歩けるマスを渡す。 */
export function friendToLearner(p: FriendProfile, home: Home): VirtualLearner {
  const level = (LEVELS as readonly string[]).includes(p.level) ? (p.level as 'N5' | 'N4' | 'N3') : 'N5';
  const avatar = AVATAR_CODES.includes(p.avatar) ? p.avatar : 'm_boy1';
  return {
    id: 'friend:' + p.user_id,
    nick: p.nickname,
    flag: flagOf(p.country ?? 'XX'),
    level,
    streak: Math.max(0, p.streak ?? 0),
    today: 0,
    avatar,
    home,
    studying: p.studying ?? undefined,
    learned: p.learned ? p.learned : undefined,
    weekLearned: p.week_learned ? p.week_learned : undefined,
    studySeconds: p.study_seconds ? p.study_seconds : undefined,
    strong: p.strong ?? undefined,
    personality: p.personality ?? undefined,
    moodMsg: p.mood_msg ?? undefined,
    // 単語帳(id参照だけ)。share_words=false なら空配列で来る=会話画面で単語帳ボタンを出さない。
    words: Array.isArray(p.words) ? p.words.filter((r) => r && (r.type === 'vocab' || r.type === 'kanji' || r.type === 'grammar') && typeof r.id === 'string') : [],
    shareWords: p.share_words !== false,
  };
}

/**
 * 友だちの配置マスを、歩けるマスから均等に選ぶ。既存の配置(仮想学習者/建物)とかぶらないよう exclude を避ける。
 * isWalkable(col,row)=そのマスが歩けるか。count 人ぶん返す(足りなければある分だけ)。
 */
export function pickFriendHomes(
  count: number,
  isWalkable: (col: number, row: number) => boolean,
  exclude: readonly Home[] = [],
): Home[] {
  if (count <= 0) return [];
  const taken = new Set(exclude.map((e) => `${e.col},${e.row}`));
  const cands: Home[] = [];
  // 中央寄りの帯を2マス刻みで走査(端の壁を避ける)。決定的=毎回同じ並び。
  for (let row = 6; row < MAP_G - 6; row += 2) {
    for (let col = 6; col < MAP_G - 6; col += 2) {
      const key = `${col},${row}`;
      if (taken.has(key)) continue;
      if (isWalkable(col, row)) cands.push({ col, row });
    }
  }
  if (cands.length === 0) return [];
  // 候補全体から均等に count 個サンプリング(偏らせない)。
  const out: Home[] = [];
  const step = Math.max(1, Math.floor(cands.length / count));
  for (let i = 0; i < cands.length && out.length < count; i += step) out.push(cands[i]);
  return out;
}
