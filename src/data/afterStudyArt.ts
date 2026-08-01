// 学習後(単語ドリル終了)の画面 上部に大きく出す画像。今は「季節連動」=今の季節の絵を優先。
//  ・画像は assets/afterstudy/ に置く。季節ごとに複数入れれば、その季節内でランダムに変わる。
//  ・RNは動的requireができないため、ファイル追加＝この配列の編集が必要(1画像=1行)。
//  ・季節判定は P0 の seasonOf を再利用(追加コストなし)。季節画像が無い時は全体からランダムにフォールバック。
import { seasonOf, type Season } from '../story/voice';

const SPRING = require('../../assets/afterstudy/spring.png'); // 春(桜)
const SUMMER = require('../../assets/afterstudy/summer.png'); // 夏(新緑)
const AUTUMN = require('../../assets/afterstudy/autumn.png'); // 秋(紅葉)
const WINTER = require('../../assets/afterstudy/winter.png'); // 冬(雪)

// 季節ごとの候補。同じ季節に複数入れたらここに足す(その季節内でランダム)。
const BY_SEASON: Record<Season, ReturnType<typeof require>[]> = {
  spring: [SPRING],
  summer: [SUMMER],
  autumn: [AUTUMN],
  winter: [WINTER],
};

// 全画像(季節が空のときのフォールバック用)。
export const AFTER_STUDY_IMAGES = [SPRING, SUMMER, AUTUMN, WINTER];

/**
 * 学習後に出す1枚を決める。seed=学習回数(afterStudyCount)を渡すと、学習ごとに1枚ずつ
 * 順送りで切り替わる=マンネリ防止(気分転換)。同一セッション内は afterStudyCount 固定なので安定。
 *  ・今の季節に複数枚あればその季節内で順送り。1枚だけ/無い季節は全画像を順送り(必ず変わる)。
 */
export function pickAfterStudyImage(seed: number, now?: number) {
  const idx = Math.abs(Math.floor(seed));
  if (now != null) {
    const pool = BY_SEASON[seasonOf(now)];
    if (pool && pool.length > 1) return pool[idx % pool.length]; // 季節内に複数=季節優先で順送り
  }
  if (AFTER_STUDY_IMAGES.length === 0) return null;
  return AFTER_STUDY_IMAGES[idx % AFTER_STUDY_IMAGES.length]; // 全画像を順送り=毎回変わる
}
