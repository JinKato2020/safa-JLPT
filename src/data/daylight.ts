// 昼/夜の判定(純ロジック・react-native非依存=node --test で検証可能)。
export type Daylight = 'day' | 'night';

// 端末の時刻から昼/夜を判定(昼=6:00〜17:59, 夜=18:00〜5:59)。
export function daylightAt(date: Date): Daylight {
  const h = date.getHours();
  return h >= 6 && h < 18 ? 'day' : 'night';
}
