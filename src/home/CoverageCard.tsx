// カード②(カバー率)。DQ風: 称号＋合格到達Lv(共通ヘッダー)＋漢字/語彙/文法の習得カバー率(分数＋バー)＋
// 直近10日に覚えた単語数の推移。
import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppState } from '../store/store';
import { coverageBars } from '../store/selectors';
import { useT } from '../i18n';
import { type HomeStatus } from './homeStatus';
import FramedPanel, { AnimBar, PC, useReveal } from './FramedPanel';
import StatusHeader from './StatusHeader';
import MiniTrend from './MiniTrend';

const ROWS: { key: 'kanji' | 'vocab' | 'grammar'; labelKey: string; color: string }[] = [
  { key: 'kanji', labelKey: 'cards.kanji', color: '#d9743f' },
  { key: 'vocab', labelKey: 'cards.vocab', color: '#3f9d5a' },
  { key: 'grammar', labelKey: 'cards.grammar', color: '#7b6bd6' },
];

export default function CoverageCard({ data, wordTrend, width }: { data: HomeStatus; wordTrend: number[]; width: number }) {
  const t = useT();
  const state = useAppState();
  const { progress, frac } = useReveal();
  const cov = useMemo(() => coverageBars(state, Date.now()), [state]); // eslint-disable-line react-hooks/exhaustive-deps
  const cu = (n: number) => Math.round(n * frac);

  return (
    <FramedPanel width={width}>
      <StatusHeader passPct={data.passPct} rankTitleKey={data.rankTitleKey} />
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
            <AnimBar pct={pct} progress={progress} height={13} segs={18} />
          </View>
        );
      })}
      <MiniTrend title={t('home.growth_chart_title')} values={wordTrend} color="#7fd0c8" />
    </FramedPanel>
  );
}

const s = StyleSheet.create({
  title: { color: PC.gold, fontWeight: '800', fontSize: 11.5, fontFamily: 'ShipporiMincho-Bold', marginBottom: 3 },
  row: { marginTop: 5 },
  rowHead: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 3 },
  lbl: { flex: 1, color: PC.ink, fontWeight: '800', fontSize: 13, fontFamily: 'ShipporiMincho-Bold' },
  frac: { color: PC.mute, fontSize: 11.5, marginRight: 8, fontVariant: ['tabular-nums'] },
  pct: { color: PC.ink, fontWeight: '800', fontSize: 12, fontVariant: ['tabular-nums'] },
});
