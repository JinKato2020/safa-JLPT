// ホーム = 星屑リングを主役に。背景=HOME.png 全画面／上部に合格リング(星屑リング)＋中央に合格率。
//  リング画像は段階素材(到達度で差し替え)。中央の合格率は動的。グローは呼吸するようにゆっくり明滅(Animated)。
//  ※DQ風ステータスカードは不採用(ユーザー指定)。上部の共通バーは MainTabs のオーバーレイ。
import { useMemo, useEffect, useRef, useState } from 'react';
import { View, Text, Image, Animated, StyleSheet, useWindowDimensions, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../theme';
import { useT } from '../i18n';
import { useAppState, useAppActions } from '../store/store';
import { learnedNow } from '../store/selectors';
import { dayStr } from '../store/state';
import { TabBackground } from '../components/TabScene';
import { useHomeBg } from '../data/tabArt';
import { homeStatus } from '../home/homeStatus';
import HomeCoach from '../home/HomeCoach';
import ExamInfoCard from '../home/ExamInfoCard';
import SafeBoundary from '../components/SafeBoundary';
import AccountGrowthCard from '../components/AccountGrowthCard';
import AccountStreakCard from '../components/AccountStreakCard';
import SwipeSheet from '../components/SwipeSheet';

const RING = require('../../assets/home/pass_ring.png');
const GLOW = require('../../assets/home/ring_glow.png');

// 🤖アドバイスカードの地色=選択中のテーマ色。水彩5種は代表色・light/dark/autoはbrand青(c.blue)。
const THEME_TINT: Record<string, string> = {
  sakura: '#d76b8c', sky: '#4a8fcf', green: '#42a066', fuji: '#7d68c6', akane: '#d97840',
};

export default function HomeScreen() {
  const state = useAppState();
  const now = Date.now();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const c = useColors();
  const t = useT();
  const homeBg = useHomeBg(); // 昼/夜で自動切替
  const [showCards, setShowCards] = useState(false);
  const [showAdvice, setShowAdvice] = useState(false); // 🤖AIコーチの助言(桜と犬の間に表示)
  // 到達度の左に出す現在レベル(JFT目標はレベル無し=「JFT」)。
  const levelLabel = (state.settings.targetExam ?? 'jlpt') === 'jft' ? 'JFT' : state.settings.level;

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
  // グロー(1重)。増光＋やや拡大で存在感を強める。
  const gOp = glow.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.9] });
  const gSc = glow.interpolate({ inputRange: [0, 1], outputRange: [1.08, 1.24] });

  const ringW = Math.round(width * 0.40); // 画面幅の40%(ヒーロー寄せに戻し)
  const top = Math.round(height * 0.15);  // やや上
  const left = Math.round((width - ringW) / 2);
  const pct = Math.round(status.passPct);

  // アドバイス地色=選択中のテーマ色。
  const adviceColor = THEME_TINT[state.settings.theme ?? 'auto'] ?? c.blue;
  // 🤖AIコーチの助言=現在の指標(合格率・各分野の到達度)から、いちばん弱い分野を優先案内。
  const advice = useMemo(() => {
    const subs = status.subjects;
    const weakest = subs.reduce((a, b) => (b.pct < a.pct ? b : a), subs[0]);
    const p = status.passPct;
    const hlKey = p >= 70 ? 'home.ai_hl_pass' : p >= 50 ? 'home.ai_hl_close' : p >= 20 ? 'home.ai_hl_build' : 'home.ai_hl_start';
    const cat = t(weakest.labelKey);
    return {
      title: t('home.ai_title'),
      hl: t(hlKey),
      lines: [t('home.ai_passprob', { n: p }), t('home.ai_weak', { cat, pct: weakest.pct }), t('home.ai_advice', { action: cat })],
    };
  }, [status, t]);

  return (
    <View style={styles.c}>
      <TabBackground source={homeBg}>
        <SafeBoundary tag="homering" fallback={null}>
          <Pressable style={[styles.wrap, { top, left, width: ringW, height: ringW }]} onPress={() => setShowCards(true)}>
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
                    {pct}<Text style={[styles.numSmall, { fontSize: Math.round(ringW * 0.15) }]}>%</Text>
                  </Text>
                </View>
                {/* 到達度の左に現在レベル(N5/N4/N3 or JFT)を同じ大きさで表示。 */}
                <View style={[styles.lblRow, { marginTop: 5 }]}>
                  <Text style={[styles.lbl, { fontSize: Math.round(ringW * 0.085) }]}>{levelLabel}</Text>
                  <Text style={[styles.lbl, { fontSize: Math.round(ringW * 0.085) }]}>到達度</Text>
                </View>
              </View>
            </View>
          </Pressable>
        </SafeBoundary>
        <SafeBoundary tag="homecoach" fallback={null}>
          <HomeCoach status={status} learned={learnedNow(state, now)} />
        </SafeBoundary>
        {/* 🤖アドバイス=リングと桜の間(リング直下)に表示。地色=選択中のテーマ色。タップで閉じる。 */}
        {showAdvice ? (
          <View style={[styles.adviceWrap, { top: top + ringW + 20 }]} pointerEvents="box-none">
            <Pressable style={[styles.adviceCard, { backgroundColor: adviceColor }]} onPress={() => setShowAdvice(false)} accessibilityLabel={advice.title}>
              <Text style={styles.adviceTitle}>{advice.title}</Text>
              <Text style={styles.adviceHl}>{advice.hl}</Text>
              {advice.lines.map((ln, i) => (
                <Text key={i} style={styles.adviceLine} numberOfLines={3}>・{ln}</Text>
              ))}
            </Pressable>
          </View>
        ) : null}
        {/* 最上部の🤖アドバイスボタン。タップでリングと桜の間にAIコーチの助言を出す。上部左のアイコン列を避け右端に配置。 */}
        <Pressable
          style={[styles.adviceBtn, { top: insets.top + 6, backgroundColor: c.surface, borderColor: c.line }]}
          onPress={() => setShowAdvice((v) => !v)}
          accessibilityLabel={t('home.ai_title')}
          hitSlop={6}
        >
          <Text style={styles.adviceGlyph}>🤖</Text>
        </Pressable>
      </TabBackground>
      <SwipeSheet visible={showCards} onClose={() => setShowCards(false)}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.cardsList}>
          {/* 最上部＝試験情報(桜＋試験日/残日数/申込期間/費用)。その下に成長・継続カード。 */}
          <ExamInfoCard />
          <AccountGrowthCard />
          <AccountStreakCard />
        </ScrollView>
      </SwipeSheet>
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
  adviceBtn: {
    position: 'absolute', right: 12, width: 40, height: 40, borderRadius: 20, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', zIndex: 20,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 5,
  },
  adviceGlyph: { fontSize: 20 },
  // 🤖アドバイスカード=リングと桜の間に置く帯。テーマ色地＋白文字(どのテーマ色でも読めるよう薄い影)。
  adviceWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: 16, zIndex: 15 },
  adviceCard: {
    maxWidth: 320, width: '90%', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 18, borderBottomRightRadius: 6,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  adviceTitle: { fontSize: 12, fontWeight: '800', color: '#fff', opacity: 0.95, letterSpacing: 0.5 },
  adviceHl: { fontSize: 15, fontWeight: '900', color: '#fff', marginTop: 2, lineHeight: 21, textShadowColor: 'rgba(0,0,0,0.25)', textShadowRadius: 3 },
  adviceLine: { fontSize: 12.5, fontWeight: '600', color: '#fff', marginTop: 3, lineHeight: 18, opacity: 0.97, textShadowColor: 'rgba(0,0,0,0.22)', textShadowRadius: 2 },
  lbl: { fontWeight: '700', letterSpacing: 1.5, color: '#dbe4ff', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4, includeFontPadding: false },
  num: { fontWeight: '900', color: '#ffffff', textShadowColor: 'rgba(160,200,255,0.9)', textShadowRadius: 14, textAlign: 'center', textAlignVertical: 'center', includeFontPadding: false },
  numSmall: { fontWeight: '800', color: '#eaf0ff' },
  cardsList: { paddingHorizontal: 16, gap: 12 },
});
