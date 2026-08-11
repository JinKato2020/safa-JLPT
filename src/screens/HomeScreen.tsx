// ホーム = 星屑リングを主役に。背景=HOME.png 全画面／上部に合格リング(星屑リング)＋中央に合格率。
//  リング画像は段階素材(到達度で差し替え)。中央の合格率は動的。グローは呼吸するようにゆっくり明滅(Animated)。
//  ※DQ風ステータスカードは不採用(ユーザー指定)。上部の共通バーは MainTabs のオーバーレイ。
import { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, Image, Animated, StyleSheet, useWindowDimensions, Pressable } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useT } from '../i18n';
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

const RING = require('../../assets/home/pass_ring.png');
const GLOW = require('../../assets/home/ring_glow.png');

export default function HomeScreen() {
  const state = useAppState();
  const now = Date.now();
  const { width, height } = useWindowDimensions();
  const homeBg = useHomeBg(); // 昼/夜で自動切替
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const t = useT();
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
  // ホームで静止(無操作)10秒ごとに桜の一言を出すための合図。画面のどこかに触れると10秒を測り直す。
  const [idleTick, setIdleTick] = useState(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setIdleTick((x) => x + 1), 10000);
  }, []);
  // ホームが見えている間だけ計測(他タブへ行ったら止める)。
  useFocusEffect(useCallback(() => {
    armIdle();
    return () => { if (idleTimer.current) clearTimeout(idleTimer.current); };
  }, [armIdle]));

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
  // リング穴(≈幅62%)に必ず収める得点表示。自動縮小(adjustsFontSizeToFit)は「入れ子サイズ×iOS」で
  //  分母「/満点」が消える不具合があったため、文字数から実フォントサイズをJSで決める確定方式にする。
  const holeW = ringW * 0.66;
  const sLen = String(predScore).length;   // 得点の桁数(例 120=3)
  const mLen = String(predMax).length + 1; // 「/満点」の文字数(例 /180=4)
  const AV = 0.60;                          // 太字1文字の実効幅 ≈ 0.60×フォント
  const bigFs = Math.min(ringW * 0.30, holeW / (sLen * AV + mLen * AV * 0.5));
  const smallFs = Math.round(bigFs * 0.5);

  return (
    <View style={styles.c} onStartShouldSetResponderCapture={() => { armIdle(); return false; }}>
      <TabBackground source={homeBg}>
        <SafeBoundary tag="homering" fallback={null}>
          {/* リングをタップ=AIコーチ(分析ホーム)を開く。成長/継続の詳細分析はそこへ集約。 */}
          <Pressable style={[styles.wrap, { top, left, width: ringW, height: ringW }]} onPress={() => nav.navigate('AICoach')} accessibilityLabel={t('home.a11y_open_coach')}>
            {/* 画像は必ず明示サイズ(=ringW)で拘束する。absoluteFill+containは実機で実寸化する事故があるため使わない。 */}
            {/* グロー(1重) */}
            <Animated.Image
              source={GLOW}
              resizeMode="contain"
              style={[styles.glow, { width: ringW, height: ringW, opacity: gOp, transform: [{ scale: gSc }] }]}
            />
            <Image source={RING} style={{ width: ringW, height: ringW }} resizeMode="contain" />
            <View style={styles.pct} pointerEvents="none">
              {/* 読みやすさ用の敷き=リング穴の中央に半透明の暗い円をそっと敷く(背景イラストが明るくても文字が沈まない)。
                  柔らかい影で縁をぼかし“ステッカー感”を出さない。文字塊(pctInner)より先に置く=背面。 */}
              <View style={[StyleSheet.absoluteFillObject, styles.center]}>
                <View style={[styles.scrim, { width: Math.round(holeW * 0.92), height: Math.round(holeW * 0.92), borderRadius: holeW }]} />
              </View>
              {/* 数字＋ラベル(到達度)を縦に積み、その塊の中心を穴の中心に合わせる。ラベルは数字の下。
                  iOSは lineHeight<fontSize や textAlignVertical/includeFontPadding を無視するため、数字の
                  フォント下余白(ディセント)が残って離れて見えた。→ 数字を高さ固定の overflow:hidden で包み、
                  下の空白を物理的にクリップしてラベルとの隙間(≈5px)を確実に詰める。 */}
              <View style={styles.pctInner}>
                {/* リングの穴幅(≈62%)に収める。長い得点(例 180/180)やフォント幅差でも自動縮小=はみ出さない。 */}
                <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' }}>
                  <Text numberOfLines={1} style={[styles.num, { fontSize: Math.round(bigFs), lineHeight: Math.round(bigFs) }]}>{predScore}</Text>
                  <Text numberOfLines={1} style={[styles.numSmall, { fontSize: smallFs, lineHeight: Math.round(bigFs) }]}>/{predMax}</Text>
                </View>
                {/* 現在レベル(N5/N4/N3 or JFT)＋「予想得点」。中央=受験レベルの予想得点/総得点。 */}
                <View style={[styles.lblRow, { marginTop: 5 }]}>
                  <Text style={[styles.lbl, { fontSize: Math.round(ringW * 0.085) }]}>{levelLabel}</Text>
                  <Text style={[styles.lbl, { fontSize: Math.round(ringW * 0.085) }]}>{t('coach.pred_score')}</Text>
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
          <SakuraSpeech idleTick={idleTick} />
        </SafeBoundary>
        {/* 今日のおすすめ(統合復習=苦手単語の復習)。桜/柴犬の下・ボトムナビの上に常設。分析はAIコーチにも有り。 */}
        <Pressable style={styles.reco} onPress={() => nav.navigate('Quiz', { review: true })} accessibilityLabel={t('cards.reco')}>
          <Text style={styles.recoTxt}>{t('cards.reco')}</Text>
        </Pressable>
      </TabBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1 },
  wrap: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute' },
  pct: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  pctInner: { alignItems: 'center', justifyContent: 'center' },
  // 読みやすさ用の敷き=暗い半透明の円。柔らかい影で縁をぼかす(iOS=shadow / Android=elevation)。
  scrim: { backgroundColor: 'rgba(8,12,24,0.46)', shadowColor: '#05070f', shadowOpacity: 0.55, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 6 },
  lblRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lbl: { fontWeight: '800', letterSpacing: 1.5, color: '#f2f6ff', textShadowColor: 'rgba(0,0,0,0.85)', textShadowRadius: 5, textShadowOffset: { width: 0, height: 1 }, includeFontPadding: false },
  num: { fontWeight: '900', color: '#ffffff', textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 7, textShadowOffset: { width: 0, height: 1 }, textAlign: 'center', textAlignVertical: 'center', includeFontPadding: false },
  numSmall: { fontWeight: '800', color: '#eef3ff', textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } },
  // 今日のおすすめボタン(画面最下部・ボトムナビの上)。背景イラストの上でも読めるよう濃い青の不透明ピル。
  reco: { position: 'absolute', left: 32, right: 32, bottom: 14, backgroundColor: '#2f62d8', borderRadius: 999, paddingVertical: 14, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  recoTxt: { color: '#ffffff', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
});
