// カード①(正解率)。DQ風: 称号＋合格到達Lv(共通ヘッダー)＋5区分の正解率バー＋直近10日の合格到達Lv推移。
import { View, Text, StyleSheet } from 'react-native';
import { useT } from '../i18n';
import { type HomeStatus } from './homeStatus';
import FramedPanel, { AnimBar, PC, useReveal } from './FramedPanel';
import StatusHeader from './StatusHeader';
import MiniTrend from './MiniTrend';

export default function StatusPanel({ data, lvTrend, width }: { data: HomeStatus; lvTrend: number[]; width: number }) {
  const t = useT();
  const { progress, frac } = useReveal();
  const cu = (n: number) => Math.round(n * frac);
  return (
    <FramedPanel width={width}>
      <StatusHeader passPct={data.passPct} rankTitleKey={data.rankTitleKey} />
      <Text style={styles.sect}>{t('home.ring_title')}</Text>
      {data.subjects.map((sub) => (
        <View key={sub.key} style={styles.barRow}>
          <Text style={styles.lbl}>{t(sub.labelKey)}</Text>
          <View style={{ flex: 1 }}><AnimBar pct={sub.pct} progress={progress} height={13} segs={18} /></View>
          <Text style={styles.pct}>{cu(sub.pct)}%</Text>
        </View>
      ))}
      <MiniTrend title={t('home.passprob_trend_title')} values={lvTrend} color="#F6C569" />
    </FramedPanel>
  );
}

const styles = StyleSheet.create({
  sect: { color: PC.gold, fontWeight: '800', fontSize: 11.5, marginBottom: 3 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 3 },
  lbl: { width: 28, color: PC.ink, fontWeight: '800', fontSize: 12.5 },
  pct: { width: 36, textAlign: 'right', color: PC.ink, fontWeight: '800', fontSize: 12, fontVariant: ['tabular-nums'] },
});
