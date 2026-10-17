// 学習後(ドリル終了)の画面 上部に大きく出す「ご褒美イラスト」。
//  ・画像は assets/afterstudy/ に置く。RNは動的requireができないため、ファイル追加＝この配列の編集が必要(1画像=1行)。
//  ・季節での出し分けはオフ(ユーザー指定2026-08-01)。下の ROTATION を学習ごとに1枚ずつ順送り=マンネリ防止(気分転換)。
//  ・旧・季節絵(spring/summer/autumn/winter.png)はご褒美から除外＝削除済み(ユーザー指定2026-08-01)。

// ご褒美イラスト(桜と柴犬)。1枚を上下2分割して登録=昼の庭/夜の書斎。
const REWARD_DAY = require('../../assets/afterstudy/reward_day.jpg');   // 昼(庭・滝)
const REWARD_NIGHT = require('../../assets/afterstudy/reward_night.jpg'); // 夜(書斎・灯り)
// 夏の絵。2×2の1枚を4分割×2セット=計8枚。
const SUMMER_GARDEN = require('../../assets/afterstudy/summer_garden.jpg');   // 庭(あじさい・すいか)
const SUMMER_SEA = require('../../assets/afterstudy/summer_sea.jpg');       // 海辺
const SUMMER_RIVER = require('../../assets/afterstudy/summer_river.jpg');     // 川遊び(五重塔)
const SUMMER_FESTIVAL = require('../../assets/afterstudy/summer_festival.jpg'); // 夜祭り(灯り・花火)
const SUMMER_VERANDA = require('../../assets/afterstudy/summer_veranda.jpg');   // 縁側(海の見える庭)
const SUMMER_BOATS = require('../../assets/afterstudy/summer_boats.jpg');       // 海辺(ヨット)
const SUMMER_STREET = require('../../assets/afterstudy/summer_street.jpg');     // 夏の小道
const SUMMER_FIREWORKS = require('../../assets/afterstudy/summer_fireworks.jpg'); // 夜空の花火

// ご褒美画像のローテーション(10枚)。学習ごとに1枚ずつ順番に回る。並び順=この配列のまま。
export const AFTER_STUDY_IMAGES = [
  REWARD_DAY, REWARD_NIGHT,
  SUMMER_GARDEN, SUMMER_SEA, SUMMER_RIVER, SUMMER_FESTIVAL,
  SUMMER_VERANDA, SUMMER_BOATS, SUMMER_STREET, SUMMER_FIREWORKS,
];

/**
 * 学習後に出す1枚を決める。seed=学習回数(afterStudyCount)を渡すと、学習ごとに1枚ずつ
 * 順番に切り替わる=マンネリ防止(気分転換)。同一セッション内は afterStudyCount 固定なので安定。
 * 第2引数(now)は季節出し分けを廃止したため未使用(呼び出し側の互換のため残す)。
 */
export function pickAfterStudyImage(seed: number, _now?: number) {
  if (AFTER_STUDY_IMAGES.length === 0) return null;
  const idx = Math.abs(Math.floor(seed));
  return AFTER_STUDY_IMAGES[idx % AFTER_STUDY_IMAGES.length];
}
