// safa JLPT デザインシステム。色はライト/ダークの2パレットを実行時に切替(useColors)。
// 余白/角丸/タイポはテーマ非依存(静的)。§10: 将来 packages/shared へ昇格し App B と共有。

export interface ThemeColors {
  bg: string;
  bgSoft: string;
  surface: string;
  ink: string;
  ink2: string;
  mute: string;
  faint: string;
  trace: string;
  line: string;
  // ブランド(safa青)
  blue: string;
  blueDark: string;  // blueLight 上の文字色
  blueLight: string; // 選択チップ背景
  // 状態色
  green: string;
  amber: string;
  orange: string;
  red: string;
  purple: string;
  // 4区分アクセント(文字語彙/文法/読解/聴解)
  mojiGoi: string;
  bunpou: string;
  dokkai: string;
  choukai: string;
  // 意味的背景(ダークでも破綻しないようトークン化)
  okBg: string;
  okBorder: string;
  ngBg: string;
  fireBg: string;
  fireBorder: string;
}

export const lightColors: ThemeColors = {
  bg: '#f8fafc',
  bgSoft: '#f1f5f9',
  surface: '#ffffff',
  ink: '#0f172a',
  ink2: '#1e293b',
  mute: '#64748b',
  faint: '#94a3b8',
  trace: '#cbd5e1',
  line: '#e2e8f0',
  blue: '#2563eb',
  blueDark: '#1e40af',
  blueLight: '#dbeafe',
  green: '#16a34a',
  amber: '#f59e0b',
  orange: '#f97316',
  red: '#ef4444',
  purple: '#7c3aed',
  mojiGoi: '#16a34a',
  bunpou: '#f59e0b',
  dokkai: '#f97316',
  choukai: '#7c3aed',
  okBg: '#f0fdf4',
  okBorder: '#bbf7d0',
  ngBg: '#fef2f2',
  fireBg: '#fff7ed',
  fireBorder: '#fed7aa',
};

export const darkColors: ThemeColors = {
  bg: '#0b1220',
  bgSoft: '#0f1a2e',
  surface: '#16233b',
  ink: '#f8fafc',
  ink2: '#e2e8f0',
  mute: '#94a3b8',
  faint: '#64748b',
  trace: '#475569',
  line: '#2b3a52',
  blue: '#3b82f6',
  blueDark: '#bfdbfe',
  blueLight: '#1e3a8a',
  green: '#22c55e',
  amber: '#fbbf24',
  orange: '#fb923c',
  red: '#f87171',
  purple: '#a78bfa',
  mojiGoi: '#22c55e',
  bunpou: '#fbbf24',
  dokkai: '#fb923c',
  choukai: '#a78bfa',
  okBg: '#0c2a18',
  okBorder: '#166534',
  ngBg: '#3b0d0d',
  fireBg: '#3a1d0a',
  fireBorder: '#7c2d12',
};

/** 既定パレット(ライト)。実行時の切替は useColors を使う。 */
export const colors = lightColors;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };
export const radius = { sm: 6, md: 10, lg: 16, xl: 20, pill: 999 };
export const type = { hero: 54, h1: 24, h2: 18, body: 14, small: 12, tiny: 10 };
