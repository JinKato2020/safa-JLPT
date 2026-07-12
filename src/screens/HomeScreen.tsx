// ホーム = ゲーム風ステータス画面(B案・1画面完結)。
// 背景=HOME.png 全画面／中央=ステータスパネル(内側スクロール)／下部=動く桜の巫女(AIコーチの吹き出し)。
// 上部の共通バー(アカウント/JLPTレベル/設定/通知)は MainTabs のオーバーレイで別途表示。
import { useMemo } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useT } from '../i18n';
import { useAppState } from '../store/store';
import { readinessFor, ringsFor, nextBestAction, growthSeries } from '../store/selectors';
import { examOf } from '../engine/examProfile';
import { dayStr } from '../store/state';
import type { Category } from '../engine/engine';
import type { RootStackParamList } from '../navigation/types';
import { TabBackground } from '../components/TabScene';
import { HOME_BG } from '../data/tabArt';
import StatusPanel from '../home/StatusPanel';
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

  return (
    <View style={styles.c}>
      <TabBackground source={HOME_BG}>
        <View style={[styles.panelWrap, { top: height * 0.185 }]} pointerEvents="box-none">
          <SafeBoundary tag="statuspanel" fallback={null}>
            <StatusPanel data={status} maxHeight={height * 0.42} />
          </SafeBoundary>
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
  panelWrap: { position: 'absolute', left: 14, right: 14 },
  guideWrap: { position: 'absolute', right: 8, bottom: 6, alignItems: 'flex-end' },
});
