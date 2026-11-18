// 問題画面の書斎と紙面。既存の季節画像を再利用し、出題・採点には触れない。
import { useEffect, useMemo, useRef } from 'react';
import { Image, StyleSheet, View, useWindowDimensions, type ScrollView, type ViewStyle } from 'react-native';
import { useTabBg } from '../data/tabArt';
import { spacing, useColors, useIsDarkTheme, useSimpleMode, type ThemeColors } from '../theme';

export function useStudyColors(enabled = true): ThemeColors {
  const base = useColors();
  const dark = useIsDarkTheme();
  const simple = useSimpleMode();
  return useMemo(() => {
    if (!enabled || simple) return base;
    return {
      ...base,
      ...(dark ? {
        bg: '#24241f', bgSoft: '#3b382d', surface: '#302e26',
        ink: '#f5eddd', ink2: '#e5dccb', mute: '#c1b49f', faint: '#b4a78e',
        trace: '#8b795d', line: '#665944',
        blue: '#46674b', blueDark: '#c1d9b6', blueLight: '#334735',
        green: '#b0d5a3', red: '#f0aba0', amber: '#c5a36c',
        okBg: '#273c2b', okBorder: '#72956c', ngBg: '#482e29',
      } : {
        bg: '#fffaf0', bgSoft: '#f1e5ce', surface: '#fffdf7',
        ink: '#352d25', ink2: '#493d30', mute: '#746554', faint: '#7d6d56',
        trace: '#b59b74', line: '#dfcfb5',
        blue: '#425d44', blueDark: '#354f38', blueLight: '#e6eddd',
        green: '#3c6844', red: '#ad483d', amber: '#b68b50',
        okBg: '#edf3e7', okBorder: '#81a177', ngBg: '#fff0eb',
      }),
    };
  }, [base, dark, simple, enabled]);
}

export function studyPaper(c: ThemeColors): ViewStyle {
  return {
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.line,
    borderRadius: 12, borderTopLeftRadius: 4, borderBottomLeftRadius: 4,
    borderLeftWidth: 3, borderLeftColor: c.amber,
  };
}

export function studyChoice(c: ThemeColors): ViewStyle {
  return { minHeight: 54, borderRadius: 12, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface };
}

export function studyBadge(c: ThemeColors): ViewStyle {
  return {
    width: 28, height: 28, borderRadius: 6, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center', backgroundColor: c.bgSoft,
  };
}

/** 長い問題を下まで読んだ後も、次問は問題文から表示する。 */
export function useStudyScroll(questionIndex: number) {
  const ref = useRef<ScrollView>(null);
  useEffect(() => { ref.current?.scrollTo({ y: 0, animated: false }); }, [questionIndex]);
  return ref;
}

/** ScrollView の本文(padding=lg)内に置き、問題を読むときは絵を上へ流せるようにする。 */
export function StudySceneBanner({ current, total }: { current?: number; total?: number }) {
  const simple = useSimpleMode();
  if (simple) return null;
  return <StudySceneArt current={current} total={total} />;
}

function StudySceneArt({ current, total }: { current?: number; total?: number }) {
  const source = useTabBg('word'); // 昼夜・季節のOTA更新・オフラインの同梱画像を共用。
  const c = useStudyColors();
  const { height } = useWindowDimensions();
  const progress = total && current !== undefined ? Math.max(0, Math.min(1, current / total)) : null;
  return (
    <View style={styles.banner} pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {progress !== null && <View style={[styles.track, { backgroundColor: c.bgSoft }]}><View style={{ height: '100%', width: `${progress * 100}%`, backgroundColor: c.blue }} /></View>}
      <Image source={source} resizeMode="cover" style={{ width: '100%', height: height < 700 ? 76 : 104 }} />
      <View style={{ height: 2, backgroundColor: c.line }} />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { marginHorizontal: -spacing.lg, overflow: 'hidden' },
  track: { height: 4 },
});
