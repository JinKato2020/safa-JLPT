// 現在のテーマパレットを返すフック。settings.theme(light/dark/auto)＋端末の配色から解決。
import { useColorScheme } from 'react-native';
import { useAppState } from '../store/store';
import { darkColors, lightColors, type ThemeColors } from './theme';

export function useColors(): ThemeColors {
  const { settings } = useAppState();
  const sys = useColorScheme(); // 'light' | 'dark' | null
  const mode = settings.theme === 'auto' ? (sys ?? 'light') : settings.theme;
  return mode === 'dark' ? darkColors : lightColors;
}
