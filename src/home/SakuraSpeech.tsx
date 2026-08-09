// 桜の吹き出し。ホーム常駐中、約30分に1度だけ、そっと励まし・応援の一言を出す。
//  ・寄り添い口調=AIコーチ風ではない(voice.ts の daily＋季節/時間flavor)。数字/日付/合否/願い/物語世界(かけら)は言わない。
//  ・前回表示から30分たっていれば、ホームを開いて数秒後に1回だけ出す→約11秒で自然に消える。タップでも即消える。
//  ・付与・課金・出題ロジックには一切触れない。分析・アドバイスは別空間(ご褒美/AIコーチ)が担当。
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState, useAppActions } from '../store/store';
import type { AppState } from '../store/state';
import { composeVoice, pickFlavor } from '../story/voice';

// 桜の締めの温かい一言(数字/日付/合否/願い/物語=かけら は言わない)。長さ・変化づけ用に末尾へ添える。
const SAKURA_CLOSERS = [
  'あなたのペースで大丈夫だからね。',
  '無理はしないで、少しずついこう。',
  'ここまで続けてきたこと、ちゃんとえらいよ。',
  'わたしはいつでも、そばで応援してるからね。',
  'ふっと一息ついて、また一歩ね。',
  'あなたが今日も来てくれて、うれしいな。',
  'あわてなくていいの、ゆっくりでいいんだよ。',
  'あなたの頑張り、ちゃんと見てるからね。',
];

const MIN_GAP_MS = 20 * 60 * 1000;     // 20分に1度くらい(ユーザー方針 2026-08-06)
const INITIAL_MS = 3500;               // ホームに着いて少し落ち着いてから
const SHOW_MS = 18_000;                // 表示時間(文が約2倍に伸びたので長めに。タップでも即消える)

// 癒し・励ましの一言(出迎え daily ＋ 季節/時間の flavor)。世界のかけら(物語)は出さない。
// 長さは従来の約2倍: 基本(core+flavor)＋もう1つ別のflavor＋温かい締め、を重ねて“ありきたり感”を薄める。
function pickBubble(state: AppState, now: number): string {
  const seed = ((now / 1000) % 97) / 97; // 時刻でばらけさせる
  const res = composeVoice({
    occasion: { kind: 'daily', streakDays: state.streak?.current ?? 0 },
    variant: 'full',
    now,
    seed,
    seedFlavor: (seed + 0.37) % 1,
  });
  const usedIds = res.ids ?? [];
  const extra = pickFlavor(now, (seed + 0.61) % 1, usedIds); // もう1つ別の季節/時間flavor(重複回避)
  const closer = SAKURA_CLOSERS[Math.floor(((seed + 0.5) % 1) * SAKURA_CLOSERS.length)];
  const text = [res.text, extra?.text, closer].filter(Boolean).join('');
  return text || 'また会えたね。今日も、あなたのペースで大丈夫だからね。';
}

// idleTick: ホームで静止(無操作)10秒ごとに親が +1 する合図。増えたら桜を出す(起動後表示とは別トリガー)。
export default function SakuraSpeech({ idleTick = 0 }: { idleTick?: number }) {
  const state = useAppState();
  const { setSettings } = useAppActions();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const { height } = useWindowDimensions();

  const [text, setText] = useState('');
  const [visible, setVisible] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleRef = useRef(false); visibleRef.current = visible;
  const lastShownRef = useRef(0);

  const hide = () => {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
    Animated.timing(fade, { toValue: 0, duration: 380, useNativeDriver: true }).start(({ finished }) => { if (finished) setVisible(false); });
  };
  // 桜の一言を出す(表示中なら何もしない)。
  const reveal = () => {
    if (visibleRef.current) return;
    const now = Date.now();
    setText(pickBubble(state, now));
    setVisible(true);
    Animated.timing(fade, { toValue: 1, duration: 420, useNativeDriver: true }).start();
    setSettings({ lastSakuraSpeechAt: now });
    lastShownRef.current = now;
    hideTimer.current = setTimeout(hide, SHOW_MS);
  };

  // ① 起動後: ホーム到着の少しあとに1回(前回表示から20分あいていれば)。
  useEffect(() => {
    const last = state.settings.lastSakuraSpeechAt ?? 0;
    if (Date.now() - last < MIN_GAP_MS) return;
    const t = setTimeout(reveal, INITIAL_MS);
    return () => { clearTimeout(t); if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ② ホームで静止10秒(idleTickが増える)でも出す。直近表示から15秒は連発を防ぐ。
  useEffect(() => {
    if (idleTick <= 0) return;
    if (Date.now() - lastShownRef.current < 15_000) return;
    reveal();
  }, [idleTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const dismiss = () => {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
    Animated.timing(fade, { toValue: 0, duration: 260, useNativeDriver: true }).start(({ finished }) => { if (finished) setVisible(false); });
  };

  if (!visible || !text) return null;

  // 桜(HomeCoach)は画面下部に立つ。その頭上あたりにそっと浮かべる。タップで消える。
  return (
    <Animated.View style={[s.wrap, { bottom: Math.round(height * 0.30), opacity: fade }]} pointerEvents="box-none">
      <Pressable onPress={dismiss} style={s.bubble} hitSlop={8}>
        <Text style={s.text}>{text}</Text>
        <View style={s.tail} />
      </Pressable>
    </Animated.View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: spacing.lg },
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
