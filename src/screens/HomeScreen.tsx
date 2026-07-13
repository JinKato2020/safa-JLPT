// ホーム = DQ風ステータスを主役に。背景=HOME.png 全画面／中央に3枚のステータスカードを横スワイプ。
//  ①正解率(5区分＋合格到達Lv推移)②カバー率(分数＋覚えた数推移)③継続(継続日数＋総学習時間)。
//  称号＋合格到達Lv は各カード共通ヘッダー。上部の共通バーは MainTabs のオーバーレイ。
import { useMemo, useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, type NativeSyntheticEvent, type NativeScrollEvent, useWindowDimensions } from 'react-native';
import { useAppState, useAppActions } from '../store/store';
import { learnedNow, growthSeries } from '../store/selectors';
import { dayStr } from '../store/state';
import { TabBackground } from '../components/TabScene';
import { HOME_BG } from '../data/tabArt';
import { homeStatus } from '../home/homeStatus';
import StatusPanel from '../home/StatusPanel';
import CoverageCard from '../home/CoverageCard';
import StreakCard from '../home/StreakCard';
import { FRAME_ASPECT } from '../home/FramedPanel';
import SafeBoundary from '../components/SafeBoundary';

export default function HomeScreen() {
  const state = useAppState();
  const now = Date.now();
  const { width, height } = useWindowDimensions();

  const status = useMemo(() => homeStatus(state, now), [state]); // eslint-disable-line react-hooks/exhaustive-deps
  const { lvTrend, wordTrend } = useMemo(() => {
    const g = growthSeries(state).slice(-10);
    return { lvTrend: g.map((p) => p.passProb ?? 0), wordTrend: g.map((p) => p.learned ?? 0) };
  }, [state]);

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

  const cardW = Math.min(width * 0.86, 330);
  const cardH = cardW / FRAME_ASPECT;
  const [page, setPage] = useState(0);
  const onPage = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(e.nativeEvent.contentOffset.x / cardW));
  const top = Math.max(height * 0.1, (height - cardH) / 2 - 20);

  return (
    <View style={styles.c}>
      <TabBackground source={HOME_BG}>
        <View style={[styles.panelWrap, { top, width: cardW, height: cardH + 22, left: (width - cardW) / 2 }]}>
          <SafeBoundary tag="homecards" fallback={null}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={{ width: cardW, height: cardH }}
              onMomentumScrollEnd={onPage}
            >
              <StatusPanel data={status} lvTrend={lvTrend} width={cardW} />
              <CoverageCard data={status} wordTrend={wordTrend} width={cardW} />
              <StreakCard data={status} width={cardW} />
            </ScrollView>
          </SafeBoundary>
          <View style={styles.dots}>
            {[0, 1, 2].map((i) => <View key={i} style={[styles.dot, page === i && styles.dotOn]} />)}
          </View>
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
});
