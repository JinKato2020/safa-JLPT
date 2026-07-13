// ホーム = ゲーム風ステータス画面(B案・1画面完結)。
// 背景=HOME.png 全画面／中央=ステータスパネル(内側スクロール)／下部=動く桜の巫女(AIコーチの吹き出し)。
// 上部の共通バー(アカウント/JLPTレベル/設定/通知)は MainTabs のオーバーレイで別途表示。
import { useMemo, useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, type NativeSyntheticEvent, type NativeScrollEvent, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useT } from '../i18n';
import { useAppState, useAppActions } from '../store/store';
import { readinessFor, ringsFor, nextBestAction, growthSeries, learnedNow } from '../store/selectors';
import { examOf } from '../engine/examProfile';
import { dayStr } from '../store/state';
import type { Category } from '../engine/engine';
import type { RootStackParamList } from '../navigation/types';
import { TabBackground } from '../components/TabScene';
import { HOME_BG } from '../data/tabArt';
import StatusPanel from '../home/StatusPanel';
import StreakCard from '../home/StreakCard';
import CoverageCard from '../home/CoverageCard';
import { FRAME_ASPECT } from '../home/FramedPanel';
import HomeGuide, { type GuideAdvice } from '../home/HomeGuide';
import { homeStatus } from '../home/homeStatus';
import SafeBoundary from '../components/SafeBoundary';

const RING_ORDER: Category[] = ['moji_goi', 'bunpou', 'dokkai', 'choukai'];

export default function HomeScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const state = useAppState();
  const t = useT();
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
  const readiness = useMemo(() => readinessFor(state, now), [state]); // eslint-disable-line react-hooks/exhaustive-deps
  const rings = useMemo(() => ringsFor(state, now), [state]); // eslint-disable-line react-hooks/exhaustive-deps
  const nba = useMemo(() => nextBestAction(state, now), [state]); // eslint-disable-line react-hooks/exhaustive-deps
  const prof = examOf(state.settings.targetExam);
  const passProb = readiness.passProbability;
  const measured = (readiness.overallPct ?? 0) > 0;
  const today = dayStr(now);
  const series = growthSeries(state);
  const last = series[series.length - 1];
  const prev = series[series.length - 2];
  const todayGain = last && last.day === today ? last.learned - (prev?.learned ?? 0) : 0;
  const ppSeries = (state.growth ?? []).slice(-14).map((g) => g.passProb ?? 0);

  // AIコーチ分析(端末内・非送信)= 桜巫女の吹き出しで伝える。褒める材料を積極的に拾う。
  const advice: GuideAdvice = useMemo(() => {
    const lines: string[] = [];
    let hl: string;
    if (!measured) {
      hl = t('home.ai_hl_start');
      lines.push(t('home.ai_start_body'));
    } else {
      hl = t(passProb >= 80 ? 'home.ai_hl_pass' : passProb >= 40 ? 'home.ai_hl_close' : 'home.ai_hl_build');
      let strong: { cat: Category; v: number } | null = null;
      for (const cd of RING_ORDER) { const v = rings[cd]; if (v !== null && (strong === null || v > strong.v)) strong = { cat: cd, v }; }
      if (strong && strong.v >= 60) lines.push(t('home.ai_strong', { cat: t(prof.catLabel[strong.cat]), pct: strong.v }));
      if (todayGain > 0) lines.push(t('home.ai_today_growth', { n: todayGain }));
      const ppUp = ppSeries.length >= 2 ? ppSeries[ppSeries.length - 1] - ppSeries[ppSeries.length - 2] : 0;
      if (ppUp > 0) lines.push(t('home.ai_improving', { n: ppUp }));
      lines.push(t('home.ai_passprob', { n: passProb }));
      if (passProb >= 80) lines.push(t('home.ai_keep'));
      else if (nba) lines.push(t('home.ai_advice', { action: t(prof.catLabel[nba.category]) }));
    }
    lines.push(state.streak.current > 0 ? t('home.ai_streak', { n: state.streak.current }) : t('home.ai_streak0'));
    return { title: t('home.ai_title'), hl, lines };
  }, [measured, passProb, rings, nba, todayGain, ppSeries, prof, t, state.streak.current]);

  // ホーム3カード(ステータス/継続/カバー率)を横スワイプで切替。カード上=カード切替、背景=タブ切替。
  // 背景(HOME.png)を活かすためコンパクトに(参考画像=上部に小さめのパネル)。
  const cardW = Math.min(width * 0.72, 300);
  const cardH = cardW / FRAME_ASPECT;
  const [page, setPage] = useState(0);
  const onPage = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(e.nativeEvent.contentOffset.x / cardW));

  return (
    <View style={styles.c}>
      <TabBackground source={HOME_BG}>
        <View style={[styles.panelWrap, { top: height * 0.12, width: cardW, height: cardH + 22, left: (width - cardW) / 2 }]}>
          <SafeBoundary tag="homecards" fallback={null}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={{ width: cardW, height: cardH }}
              onMomentumScrollEnd={onPage}
            >
              <StatusPanel data={status} width={cardW} />
              <StreakCard width={cardW} />
              <CoverageCard width={cardW} />
            </ScrollView>
          </SafeBoundary>
          <View style={styles.dots}>
            {[0, 1, 2].map((i) => <View key={i} style={[styles.dot, page === i && styles.dotOn]} />)}
          </View>
        </View>
        <View style={styles.guideWrap} pointerEvents="box-none">
          <HomeGuide advice={advice} width={Math.min(160, width * 0.42)} />
        </View>
      </TabBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1 },
  panelWrap: { position: 'absolute' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 7, marginTop: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotOn: { backgroundColor: '#ffe6a3', width: 9, height: 9, borderRadius: 5 },
  guideWrap: { position: 'absolute', right: 8, bottom: 6, alignItems: 'flex-end' },
});
