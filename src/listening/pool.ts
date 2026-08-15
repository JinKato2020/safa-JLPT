// 聴解問題の ID 帯(band)による出題プール制御。
// 【ID帯の規約(2026-08-14 ユーザー決定)】
//   0001-0500 = 一般問題(通常出題)
//   0501-0700 = 枯渇プール(予備)。一般問題を「一巡＝全問一度でも回答」したら解放＝ヘビー学習者向け。
//   0701-1000 = 模試専用。通常練習には出さない。
// ID形式: {LEVEL}-C-{DAIMON}-{NNNN}(例 N5-C-S-0001)。末尾の数値で帯を判定する。
// 既存の他大問(kadai/point 等)は全て 0001-0100 台＝一般帯なので、この制御を通しても挙動不変(予備・模試は空)。

export type Band = 'general' | 'reserve' | 'mock';

export function idNumber(id: string): number {
  const last = id.split('-').pop() ?? '';
  const n = parseInt(last, 10);
  return Number.isFinite(n) ? n : 0;
}

export function idBand(id: string): Band {
  const n = idNumber(id);
  if (n >= 701) return 'mock';
  if (n >= 501) return 'reserve';
  return 'general';
}

// 出題プールに使える最小限のクリップ形。id と設問id を持てばよい。
export interface PoolClip {
  id: string;
  questions: { id: string }[];
}

// 練習の出題プールを ID帯で組む。
// - 模試帯(0701-1000)は常に除外。
// - 一般帯(0001-0500)は常に対象。
// - 予備帯(0501-0700)は「一般帯クリップの全設問が一度でも回答済み」の時だけ追加。
// isAnswered(qid): その設問に回答履歴があるか(正誤は問わない)。
export function practicePool<T extends PoolClip>(items: T[], isAnswered: (qid: string) => boolean): T[] {
  const general: T[] = [];
  const reserve: T[] = [];
  for (const it of items) {
    const b = idBand(it.id);
    if (b === 'mock') continue;
    (b === 'reserve' ? reserve : general).push(it);
  }
  if (reserve.length === 0) return general;
  const generalExhausted = general.every((cl) => cl.questions.every((q) => isAnswered(q.id)));
  return generalExhausted ? [...general, ...reserve] : general;
}
