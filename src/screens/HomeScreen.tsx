// ホーム = 星屑リングを主役に。背景=HOME.png 全画面／上部に合格リング(星屑リング)＋中央に合格率。
//  リング画像は段階素材(到達度で差し替え)。中央の合格率は動的。グローは呼吸するようにゆっくり明滅(Animated)。
//  ※DQ風ステータスカードは不採用(ユーザー指定)。上部の共通バーは MainTabs のオーバーレイ。
import { useMemo, useEffect, useRef } from 'react';
import { View, Text, Image, Animated, StyleSheet, useWindowDimensions, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAppState, useAppActions } from '../store/store';
import { learnedNow } from '../store/selectors';
import { TabBackground } from '../components/TabScene';
import { useHomeBg } from '../data/tabArt';
import { homeStatus } from '../home/homeStatus';
import HomeCoach from '../home/HomeCoach';
import SakuraSpeech from '../home/SakuraSpeech';
import SafeBoundary from '../components/SafeBoundary';
import { avatarOf } from '../plaza/avatars';

const RING = require('../../assets/home/pass_ring.png');
const GLOW = require('../../assets/home/ring_glow.png');

export default function HomeScreen() {
  const state = useAppState();
  const now = Date.now();
  const { width, height } = useWindowDimensions();
  const homeBg = useHomeBg(); // 昼/夜で自動切替
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  // 到達度の左に出す現在レベル(JFT目標はレベル無し=「JFT」)。
  const levelLabel = (state.settings.targetExam ?? 'jlpt') === 'jft' ? 'JFT' : state.settings.level;

  const status = useMemo(() => homeStatus(state, now), [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const { awardOnce } = useAppActions();
  // 継続・上達の桜貝付与(awardOnce が二重付与を防ぐので毎マウント呼んで安全)。
  useEffect(() => {
    // 毎日はじめての学習=30貝は「今日の最初の学習の直後(AfterStudyReward)」で付与・表示する。ホームでは付与しない。
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
  // グロー(1重)。増光＋やや拡大で存在感を強める。
  const gOp = glow.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.9] });
  const gSc = glow.interpolate({ inputRange: [0, 1], outputRange: [1.08, 1.24] });

  const ringW = Math.round(width * 0.40); // 画面幅の40%(ヒーロー寄せに戻し)
  const top = Math.round(height * 0.15);  // やや上
  const left = Math.round((width - ringW) / 2);
  // リング中央=受験レベルの「予想得点 / 総得点(180)」。リングの塗り(素材画像)は合格率のまま。
  const predScore = status.predScore;
  const predMax = status.predMax;
  // リングの左に自分のアバター(オンボードで選択)。立ち絵(down)を表示。
  const myAvatar = avatarOf(state.settings.avatar).image;
  const avaH = Math.round(ringW * 0.62);           // アバター表示の高さ(リング比)
  const avaW = Math.round(avaH * 0.66);            // スプライトの縦横比に合わせる
  const avaLeft = Math.max(6, left - avaW - Math.round(ringW * 0.06)); // リングの少し左
  const avaTop = Math.round(top + (ringW - avaH) / 2 + ringW * 0.06);  // リング中央に足元寄せ

  return (
    <View style={styles.c}>
      <TabBackground source={homeBg}>
        {myAvatar != null && (
          <Image source={myAvatar} style={{ position: 'absolute', left: avaLeft, top: avaTop, width: avaW, height: avaH }} resizeMode="contain" />
        )}
        <SafeBoundary tag="homering" fallback={null}>
          {/* リングをタップ=AIコーチ(分析ホーム)を開く。成長/継続の詳細分析はそこへ集約。 */}
          <Pressable style={[styles.wrap, { top, left, width: ringW, height: ringW }]} onPress={() => nav.navigate('AICoach')} accessibilityLabel="分析ホームを開く">
            {/* 画像は必ず明示サイズ(=ringW)で拘束する。absoluteFill+containは実機で実寸化する事故があるため使わない。 */}
            {/* グロー(1重) */}
            <Animated.Image
              source={GLOW}
              resizeMode="contain"
              style={[styles.glow, { width: ringW, height: ringW, opacity: gOp, transform: [{ scale: gSc }] }]}
            />
            <Image source={RING} style={{ width: ringW, height: ringW }} resizeMode="contain" />
            <View style={styles.pct} pointerEvents="none">
              {/* 数字＋ラベル(到達度)を縦に積み、その塊の中心を穴の中心に合わせる。ラベルは数字の下。
                  iOSは lineHeight<fontSize や textAlignVertical/includeFontPadding を無視するため、数字の
                  フォント下余白(ディセント)が残って離れて見えた。→ 数字を高さ固定の overflow:hidden で包み、
                  下の空白を物理的にクリップしてラベルとの隙間(≈5px)を確実に詰める。 */}
              <View style={styles.pctInner}>
                <View style={{ height: Math.round(ringW * 0.30 * 0.81), overflow: 'hidden' }}>
                  <Text style={[styles.num, { fontSize: Math.round(ringW * 0.30), lineHeight: Math.round(ringW * 0.30) }]}>
                    {predScore}<Text style={[styles.numSmall, { fontSize: Math.round(ringW * 0.13) }]}>/{predMax}</Text>
                  </Text>
                </View>
                {/* 現在レベル(N5/N4/N3 or JFT)＋「予想得点」。中央=受験レベルの予想得点/総得点。 */}
                <View style={[styles.lblRow, { marginTop: 5 }]}>
                  <Text style={[styles.lbl, { fontSize: Math.round(ringW * 0.085) }]}>{levelLabel}</Text>
                  <Text style={[styles.lbl, { fontSize: Math.round(ringW * 0.085) }]}>予想得点</Text>
                </View>
              </View>
            </View>
          </Pressable>
        </SafeBoundary>
        <SafeBoundary tag="homecoach" fallback={null}>
          <HomeCoach status={status} learned={learnedNow(state, now)} />
        </SafeBoundary>
        {/* 桜の今日の一言(受験日 > 出迎え)。1日1回・タップで消える。減衰レイヤーが頻度を絞る。 */}
        <SafeBoundary tag="sakuraspeech" fallback={null}>
          <SakuraSpeech />
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
  lblRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lbl: { fontWeight: '700', letterSpacing: 1.5, color: '#dbe4ff', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4, includeFontPadding: false },
  num: { fontWeight: '900', color: '#ffffff', textShadowColor: 'rgba(160,200,255,0.9)', textShadowRadius: 14, textAlign: 'center', textAlignVertical: 'center', includeFontPadding: false },
  numSmall: { fontWeight: '800', color: '#eaf0ff' },
});
