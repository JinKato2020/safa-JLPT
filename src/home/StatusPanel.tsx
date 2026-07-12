// ステータスカード(3カードの1枚)。和風フレーム中央に ヘッダー＋合格Lv＋5区分バー(実データ・アニメ)。
import { View, Text, Image, StyleSheet } from 'react-native';
import { useT } from '../i18n';
import { GUIDE } from '../data/mywordsArt';
import { studyHM, type HomeStatus } from './homeStatus';
import FramedPanel, { AnimBar, PC, useReveal } from './FramedPanel';

export default function StatusPanel({ data, width }: { data: HomeStatus; width: number }) {
  const t = useT();
  const { progress, frac } = useReveal();
  const cu = (n: number) => Math.round(n * frac);
  const { h, m } = studyHM(data.studySeconds);
  return (
    <FramedPanel width={width}>
      <View style={styles.phead}>
        <Image source={GUIDE.open} style={styles.portrait} resizeMode="cover" />
        <View style={{ flex: 1 }}>
          <Text style={styles.rank} numberOfLines={1}>{t('status.rank_label')}：{t(data.rankTitleKey)}</Text>
          <Text style={styles.meta}>{t('status.streak_label')}：<Text style={styles.val}>{t('status.days', { n: cu(data.streakDays) })}</Text></Text>
          <Text style={styles.meta}>{t('status.studytime_label')}：<Text style={styles.val}>{h > 0 ? t('status.time_hm', { h, m }) : t('status.time_m', { m })}</Text></Text>
        </View>
      </View>

      <View style={styles.mainRow}>
        <Text style={styles.mainLbl}>{t('status.pass_level')}</Text>
        <View style={styles.mainBarWrap}>
          <AnimBar pct={data.passPct} progress={progress} height={20} segs={22} gradient />
          <View style={styles.mainPctWrap} pointerEvents="none"><Text style={styles.mainPct}>{t('status.pass_reach', { n: cu(data.passPct) })}</Text></View>
        </View>
      </View>

      {data.subjects.map((sub) => (
        <View key={sub.key} style={styles.barRow}>
          <Text style={styles.lbl}>{t(sub.labelKey)}</Text>
          <View style={{ flex: 1 }}><AnimBar pct={sub.pct} color={sub.color} progress={progress} /></View>
          <Text style={styles.pct}>{cu(sub.pct)}%</Text>
        </View>
      ))}
    </FramedPanel>
  );
}

const styles = StyleSheet.create({
  phead: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 8 },
  portrait: { width: 46, height: 46, borderRadius: 12, borderWidth: 2, borderColor: '#e7c877', backgroundColor: '#f6cfe0' },
  rank: { color: PC.gold, fontWeight: '900', fontSize: 13.5, fontFamily: 'ShipporiMincho-Bold' },
  meta: { color: PC.mute, fontSize: 12, marginTop: 1.5 },
  val: { color: PC.ink, fontWeight: '800' },
  mainRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  mainLbl: { color: PC.gold, fontWeight: '800', fontSize: 12.5, fontFamily: 'ShipporiMincho-Bold' },
  mainBarWrap: { flex: 1, position: 'relative' },
  mainPctWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  mainPct: { color: '#fff', fontWeight: '900', fontSize: 11, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4 },
  lbl: { width: 28, color: PC.ink, fontWeight: '800', fontSize: 12.5, fontFamily: 'ShipporiMincho-Bold' },
  pct: { width: 38, textAlign: 'right', color: PC.ink, fontWeight: '800', fontSize: 12, fontVariant: ['tabular-nums'] },
});
