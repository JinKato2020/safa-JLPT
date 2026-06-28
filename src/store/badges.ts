// バッジ(達成棚)= 純粋関数。継続/習得/準備度の数値でしきい値解錠。掲示板 自分タブ④。
// 入力をフラットにして RN/ストア非依存にし、単体テスト可能にする。

export interface Badge {
  id: string;
  emoji: string;
  label: string;
  hint: string;     // 解除条件(ロック時に表示)
  unlocked: boolean;
}

export interface BadgeInput {
  studyDays: number;     // 学習した延べ日数
  longestStreak: number; // 最長連続
  learned: number;       // 覚えた語数(減衰後 p>=0.6)
  score: number;         // 準備度(0-100)
}

export function computeBadges(i: BadgeInput): Badge[] {
  return [
    { id: 'start', emoji: '🌱', label: 'はじめの一歩', hint: '学習を開始', unlocked: i.studyDays >= 1 },
    { id: 'streak3', emoji: '🔥', label: '3日連続', hint: '3日続ける', unlocked: i.longestStreak >= 3 },
    { id: 'streak7', emoji: '🔥', label: '7日連続', hint: '7日続ける', unlocked: i.longestStreak >= 7 },
    { id: 'streak30', emoji: '🏆', label: '30日連続', hint: '30日続ける', unlocked: i.longestStreak >= 30 },
    { id: 'vocab50', emoji: '📚', label: '語彙50', hint: '50語を習得', unlocked: i.learned >= 50 },
    { id: 'vocab200', emoji: '📖', label: '語彙200', hint: '200語を習得', unlocked: i.learned >= 200 },
    { id: 'vocab500', emoji: '🎓', label: '語彙500', hint: '500語を習得', unlocked: i.learned >= 500 },
    { id: 'pass', emoji: '🎯', label: '合格圏', hint: '合格ライン(合格率80%)到達', unlocked: i.score >= 80 },
  ];
}
