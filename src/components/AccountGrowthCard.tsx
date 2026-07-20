// 成長カード(ステータス画面・清潔系)。覚えた語の総数＋今週の増加＋直近14日の推移。
// さらに「合格率の推移」を下段に追加(passProbの日次スナップショット=growth[].passProb)。
import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppState } from '../store/store';
import { learnedNow, readinessFor, daimonCoveragePct, ringsFor } from '../store/selectors';
import { dayStr } from '../store/state';
import { growthBars, weekGain, passCurve, passGain } from '../home/growthStats';
import { daimonUnitIds } from '../data/daimon';
import { ringItemIdsFor } from '../data';
import { useT } from '../i18n';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';

const CHART_H = 40;

export default function AccountGrowthCard() {
  const state = useAppState();
  const t = useT();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const now = Date.now();
  const today = dayStr(now);

  // 覚えた語
  const learned = learnedNow(state, now);
  const gain = weekGain(state, today, 7);
  const bars = growthBars(state, today, 14);
  const barMax = Math.max(1, ...bars);
  const last = bars.length - 1;

  // 合格率(現在値=ライブ、推移=日次スナップショット。今日ぶんはライブ値で上書きし整合)
  const passNow = Math.round(readinessFor(state, now).passProbability ?? 0);
  const pBars = passCurve(state, today, 14);
  if (pBars.length) pBars[pBars.length - 1] = passNow;
  const pGain = passGain(state, today, 7);

  // カバー率＋習得数（漢字・語彙・文法）
  const kanjiCov = daimonCoveragePct(state, now, 'kanji_read') ?? 0;
  const vocabCov = daimonCoveragePct(state, now, 'context') ?? 0;
  const bunkouCov = daimonCoveragePct(state, now, 'grammar_form') ?? 0;
  const kanjiTotal = daimonUnitIds(state.settings.level, 'kanji_read').length;
  const vocabTotal = daimonUnitIds(state.settings.level, 'context').length;
  const bunkouTotal = daimonUnitIds(state.settings.level, 'grammar_form').length;
  const kanjiLearned = Math.round(kanjiCov * kanjiTotal / 100);
  const vocabLearned = Math.round(vocabCov * vocabTotal / 100);
  const bunkouLearned = Math.round(bunkouCov * bunkouTotal / 100);

  // リング用（4カテゴリの達成度）
  const rings = useMemo(() => ringsFor(state, now), [state, now]);
  const mojiRing = rings.moji_goi ?? 0;
  const bunkouRing = rings.bunpou ?? 0;
  const dokakaiRing = rings.dokkai ?? 0;
  const chouakaiRing = rings.choukai ?? 0;

  return (
    <View style={s.card}>
      <Text style={s.head}>🌱 {t('home.section_growth')}</Text>

      {/* 覚えた語の推移 */}
      <View style={s.row}>
        <Text style={s.big}>{t('account.learned_words', { n: learned })}</Text>
        {gain > 0 ? <Text style={s.gain}>{t('account.week_gain', { n: gain })}</Text> : null}
      </View>
      <Text style={s.trendLbl}>{t('account.growth_trend')}</Text>
      <View style={[s.chart, { height: CHART_H }]}>
        {bars.map((v, i) => (
          <View key={i} style={s.col}>
            <View style={{ width: '68%', height: Math.max(2, (v / barMax) * (CHART_H - 8)), backgroundColor: c.green, opacity: i === last ? 1 : 0.45, borderRadius: 2 }} />
          </View>
        ))}
      </View>

      {/* カバー率バー（漢字・語彙・文法） */}
      <View style={s.coverageGroup}>
        {[
          { label: '漢字', cov: kanjiCov, learned: kanjiLearned, total: kanjiTotal },
          { label: '語彙', cov: vocabCov, learned: vocabLearned, total: vocabTotal },
          { label: '文法', cov: bunkouCov, learned: bunkouLearned, total: bunkouTotal },
        ].map((item, i) => (
          <View key={i} style={s.coverageRow}>
            <Text style={s.coverageLabel}>{item.label}</Text>
            <View style={s.coverageBar}>
              <View style={[s.coverageFill, { width: `${item.cov}%`, backgroundColor: c.green }]} />
            </View>
            <Text style={s.coverageNum}>{item.learned}/{item.total}</Text>
          </View>
        ))}
      </View>

      <View style={s.sep} />

      {/* 合格率の推移(0-100固定スケール) */}
      <View style={s.row}>
        <Text style={s.bigBlue}>{t('account.pass_now', { n: passNow })}</Text>
        {pGain !== 0 ? <Text style={[s.gain, { color: pGain > 0 ? c.blue : c.faint }]}>{t('account.pass_gain', { n: pGain > 0 ? `+${pGain}` : String(pGain) })}</Text> : null}
      </View>
      <Text style={s.trendLbl}>{t('account.pass_trend')}</Text>
      <View style={[s.chart, { height: CHART_H }]}>
        {pBars.map((v, i) => (
          <View key={i} style={s.col}>
            <View style={{ width: '68%', height: Math.max(2, (Math.min(100, v) / 100) * (CHART_H - 8)), backgroundColor: c.blue, opacity: i === last ? 1 : 0.45, borderRadius: 2 }} />
          </View>
        ))}
      </View>

      {/* リング（漢字・語彙、文法、読解、聴解） */}
      <View style={s.ringGroup}>
        {[
          { label: '漢字・語彙', pct: mojiRing },
          { label: '文法', pct: bunkouRing },
          { label: '読解', pct: dokakaiRing },
          { label: '聴解', pct: chouakaiRing },
        ].map((item, i) => (
          <View key={i} style={s.ringItem}>
            <View style={[s.ringCircle, { borderColor: c.blue }]}>
              <Text style={s.ringText}>{item.pct}%</Text>
            </View>
            <Text style={s.ringLabel}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  card: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: spacing.lg, gap: spacing.xs },
  head: { fontSize: ty.small, fontWeight: '800', color: c.green, letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  big: { fontSize: ty.h1, fontWeight: '900', color: c.ink, fontVariant: ['tabular-nums'] },
  bigBlue: { fontSize: ty.h1, fontWeight: '900', color: c.blue, fontVariant: ['tabular-nums'] },
  gain: { fontSize: ty.small, fontWeight: '800', color: c.green },
  trendLbl: { fontSize: ty.tiny, color: c.faint, fontWeight: '700', marginTop: spacing.xs },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, backgroundColor: c.bgSoft, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, paddingHorizontal: 4, paddingVertical: 3, marginTop: 2 },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  sep: { height: 1, backgroundColor: c.line, marginVertical: spacing.sm },
  coverageGroup: { gap: spacing.xs, marginTop: spacing.xs },
  coverageRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  coverageLabel: { fontSize: ty.tiny, fontWeight: '700', color: c.ink, width: 40 },
  coverageBar: { flex: 1, height: 6, backgroundColor: c.bgSoft, borderRadius: 3, overflow: 'hidden' },
  coverageFill: { height: '100%', borderRadius: 3 },
  coverageNum: { fontSize: ty.tiny, fontWeight: '700', color: c.faint, width: 45, textAlign: 'right' },
  ringGroup: { flexDirection: 'row', justifyContent: 'space-around', marginTop: spacing.sm, gap: spacing.xs },
  ringItem: { alignItems: 'center', gap: spacing.xs },
  ringCircle: { width: 50, height: 50, borderRadius: 25, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  ringText: { fontSize: ty.small, fontWeight: '900', color: c.blue, fontVariant: ['tabular-nums'] },
  ringLabel: { fontSize: 10, fontWeight: '600', color: c.faint, textAlign: 'center', lineHeight: 12 },
});
