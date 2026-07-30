// 桜の「今日の一言」吹き出し。ホームで1日1回だけ、桜の頭上にそっと出す。
//  ・毎日の出迎え(daily)の中立セリフだけ。数字/日付/合否/願いは言わない=癒し・ねぎらい専用。
//  ・出す/出さないと文言選びは純関数(greeting.ts / voice.ts)に委譲。ここは表示と「出した記録」だけ。
//  ・付与・課金・出題ロジックには一切触れない。減衰レイヤーが1日1回に絞る。
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState, useAppActions } from '../store/store';
import { dayStr, type AppState } from '../store/state';
import { shouldGreetToday, greetVariant } from './greeting';
import { composeVoice } from '../story/voice';

const GREET_TOUCHPOINT = 'daily_greet';

// YYYY-MM-DD → 通日番号。日替わりで台詞が変わるよう seed に使う(recent永続化なしでも隣接日は別文言)。
function dayNo(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

/** 今日この画面で桜が言う出迎えの一言(なければ null)。 */
function pickSpeech(state: AppState, now: number): { text: string } | null {
  if (!shouldGreetToday(state, now)) return null;
  const seed = dayNo(dayStr(now));
  const intensity = greetVariant(state, now); // 'full' | 'short'(none は shouldGreetToday で除外済)
  const res = composeVoice({
    occasion: { kind: 'daily', streakDays: state.streak.current },
    variant: intensity === 'full' ? 'full' : 'short',
    now,
    seed,
  });
  return res.text ? { text: res.text } : null;
}

export default function SakuraSpeech() {
  const state = useAppState();
  const { markStoryShown } = useAppActions();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const { height } = useWindowDimensions();

  // マウント時に一度だけ台詞を確定(この後 markStoryShown で state が変わっても文言は固定)。
  const [speech] = useState(() => pickSpeech(state, Date.now()));
  const [visible, setVisible] = useState(true);
  const fade = useRef(new Animated.Value(0)).current;

  // 出した記録=1日1回に絞る(減衰レイヤー)。表示の有無に関わらず今日はもう出さない。
  useEffect(() => {
    if (!speech) return;
    markStoryShown(GREET_TOUCHPOINT);
    Animated.timing(fade, { toValue: 1, duration: 420, useNativeDriver: true }).start();
  }, [speech]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!speech || !visible) return null;

  // 桜(HomeCoach)は画面下部に立つ。その頭上あたりにそっと浮かべる。タップで消える。
  return (
    <Animated.View style={[s.wrap, { bottom: Math.round(height * 0.30), opacity: fade }]} pointerEvents="box-none">
      <Pressable onPress={() => setVisible(false)} style={s.bubble} hitSlop={8}>
        <Text style={s.text}>{speech.text}</Text>
        <View style={s.tail} />
      </Pressable>
    </Animated.View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: spacing.lg },
    // 和紙調のやわらかい吹き出し。桜の一言=控えめ・短い(口調シート: 最大2文/N5語彙)。
    bubble: {
      maxWidth: '82%',
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.line,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      shadowColor: '#000',
      shadowOpacity: 0.18,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 3,
    },
    text: { fontSize: ty.body, fontWeight: '700', color: c.ink, lineHeight: 24, textAlign: 'center' },
    // 下向きの小さな尾(桜へ向く)。
    tail: {
      position: 'absolute',
      bottom: -7,
      alignSelf: 'center',
      width: 14,
      height: 14,
      backgroundColor: c.surface,
      borderRightWidth: 1,
      borderBottomWidth: 1,
      borderColor: c.line,
      transform: [{ rotate: '45deg' }],
    },
  });
