// 書き取りスコア算出(純関数)。HanziWriterのミス数→0-100。
export function scoreForMistakes(mistakes: number): number {
  if (mistakes <= 0) return 100;
  return Math.max(60, 100 - mistakes * 8);
}
