// ホーム = 星屑リングを主役に。背景=HOME.png 全画面／上部に合格リング(星屑リング)＋中央に合格率。
//  リング画像は段階素材(到達度で差し替え)。中央の合格率は動的。グローは呼吸するようにゆっくり明滅(Animated)。
//  ※DQ風ステータスカードは不採用(ユーザー指定)。上部の共通バーは MainTabs のオーバーレイ。
import { useMemo, useEffect, useRef } from 'react';
import { View, Text, Image, Animated, StyleSheet, useWindowDimensions } from 'react-native';
import { useAppState, useAppActions } from '../store/store';
import { learnedNow } from '../store/selectors';
import { dayStr } from '../store/state';
import { TabBackground } from '../components/TabScene';
import { useHomeBg } from '../data/tabArt';
import { homeStatus } from '../home/homeStatus';
import HomeCoach from '../home/HomeCoach';
import SafeBoundary from '../components/SafeBoundary';

const RING = require('../../assets/home/pass_ring.png');
const GLOW = require('../../assets/home/ring_glow.png');

export default function HomeScreen() {
  const state = useAppState();
  const now = Date.now();
  const { width, height } = useWindowDimensions();
  const homeBg = useHomeBg(); // 昼/夜で自動切替

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
  // グロー=リング素材(pass_ring)から作った同形の発光を「同サイズで真上」に重ねる=リングと完全一致。
  // 呼吸は主に明滅(opacity)＋ごく僅かな拡大(帯から離れない)。
  // グローはリングに密着させ膨張させない(明滅は控えめ・拡大はごく僅か)。
  const gOp = glow.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.6] });
  const gSc = glow.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.12] });

  const ringW = Math.round(width * 0.40); // 画面幅の40%(ヒーロー寄せに戻し)
  const top = Math.round(height * 0.15);  // やや上
  const left = Math.round((width - ringW) / 2);
  const pct = Math.round(status.passPct);

  return (
    <View style={styles.c}>
      <TabBackground source={homeBg}>
        <SafeBoundary tag="homering" fallback={null}>
          <View style={[styles.wrap, { top, left, width: ringW, height: ringW }]}>
            {/* 画像は必ず明示サイズ(=ringW)で拘束する。absoluteFill+containは実機で実寸化する事故があるため使わない。 */}
            <Animated.Image
              source={GLOW}
              resizeMode="contain"
              style={[styles.glow, { width: ringW, height: ringW, opacity: gOp, transform: [{ scale: gSc }] }]}
            />
            <Image source={RING} style={{ width: ringW, height: ringW }} resizeMode="contain" />
            <View style={styles.pct} pointerEvents="none">
              {/* 数字＋ラベル(到達度)を縦に積み、その塊の中心を穴の中心に合わせる。ラベルは数字の下。
                  数字のlineHeightを字高に詰めて(下余白を除去)、ラベルとの隙間をmarginTop=5pxで直接制御。 */}
              <View style={styles.pctInner}>
                <Text style={[styles.num, { fontSize: Math.round(ringW * 0.30), lineHeight: Math.round(ringW * 0.30 * 0.78) }]}>
                  {pct}<Text style={[styles.numSmall, { fontSize: Math.round(ringW * 0.15) }]}>%</Text>
                </Text>
                <Text style={[styles.lbl, { fontSize: Math.round(ringW * 0.085), marginTop: 5 }]}>到達度</Text>
              </View>
            </View>
          </View>
        </SafeBoundary>
        <SafeBoundary tag="homecoach" fallback={null}>
          <HomeCoach status={status} learned={learnedNow(state, now)} />
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
  pctInner: { alignItems: 'center', justifyContent: 'center' },
  lbl: { fontWeight: '700', letterSpacing: 1.5, color: '#dbe4ff', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4, includeFontPadding: false },
  num: { fontWeight: '900', color: '#ffffff', textShadowColor: 'rgba(160,200,255,0.9)', textShadowRadius: 14, textAlign: 'center', textAlignVertical: 'center', includeFontPadding: false },
  numSmall: { fontWeight: '800', color: '#eaf0ff' },
});
