// ホーム中央に案内キャラ「桜」を常駐。状態に合わせた“やさしいアドバイス”を吹き出しで語る。
//  ・桜は常に表示(ふわふわ浮遊＋まばたき)。アドバイスの吹き出しは非定期に自動で出て数秒で消える。
//  ・桜をタップ→その場でアドバイスを表示(既に出ていれば消す)。吹き出しタップでも消える。
//  ・口調は上から目線のコーチではなく、寄り添う女の子の語り(i18n coach.* をやさしい文面に)。
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Image, Animated, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useT } from '../i18n';
import { useAppState } from '../store/store';
import { SHOP_BY_ID } from '../data/shop';
import type { HomeStatus } from './homeStatus';
import { coachLines, pickLine } from './coachLines';

const OPEN = require('../../assets/mywords/guide_open.png');
const BLINK = require('../../assets/mywords/guide_blink.png');

export default function HomeCoach({ status, learned }: { status: HomeStatus; learned: number }) {
  const t = useT();
  const { width } = useWindowDimensions();
  const state = useAppState();
  // 装備中の筆があれば、その「桜が筆を背負う絵」で出現。髪型がショートなら短髪版・標準はロング版。
  // なければ既定の案内キャラ(まばたきあり)。※持ち上げ絵(celebrate)は購入演出専用でホームには使わない。
  const eqBrush = state.equipped?.brush;
  const isShort = state.equipped?.hair === 'hair_short';
  const bItem = eqBrush ? SHOP_BY_ID[eqBrush] : undefined;
  const brushImg = bItem ? (isShort ? bItem.homeShort : bItem.homeLong) : undefined;
  const [line, setLine] = useState<string | null>(null);
  const [eyesClosed, setEyesClosed] = useState(false);
  const bob = useRef(new Animated.Value(0)).current;
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 最新の状態を参照(スケジューラは一度だけ張るため)。
  const dataRef = useRef({ status, learned, t });
  dataRef.current = { status, learned, t };

  const showAdvice = useCallback(() => {
    const d = dataRef.current;
    setLine(pickLine(coachLines(d.t, { status: d.status, learned: d.learned })));
    if (hideRef.current) clearTimeout(hideRef.current);
    hideRef.current = setTimeout(() => setLine(null), 7000); // 数秒で自動的に引っ込む
  }, []);
  const dismiss = useCallback(() => {
    if (hideRef.current) clearTimeout(hideRef.current);
    setLine(null);
  }, []);

  // 非定期スケジューラ: 初回は少し待って登場→以後ランダム間隔で再表示。
  useEffect(() => {
    let alive = true;
    let t1: ReturnType<typeof setTimeout>, t2: ReturnType<typeof setTimeout>;
    const cycle = () => {
      t1 = setTimeout(() => {
        if (!alive) return;
        showAdvice();
        cycle();
      }, 14000 + Math.random() * 18000); // 14〜32秒間隔
    };
    t2 = setTimeout(() => { if (alive) { showAdvice(); cycle(); } }, 4000 + Math.random() * 3000);
    return () => { alive = false; clearTimeout(t1); clearTimeout(t2); if (hideRef.current) clearTimeout(hideRef.current); };
  }, [showAdvice]);

  // 常時: ふわふわ浮遊＋まばたき。
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 2000, useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 2000, useNativeDriver: true }),
    ]));
    loop.start();
    let bAlive = true;
    const bt: ReturnType<typeof setTimeout>[] = [];
    const blink = () => {
      if (!bAlive) return;
      setEyesClosed(true);
      bt.push(setTimeout(() => setEyesClosed(false), 130));
      bt.push(setTimeout(blink, 2600 + Math.random() * 3200));
    };
    bt.push(setTimeout(blink, 1600));
    return () => { loop.stop(); bAlive = false; bt.forEach(clearTimeout); };
  }, [bob]);

  const onTapChar = () => (line != null ? dismiss() : showAdvice());
  // 装備筆の絵(桜が筆を背負う)は縦長なので少し大きめ＋縦横比を変える。既定の案内キャラはほぼ正方形。
  const charW = Math.round(width * (brushImg ? 0.60 : 0.40));
  const charH = Math.round(charW * (brushImg ? 1.370 : 1.12)); // 背負い画像=864x1184比に一致(余白なし)
  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -9] });

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      {line != null && (
        <Pressable onPress={dismiss} style={[styles.bubbleWrap, { maxWidth: Math.round(width * 0.72) }]}>
          <View style={styles.bubble}>
            <Text style={styles.bubbleTxt}>{line}</Text>
            <Text style={styles.close}>×</Text>
          </View>
          <View style={styles.tail} />
        </Pressable>
      )}
      <Animated.View style={{ transform: [{ translateY: bobY }] }}>
        <Pressable onPress={onTapChar} hitSlop={4}>
          <Image source={brushImg ?? (eyesClosed ? BLINK : OPEN)} style={{ width: charW, height: charH }} resizeMode="contain" />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 60, alignItems: 'center' },
  bubbleWrap: { alignItems: 'center', marginBottom: -4 },
  bubble: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: 'rgba(255,252,247,0.97)', borderRadius: 18,
    borderWidth: 1.5, borderColor: '#e7c9a6',
    paddingVertical: 11, paddingHorizontal: 15,
    shadowColor: '#a06e32', shadowOpacity: 0.28, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  bubbleTxt: { flexShrink: 1, fontSize: 14.5, lineHeight: 21, color: '#5a3d22', fontWeight: '700', textAlign: 'center' },
  close: { fontSize: 13, color: '#b79366', fontWeight: '800', marginTop: -1 },
  tail: {
    width: 14, height: 14, backgroundColor: 'rgba(255,252,247,0.97)',
    borderRightWidth: 1.5, borderBottomWidth: 1.5, borderColor: '#e7c9a6',
    transform: [{ rotate: '45deg' }], marginTop: -8,
  },
});
