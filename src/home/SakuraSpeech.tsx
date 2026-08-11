// 桜の吹き出し。ホーム常駐中、約30分に1度だけ、そっと励まし・応援の一言を出す。
//  ・寄り添い口調=AIコーチ風ではない(voice.ts の daily＋季節/時間flavor)。数字/日付/合否/願い/物語世界(かけら)は言わない。
//  ・前回表示から30分たっていれば、ホームを開いて数秒後に1回だけ出す→約11秒で自然に消える。タップでも即消える。
//  ・付与・課金・出題ロジックには一切触れない。分析・アドバイスは別空間(ご褒美/AIコーチ)が担当。
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState, useAppActions } from '../store/store';
import type { AppState } from '../store/state';
import { composeVoice, pickFlavor, renderVoice } from '../story/voice';
import { learnedNow } from '../store/selectors';
import { useT } from '../i18n';

// はじめて開いた人向けの一言(voice.newcomer.1〜5)＋締め(voice.close_daily.1〜8)の本数。表示は i18n キーで解決。
const NEWCOMER_COUNT = 5;
const CLOSER_COUNT = 8;

const MIN_GAP_MS = 20 * 60 * 1000;     // 20分に1度くらい(ユーザー方針 2026-08-06)
const INITIAL_MS = 3500;               // ホームに着いて少し落ち着いてから
const SHOW_MS = 18_000;                // 表示時間(文が約2倍に伸びたので長めに。タップでも即消える)

// 癒し・励ましの一言(出迎え daily ＋ 季節/時間の flavor)の id 列。世界のかけら(物語)は出さない。
// 長さは従来の約2倍: 基本(core+flavor)＋もう1つ別のflavor＋温かい締め。表示言語は renderVoice が id→台詞で解決。
function pickBubbleIds(state: AppState, now: number): (string | undefined)[] {
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
  const closerN = 1 + Math.floor(((seed + 0.5) % 1) * CLOSER_COUNT);
  return [...usedIds, extra?.id, `close_daily.${closerN}`];
}

// idleTick: ホームで静止(無操作)10秒ごとに親が +1 する合図。増えたら桜を出す(起動後表示とは別トリガー)。
export default function SakuraSpeech({ idleTick = 0 }: { idleTick?: number }) {
  const state = useAppState();
  const { setSettings } = useAppActions();
  const t = useT();
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
  //  毎日「最初の一言」は必ず『今日のオススメ』の案内にする(苦手単語の復習ができることを伝える)。2回目以降は通常の癒し。
  const reveal = () => {
    if (visibleRef.current) return;
    const now = Date.now();
    const d = new Date(now);
    const today = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    // まだ1語も覚えていない“はじめての人”には、過去の積み重ねを前提にした言葉(「続けてきた」等)を出さず、出迎えの一言にする。
    const isNewcomer = learnedNow(state, now) === 0;
    let text: string;
    if (isNewcomer) {
      const n = 1 + Math.floor((now / 1000) % NEWCOMER_COUNT);
      text = t('voice.newcomer.' + n);
      setSettings({ lastSakuraSpeechAt: now }); // sakuraRecoDayはまだ立てない(1語覚えたら通常導線へ)
    } else if (state.settings.sakuraRecoDay !== today) {
      text = t('sakura.reco_hint');
      setSettings({ sakuraRecoDay: today, lastSakuraSpeechAt: now });
    } else {
      text = renderVoice(pickBubbleIds(state, now), t) || t('voice.fallback_daily');
      setSettings({ lastSakuraSpeechAt: now });
    }
    setText(text);
    setVisible(true);
    Animated.timing(fade, { toValue: 1, duration: 420, useNativeDriver: true }).start();
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
