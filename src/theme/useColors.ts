// 現在のテーマパレットを返すフック。settings.theme(light/dark/auto)＋端末の配色から解決。
import { useColorScheme } from 'react-native';
import { useAppState } from '../store/store';
import { isWatercolor } from '../store/state';
import { darkColors, lightColors, type ThemeColors } from './theme';

export function useColors(): ThemeColors {
  const { settings } = useAppState();
  const sys = useColorScheme(); // 'light' | 'dark' | null
  // 水彩テーマ(桜/空/緑/藤/茜)=ライト系＋淡い水彩背景。ページ背景bgを透明化して背後の水彩レイヤーを見せる。
  if (isWatercolor(settings.theme)) return { ...lightColors, bg: 'transparent' };
  const mode = settings.theme === 'auto' ? (sys ?? 'light') : settings.theme;
  return mode === 'dark' ? darkColors : lightColors;
}
