// 現在のテーマパレットを返すフック。settings.theme(light/dark/auto)＋端末の配色から解決。
import { useColorScheme } from 'react-native';
import { useAppState } from '../store/store';
import { isWatercolor } from '../store/state';
import { darkColors, lightColors, type ThemeColors } from './theme';
import { isSimpleMode } from '../app/flavor';

export function useColors(): ThemeColors {
  const { settings } = useAppState();
  const sys = useColorScheme(); // 'light' | 'dark' | null
  const simple = isSimpleMode(settings);
  // 水彩テーマ(桜/空/緑/藤/茜)=ライト系＋淡い水彩背景。通常はbgを透明化して背後の水彩を見せるが、
  // シンプルモードは無地にするので透明化しない(ベタのライト配色)。
  if (isWatercolor(settings.theme)) return simple ? lightColors : { ...lightColors, bg: 'transparent' };
  const mode = settings.theme === 'auto' ? (sys ?? 'light') : settings.theme;
  return mode === 'dark' ? darkColors : lightColors;
}

/** シンプルモード(没入演出を外したミニマル表示)か。ミニマル殻アプリは既定ON固定。 */
export function useSimpleMode(): boolean {
  const { settings } = useAppState();
  return isSimpleMode(settings);
}

// 現在のテーマが「ダーク」かどうか(水彩=ライト扱い)。会話+ステータス枠の昼夜(素材)切替に使う。
export function useIsDarkTheme(): boolean {
  const { settings } = useAppState();
  const sys = useColorScheme();
  if (isWatercolor(settings.theme)) return false;
  const mode = settings.theme === 'auto' ? (sys ?? 'light') : settings.theme;
  return mode === 'dark';
}
