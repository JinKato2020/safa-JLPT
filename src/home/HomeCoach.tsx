// ホーム下部に「桜の巫女」=AIコーチをふわっと浮遊配置。状態に応じたセリフを吹き出しで語る。
//  ・不規則に登場→数秒で自動退場→また間隔を空けて再登場(=表示し続けない)。
//  ・登場中は上下にゆっくり浮遊＋まばたき(guide_open/guide_blink 差し替え)。
//  ・吹き出し/キャラをタップで即消せる。
import { useEffect, useRef, useState } from 'react';
import { View, Text, Image, Animated, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useT } from '../i18n';
import type { HomeStatus } from './homeStatus';
import { coachLines, pickLine } from './coachLines';

const OPEN = require('../../assets/mywords/guide_open.png');
const BLINK = require('../../assets/mywords/guide_blink.png');

export default function HomeCoach({ status, learned }: { status: HomeStatus; learned: number }) {
  const t = useT();
  const { width } = useWindowDimensions();
  const [visible, setVisible] = useState(false);
  const [line, setLine] = useState('');
  const [eyesClosed, setEyesClosed] = useState(false);
  const anim = useRef(new Animated.Value(0)).current; // 0=退場, 1=登場
  const bob = useRef(new Animated.Value(0)).current;
  // 最新の状態を参照するため ref に保持(スケジューラは一度だけ張るので)。
  const dataRef = useRef({ status, learned, t });
  dataRef.current = { status, learned, t };

  // 出現/退場スケジューラ: ランダム間隔で現れ、数秒で自動退場、また間隔を空けて再出現。
  useEffect(() => {
    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const push = (fn: () => void, ms: number) => { timers.push(setTimeout(fn, ms)); };

    const hide = () => {
      Animated.timing(anim, { toValue: 0, duration: 500, useNativeDriver: true }).start(() => {
        if (alive) setVisible(false);
      });
    };
    const schedule = () => { push(show, 12000 + Math.random() * 16000); }; // 次まで 12–28秒
    function show() {
      if (!alive) return;
      const d = dataRef.current;
      setLine(pickLine(coachLines(d.t, { status: d.status, learned: d.learned })));
      setVisible(true);
      Animated.timing(anim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
      push(() => { hide(); schedule(); }, 6000 + Math.random() * 3000); // 表示 6–9秒で自動退場
    }

    push(show, 3500 + Math.random() * 3000); // 初回は少し待って登場
    return () => { alive = false; timers.forEach(clearTimeout); };
  }, [anim]);

  // 登場中のみ: 上下ゆっくり浮遊＋まばたき。
  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 1800, useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 1800, useNativeDriver: true }),
    ]));
    loop.start();
    let bAlive = true;
    const blinkTimers: ReturnType<typeof setTimeout>[] = [];
    const blink = () => {
      if (!bAlive) return;
      setEyesClosed(true);
      blinkTimers.push(setTimeout(() => setEyesClosed(false), 130));
      blinkTimers.push(setTimeout(blink, 2500 + Math.random() * 3000));
    };
    blinkTimers.push(setTimeout(blink, 1600));
    return () => { loop.stop(); bAlive = false; blinkTimers.forEach(clearTimeout); };
  }, [visible, bob]);

  const dismiss = () => {
    Animated.timing(anim, { toValue: 0, duration: 260, useNativeDriver: true }).start(() => setVisible(false));
  };

  if (!visible) return null;
  const charW = Math.round(width * 0.34);
  const slideY = anim.interpolate({ inputRange: [0, 1], outputRange: [44, 0] });
  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });

  return (
    <Animated.View pointerEvents="box-none" style={[styles.wrap, { opacity: anim, transform: [{ translateY: slideY }] }]}>
      {/* 吹き出し(タップで消える) */}
      <Pressable onPress={dismiss} style={[styles.bubbleWrap, { maxWidth: Math.round(width * 0.66) }]}>
        <View style={styles.bubble}>
          <Text style={styles.bubbleTxt}>{line}</Text>
          <Text style={styles.close}>×</Text>
        </View>
        <View style={styles.tail} />
      </Pressable>
      {/* キャラ(タップでも消える) */}
      <Animated.View style={{ transform: [{ translateY: bobY }] }}>
        <Pressable onPress={dismiss} hitSlop={4}>
          <Image source={eyesClosed ? BLINK : OPEN} style={{ width: charW, height: charW }} resizeMode="contain" />
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: 6, bottom: 70, alignItems: 'flex-end' },
  bubbleWrap: { alignItems: 'flex-end', marginRight: 24, marginBottom: -6 },
  bubble: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: 'rgba(255,252,247,0.97)', borderRadius: 16,
    borderWidth: 1.5, borderColor: '#e7c9a6',
    paddingVertical: 10, paddingHorizontal: 13,
    shadowColor: '#a06e32', shadowOpacity: 0.28, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  bubbleTxt: { flexShrink: 1, fontSize: 14, lineHeight: 20, color: '#5a3d22', fontWeight: '700' },
  close: { fontSize: 13, color: '#b79366', fontWeight: '800', marginTop: -1 },
  tail: {
    width: 14, height: 14, backgroundColor: 'rgba(255,252,247,0.97)',
    borderRightWidth: 1.5, borderBottomWidth: 1.5, borderColor: '#e7c9a6',
    transform: [{ rotate: '45deg' }], marginRight: 34, marginTop: -8,
  },
});
