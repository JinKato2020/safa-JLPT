// ホーム = 星屑リングを主役に。背景=HOME.png 全画面／上部に合格リング(星屑リング)＋中央に合格率。
//  リング画像は段階素材(到達度で差し替え)。中央の合格率は動的。グローは呼吸するようにゆっくり明滅(Animated)。
//  ※DQ風ステータスカードは不採用(ユーザー指定)。上部の共通バーは MainTabs のオーバーレイ。
import { useMemo, useEffect, useRef } from 'react';
import { View, Text, Image, Animated, StyleSheet, useWindowDimensions } from 'react-native';
import { useAppState, useAppActions } from '../store/store';
import { learnedNow } from '../store/selectors';
import { dayStr } from '../store/state';
import { TabBackground } from '../components/TabScene';
import { HOME_BG } from '../data/tabArt';
import { homeStatus } from '../home/homeStatus';
import SafeBoundary from '../components/SafeBoundary';

const RING = require('../../assets/home/pass_ring.png');
const GLOW = require('../../assets/home/ring_glow.png');

export default function HomeScreen() {
  const state = useAppState();
  const now = Date.now();
  const { width, height } = useWindowDimensions();

  const status = useMemo(() => homeStatus(state, now), [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const { awardOnce } = useAppActions();
  // 継続・上達の桜貝付与(awardOnce が二重付与を防ぐので毎マウント呼んで安全)。
  useEffect(() => {
    const td = dayStr(now);
    if (state.streak.history.includes(td)) awardOnce('dailyFirst-' + td, 10);
    if (state.streak.current >= 7) awardOnce('streak7', 50);
    if (state.streak.current >= 30) awardOnce('streak30', 200);
    const p = status.passPct;
    if (p >= 50) awardOnce('pass50', 150);
    if (p >= 70) awardOnce('pass70', 150);
    if (p >= 80) awardOnce('pass80', 150);
    for (let i = 1; i <= Math.min(9, Math.floor(p / 10)); i++) awardOnce('tier' + i, 100);
    const learned = learnedNow(state, now);
    for (let k = 1; k <= Math.floor(learned / 100); k++) awardOnce('learned' + (k * 100), 30);
  }, [state, status.passPct]); // eslint-disable-line react-hooks/exhaustive-deps

  // 呼吸グロー(0→1→0 をゆっくりループ・useNativeDriver で軽量)。
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 2300, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: 2300, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [glow]);
  // 背景に負けない強いグロー: 外側(広い)＋内側(明るい)の2層を大きく明滅させる。
  const gOuterOp = glow.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
  const gInnerOp = glow.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
  const gOuterSc = glow.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.3] });
  const gInnerSc = glow.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.12] });

  const ringW = Math.round(width * 0.30);
  // 環状グロー: リングの帯に沿って光らせる(中心=合格率は光らせない)。素材が環状ピークなので
  // リングとほぼ同径に置くと帯にhaloが乗る。外側にもう一枚重ねて滲みを出す。
  const glowOuter = Math.round(ringW * 1.55);
  const glowInner = Math.round(ringW * 1.12);
  const top = Math.round(height * 0.30); // もっと中央へ
  const left = Math.round((width - ringW) / 2);
  const pct = Math.round(status.passPct);

  return (
    <View style={styles.c}>
      <TabBackground source={HOME_BG}>
        <SafeBoundary tag="homering" fallback={null}>
          <View style={[styles.wrap, { top, left, width: ringW, height: ringW }]}>
            <Animated.Image
              source={GLOW}
              resizeMode="contain"
              style={[styles.glow, { width: glowOuter, height: glowOuter, left: (ringW - glowOuter) / 2, top: (ringW - glowOuter) / 2, opacity: gOuterOp, transform: [{ scale: gOuterSc }] }]}
            />
            <Animated.Image
              source={GLOW}
              resizeMode="contain"
              style={[styles.glow, { width: glowInner, height: glowInner, left: (ringW - glowInner) / 2, top: (ringW - glowInner) / 2, opacity: gInnerOp, transform: [{ scale: gInnerSc }] }]}
            />
            <Image source={RING} style={{ width: ringW, height: ringW }} resizeMode="contain" />
            <View style={styles.pct} pointerEvents="none">
              <Text style={[styles.lbl, { fontSize: Math.round(ringW * 0.085) }]}>合格率</Text>
              <Text style={[styles.num, { fontSize: Math.round(ringW * 0.30) }]}>
                {pct}<Text style={[styles.numSmall, { fontSize: Math.round(ringW * 0.15) }]}>%</Text>
              </Text>
            </View>
          </View>
        </SafeBoundary>
      </TabBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1 },
  wrap: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute' },
  pct: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  lbl: { fontWeight: '700', letterSpacing: 1.5, color: '#dbe4ff', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4, marginBottom: 1 },
  num: { fontWeight: '900', color: '#ffffff', textShadowColor: 'rgba(160,200,255,0.9)', textShadowRadius: 14 },
  numSmall: { fontWeight: '800', color: '#eaf0ff' },
});
