// 町のアバターの「定型ムード(努力タイプ)」と「TOEIC換算の実力めやす」。自由入力はしない=選ぶだけ。
// - ムード: 三日坊主〜endless修行 の決まった選択肢。プロフィールで自分の分を選び、会話カードで相手の分が見える。
// - TOEIC換算: JLPT級をTOEICでいうと何点くらいか、のざっくり目安(語学の種類は別なので厳密な換算ではなく、頑張りの規模感を掴むための参考値)。

export type Mood = { key: string; emoji: string; label: string };

// カジュアル→ストイックの順。頭上や会話カードに絵文字＋短いラベルで出す。
export const MOODS: Mood[] = [
  { key: 'beginner', emoji: '🌱', label: 'はじめたばかり' },
  { key: 'mikka', emoji: '😅', label: '三日坊主' },
  { key: 'mattari', emoji: '☕', label: 'まったり派' },
  { key: 'weekend', emoji: '📅', label: '週末だけ戦士' },
  { key: 'kotsu', emoji: '🐢', label: 'コツコツ型' },
  { key: 'oikomi', emoji: '🔥', label: '追い込み型' },
  { key: 'doryoku', emoji: '💪', label: '努力家' },
  { key: 'endless', emoji: '⛩️', label: 'endless修行' },
];

export const DEFAULT_MOOD = 'kotsu';

// ノベル風の会話で、努力タイプに合わせて本人がしゃべる一言(定型)。自由入力ではない=キーごとに固定。
export const MOOD_LINE: Record<string, string> = {
  beginner: 'まだ始めたばかりで手さぐりだけど、毎日たのしいよ。',
  mikka: '実はちょっと三日坊主ぎみ…でも今日はちゃんと来たよ！',
  mattari: 'のんびり、自分のペースでやってるんだ。',
  weekend: '平日はいそがしくて、週末にまとめて特訓してる。',
  kotsu: 'コツコツ毎日つづけるのが、わたし流。',
  oikomi: '試験がちかいから、いまは追い込みモード！',
  doryoku: '毎日ちゃんと時間をとって、がんばってるよ。',
  endless: '終わりなき修行の日々さ…！いっしょに強くなろう。',
};
export const moodLineOf = (key: string | undefined | null): string => MOOD_LINE[key ?? DEFAULT_MOOD] ?? MOOD_LINE[DEFAULT_MOOD];

export function moodOf(key: string | undefined | null): Mood {
  return MOODS.find((m) => m.key === key) ?? MOODS.find((m) => m.key === DEFAULT_MOOD)!;
}

// JLPT級→TOEIC換算のめやす(幅で表示)。厳密な公式換算は存在しないため「約○〜○点」の参考帯。
const TOEIC_BY_LEVEL: Record<string, string> = {
  N5: '300〜400',
  N4: '400〜500',
  N3: '550〜650',
  N2: '700〜780',
  N1: '830〜900',
};

/** 級から「TOEICでいうと約○〜○点」の文字列を返す。未知級はN5扱い。 */
export function toeicEquiv(level: string | undefined | null): string {
  return (level && TOEIC_BY_LEVEL[level]) || TOEIC_BY_LEVEL.N5;
}
