// ホーム = 合格到達度リングを中央に据えたシンプル画面。
// 背景=HOME.png 全画面／中央=合格リング(到達度で段位が成る)＋到達度％＋桜巫女。
// 上部の共通バー(アカウント/JLPTレベル/設定/通知)は MainTabs のオーバーレイで別途表示。
import { useMemo, useEffect } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { useAppState, useAppActions } from '../store/store';
import { learnedNow } from '../store/selectors';
import { dayStr } from '../store/state';
import { TabBackground } from '../components/TabScene';
import { HOME_BG } from '../data/tabArt';
import { homeStatus } from '../home/homeStatus';
import PassRing from '../home/PassRing';
import SafeBoundary from '../components/SafeBoundary';

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

  const ringSize = Math.min(width * 0.88, height * 0.62);

  return (
    <View style={styles.c}>
      <TabBackground source={HOME_BG}>
        <View style={styles.center} pointerEvents="box-none">
          <SafeBoundary tag="passring" fallback={null}>
            <PassRing pct={status.passPct} size={ringSize} />
          </SafeBoundary>
        </View>
      </TabBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1 },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});
