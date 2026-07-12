// カバー率カード(3カードの1枚)。和風フレーム中央に 漢字/語彙/文法 の習得カバー率(量)をアニメバーで。
import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppState } from '../store/store';
import { coverageBars } from '../store/selectors';
import { useT } from '../i18n';
import FramedPanel, { AnimBar, PC, useReveal } from './FramedPanel';

const ROWS: { key: 'kanji' | 'vocab' | 'grammar'; labelKey: string; color: string }[] = [
  { key: 'kanji', labelKey: 'cards.kanji', color: '#d9743f' },
  { key: 'vocab', labelKey: 'cards.vocab', color: '#3f9d5a' },
  { key: 'grammar', labelKey: 'cards.grammar', color: '#7b6bd6' },
];

export default function CoverageCard({ width }: { width: number }) {
  const t = useT();
  const state = useAppState();
  const { progress, frac } = useReveal();
  const cov = useMemo(() => coverageBars(state, Date.now()), [state]); // eslint-disable-line react-hooks/exhaustive-deps
  const cu = (n: number) => Math.round(n * frac);

  return (
    <FramedPanel width={width}>
      <Text style={s.title}>{t('status.coverage')}</Text>
      {ROWS.map((r) => {
        const b = cov.find((x) => x.key === r.key) ?? { learned: 0, total: 0 };
        const pct = b.total > 0 ? Math.round((100 * b.learned) / b.total) : 0;
        return (
          <View key={r.key} style={s.row}>
            <View style={s.rowHead}>
              <Text style={s.lbl}>{t(r.labelKey)}</Text>
              <Text style={s.frac}>{cu(b.learned)}/{b.total}</Text>
              <Text style={s.pct}>{cu(pct)}%</Text>
            </View>
            <AnimBar pct={pct} color={r.color} progress={progress} height={16} segs={20} />
          </View>
        );
      })}
      <Text style={s.hint}>{t('status.coverage_hint')}</Text>
    </FramedPanel>
  );
}

const s = StyleSheet.create({
  title: { color: PC.gold, fontWeight: '900', fontSize: 14, fontFamily: 'ShipporiMincho-Bold', marginBottom: 8 },
  row: { marginTop: 8 },
  rowHead: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 4 },
  lbl: { flex: 1, color: PC.ink, fontWeight: '800', fontSize: 14, fontFamily: 'ShipporiMincho-Bold' },
  frac: { color: PC.mute, fontSize: 12, marginRight: 8, fontVariant: ['tabular-nums'] },
  pct: { color: PC.ink, fontWeight: '800', fontSize: 13, fontVariant: ['tabular-nums'] },
  hint: { color: PC.mute, fontSize: 11, marginTop: 12, lineHeight: 15 },
});
