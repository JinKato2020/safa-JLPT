// 学習後(単語ドリル終了)の画面 上部に大きく出す「ランダム画像」の一覧。
//  ・ユーザーが用意した画像を assets/afterstudy/ に置き、下の配列に require を1行ずつ足すだけで増える。
//  ・RNは動的requireができないため、ファイル追加＝この配列の編集が必要(1画像=1行)。
//  ・いまは既存の桜/書斎イラストを仮置き。専用画像が届いたら差し替え/追記する。
//  ・推奨: 全幅で大きく出る前提。横長〜正方形が収まりやすい(縦長すぎると上下が切れる)。
export const AFTER_STUDY_IMAGES = [
  require('../../assets/mywords/room.jpg'),      // 仮: 書斎の間
  require('../../assets/mywords/guide_open.png'), // 仮: 桜
  // ここに assets/afterstudy/xxx.png を require で追加していく
];

/** seed から1枚を決める(同一セッション内で安定・セッション毎に変わる)。画像ゼロなら null。 */
export function pickAfterStudyImage(seed: number) {
  if (AFTER_STUDY_IMAGES.length === 0) return null;
  const i = Math.abs(Math.floor(seed)) % AFTER_STUDY_IMAGES.length;
  return AFTER_STUDY_IMAGES[i];
}
