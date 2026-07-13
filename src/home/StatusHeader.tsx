// 3カード共通のDQ風ヘッダー: 称号(ランク)＋合格到達Lv(虹バー＋数値)。
import { View, Text, StyleSheet } from 'react-native';
import { useT } from '../i18n';
import { AnimBar, PC, useReveal } from './FramedPanel';

export default function StatusHeader({ passPct, rankTitleKey }: { passPct: number; rankTitleKey: string }) {
  const t = useT();
  const { progress, frac } = useReveal();
  return (
    <View style={s.wrap}>
      <Text style={s.rank} numberOfLines={1}>{t('status.rank_label')}：{t(rankTitleKey)}</Text>
      <View style={s.lvRow}>
        <Text style={s.lvLbl}>{t('status.pass_level')}</Text>
        <View style={{ flex: 1 }}><AnimBar pct={passPct} progress={progress} height={15} segs={20} gradient /></View>
        <Text style={s.lvVal}>{Math.round(passPct * frac)}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: 7, borderBottomWidth: 1, borderBottomColor: PC.trackBorder, paddingBottom: 6 },
  rank: { color: PC.gold, fontWeight: '900', fontSize: 13, fontFamily: 'ShipporiMincho-Bold' },
  lvRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  lvLbl: { color: PC.gold, fontWeight: '800', fontSize: 11.5, fontFamily: 'ShipporiMincho-Bold' },
  lvVal: { color: '#fff', fontWeight: '900', fontSize: 12.5, width: 26, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
