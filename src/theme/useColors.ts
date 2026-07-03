// 現在のテーマパレットを返すフック。settings.theme(light/dark/auto)＋端末の配色から解決。
import { useColorScheme } from 'react-native';
import { useAppState } from '../store/store';
import { darkColors, lightColors, type ThemeColors } from './theme';

export function useColors(): ThemeColors {
  const { settings } = useAppState();
  const sys = useColorScheme(); // 'light' | 'dark' | null
  const mode = settings.theme === 'auto' ? (sys ?? 'light') : settings.theme;
  if (mode === 'dark') return darkColors;
  // 水彩背景が有効(ライトモードのみ)なら、ページ背景bgを透明化して背後の水彩レイヤーを見せる。
  // カード(surface)等は不透明のまま=可読性維持。
  if (settings.bgSkin && settings.bgSkin !== 'none') return { ...lightColors, bg: 'transparent' };
  return lightColors;
}
