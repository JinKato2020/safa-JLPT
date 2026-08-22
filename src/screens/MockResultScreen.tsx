// 模試成績表(詳細結果)。合否画面の「詳細結果を見る」から遷移。一般的な模試の成績表に倣い、
//  総合判定(偏差値・判定ランク・上位%相当)＋得点分布ベルカーブ＋分野別レーダー＋区分別スコア表＋予想得点の推移を出す。
//  数値の正本: mockScoreEstimate(実測区分別→得点)・relativePositionFor(公式統計で上位%相当)・officialStats(平均/SD/得点分布/認定率)。
//  ※JLPT(N5/N4/N3)専用。相対値はすべて「予想得点を公式統計に当てはめた“相当値”」で実際の順位ではない。
import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Path, Line, Circle, Polygon, Polyline, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useT } from '../i18n';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState } from '../store/store';
import { mockScoreEstimate } from '../store/selectors';
import { relativePositionFor, isOfficialLevel } from '../ladder/relativePosition';
import {
  OFFICIAL_TOTAL_STAT, OFFICIAL_SECTION_STATS, OFFICIAL_PASS_RATE,
  OFFICIAL_BASE_LABEL, OFFICIAL_SOURCE, type OfficialLevel, type OfficialSecKey,
} from '../data/officialStats';
import type { Level } from '../engine/engine';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Styles = ReturnType<typeof makeStyles>;

// 区分キー→ラベルi18nキー(得点区分の見出し)。gengo_dokkai/gengo/dokkai/choukai を網羅。
const BLOCK_LABEL: Record<string, string> = {
  gengo_dokkai: 'mock.block_gengo_dokkai',
  gengo: 'mock.block_gengo',
  dokkai: 'mock.sec_dokkai',
  choukai: 'mock.sec_choukai',
};
// 分野別レーダーの4軸(実測正答率)。
const RADAR_CATS: { key: string; labelKey: string }[] = [
  { key: 'moji_goi', labelKey: 'mock.sec_moji_goi' },
  { key: 'bunpou', labelKey: 'mock.sec_bunpou' },
  { key: 'dokkai', labelKey: 'mock.sec_dokkai' },
  { key: 'choukai', labelKey: 'mock.sec_choukai' },
];

// 偏差値 = 50 + 10×(得点-平均)/SD。表示は 20〜80 にクランプ。
function hensachi(score: number, mean: number, sd: number): number {
  if (!(sd > 0)) return 50;
  const h = 50 + 10 * ((score - mean) / sd);
  return Math.max(20, Math.min(80, Math.round(h)));
}
// 判定ランク(A〜E)。受験者の中での位置(上位%)から。上位ほど良い。
function gradeFromTop(top: number): { letter: string; color: (c: ThemeColors) => string } {
  if (top <= 15) return { letter: 'A', color: (c) => c.green };
  if (top <= 30) return { letter: 'B', color: (c) => c.green };
  if (top <= 50) return { letter: 'C', color: (c) => c.amber };
  if (top <= 70) return { letter: 'D', color: (c) => c.amber };
  return { letter: 'E', color: (c) => c.red };
}
function mmss(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function Stars({ n, c, size }: { n: number; c: ThemeColors; size: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons key={i} name={i <= n ? 'star' : 'star-outline'} size={size} color={i <= n ? c.amber : c.faint} />
      ))}
    </View>
  );
}

// ── 得点分布ベルカーブ(公式の平均/SDで正規分布を描き、あなたの位置と合格ラインを重ねる) ──
function BellCurve({ level, score, passTotal, width, c, youLabel, passLabel }: { level: OfficialLevel; score: number; passTotal: number; width: number; c: ThemeColors; youLabel: string; passLabel: string }) {
  const H = 150, padB = 26, padT = 8, padX = 6;
  const { mean, sd } = OFFICIAL_TOTAL_STAT[level];
  const w = width - padX * 2, h = H - padB - padT;
  const xOf = (v: number) => padX + (v / 180) * w;
  const pdf = (v: number) => Math.exp(-((v - mean) ** 2) / (2 * sd * sd));
  const peak = pdf(mean) || 1;
  const yOf = (v: number) => padT + h - (pdf(v) / peak) * h;
  const N = 90;
  const xs = Array.from({ length: N + 1 }, (_, i) => (i / N) * 180);
  const base = padT + h;
  const pts = (arr: number[]) => arr.map((v) => `${xOf(v).toFixed(1)} ${yOf(v).toFixed(1)}`).join(' L ');
  const linePath = `M ${pts(xs)}`;
  // 全体の面(薄い) と あなた以上の面(=上位%相当・濃い)。
  const areaAll = `M ${xOf(0).toFixed(1)} ${base} L ${pts(xs)} L ${xOf(180).toFixed(1)} ${base} Z`;
  const rightXs = xs.filter((v) => v >= score);
  const areaTop = rightXs.length > 1
    ? `M ${xOf(score).toFixed(1)} ${base} L ${pts(rightXs)} L ${xOf(180).toFixed(1)} ${base} Z`
    : '';
  const sx = xOf(score), px = xOf(passTotal);
  return (
    <Svg width={width} height={H}>
      <Path d={areaAll} fill={c.blueLight} opacity={0.5} />
      {areaTop ? <Path d={areaTop} fill={c.blue} opacity={0.28} /> : null}
      <Path d={linePath} fill="none" stroke={c.blue} strokeWidth={2} />
      {/* 合格ライン(点線) */}
      <Line x1={px} y1={padT} x2={px} y2={base} stroke={c.amber} strokeWidth={1.5} strokeDasharray="4 3" />
      <SvgText x={Math.min(px + 3, width - 44)} y={padT + 10} fontSize={10} fill={c.amber} fontWeight="700">{`${passLabel} ${passTotal}`}</SvgText>
      {/* あなた(実線＋点) */}
      <Line x1={sx} y1={padT} x2={sx} y2={base} stroke={c.pink} strokeWidth={2} />
      <Circle cx={sx} cy={yOf(score)} r={4} fill={c.pink} />
      <SvgText x={Math.max(4, Math.min(sx - 12, width - 72))} y={padT + 22} fontSize={11} fill={c.pink} fontWeight="800">{`${youLabel} ${score}`}</SvgText>
      {/* 目盛り */}
      <Line x1={padX} y1={base} x2={padX + w} y2={base} stroke={c.line} strokeWidth={1} />
      {[0, 45, 90, 135, 180].map((v) => (
        <SvgText key={v} x={xOf(v)} y={base + 16} fontSize={9} fill={c.faint} textAnchor="middle">{v}</SvgText>
      ))}
    </Svg>
  );
}

// ── 分野別レーダー(4軸=漢字語彙/文法/読解/聴解 の実測正答率) ──
function Radar({ data, width, c }: { data: { label: string; pct: number }[]; width: number; c: ThemeColors }) {
  const H = 220, cx = width / 2, cy = H / 2, R = Math.min(width, H) / 2 - 40;
  const n = data.length;
  const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i: number, r: number) => [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))] as const;
  const rings = [0.25, 0.5, 0.75, 1];
  const poly = data.map((d, i) => pt(i, R * Math.max(0.02, d.pct / 100)).join(',')).join(' ');
  return (
    <Svg width={width} height={H}>
      {rings.map((rr, k) => (
        <Polygon key={k} points={data.map((_, i) => pt(i, R * rr).join(',')).join(' ')} fill="none" stroke={c.line} strokeWidth={1} />
      ))}
      {data.map((_, i) => { const [x, y] = pt(i, R); return <Line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={c.line} strokeWidth={1} />; })}
      <Polygon points={poly} fill={c.blue} fillOpacity={0.22} stroke={c.blue} strokeWidth={2} />
      {data.map((d, i) => { const [x, y] = pt(i, R * Math.max(0.02, d.pct / 100)); return <Circle key={i} cx={x} cy={y} r={3.5} fill={c.blue} />; })}
      {data.map((d, i) => {
        const [x, y] = pt(i, R + 20);
        return (
          <SvgText key={`l${i}`} x={x} y={y} fontSize={11} fill={c.ink2} fontWeight="700" textAnchor="middle">{d.label}</SvgText>
        );
      })}
      {data.map((d, i) => {
        const [x, y] = pt(i, R + 20);
        return (
          <SvgText key={`p${i}`} x={x} y={y + 14} fontSize={11} fill={c.mute} fontWeight="700" textAnchor="middle">{`${Math.round(d.pct)}%`}</SvgText>
        );
      })}
    </Svg>
  );
}

// ── 予想得点の推移(直近の模試) ──
function Trend({ points, passTotal, width, c, passLabel }: { points: { score: number; day: string }[]; passTotal: number; width: number; c: ThemeColors; passLabel: string }) {
  const H = 130, padB = 20, padT = 10, padX = 24;
  const w = width - padX * 2, h = H - padB - padT;
  const n = points.length;
  const xOf = (i: number) => padX + (n === 1 ? w / 2 : (i / (n - 1)) * w);
  const yOf = (v: number) => padT + h - (Math.max(0, Math.min(180, v)) / 180) * h;
  const line = points.map((p, i) => `${xOf(i)},${yOf(p.score)}`).join(' ');
  const py = yOf(passTotal);
  return (
    <Svg width={width} height={H}>
      <Line x1={padX} y1={py} x2={padX + w} y2={py} stroke={c.amber} strokeWidth={1} strokeDasharray="4 3" />
      <SvgText x={padX} y={py - 4} fontSize={9} fill={c.amber} fontWeight="700">{`${passLabel} ${passTotal}`}</SvgText>
      <Polyline points={line} fill="none" stroke={c.blue} strokeWidth={2} />
      {points.map((p, i) => (
        <Circle key={`c${i}`} cx={xOf(i)} cy={yOf(p.score)} r={i === n - 1 ? 5 : 3.5} fill={i === n - 1 ? c.pink : c.blue} />
      ))}
      {points.map((p, i) => (
        <SvgText key={`t${i}`} x={xOf(i)} y={yOf(p.score) - 9} fontSize={9} fill={c.ink2} textAnchor="middle" fontWeight="700">{p.score}</SvgText>
      ))}
      {points.map((p, i) => (
        <SvgText key={`d${i}`} x={xOf(i)} y={H - 6} fontSize={8} fill={c.faint} textAnchor="middle">{p.day.slice(5)}</SvgText>
      ))}
    </Svg>
  );
}

export default function MockResultScreen() {
  const t = useT();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'MockResultDetail'>>();
  const state = useAppState();
  const { width: winW } = useWindowDimensions();
  const { level, byCat, passed, elapsedMs } = route.params;

  const chartW = winW - spacing.md * 2 - spacing.md * 2; // 画面パディング＋カードパディング

  const est = useMemo(() => mockScoreEstimate(level, byCat), [level, byCat]);
  const correct = useMemo(() => Object.values(byCat).reduce((a, b) => a + b.c, 0), [byCat]);
  const total = useMemo(() => Object.values(byCat).reduce((a, b) => a + b.t, 0), [byCat]);

  const official = isOfficialLevel(level) ? (level as OfficialLevel) : null;
  // 相対位置: est.sections の gengo_dokkai を公式キー gengo に読み替えて渡す。
  const rel = useMemo(() => {
    const secs = est.sections.map((sec) => ({ key: sec.key === 'gengo_dokkai' ? 'gengo' : sec.key, score: sec.score, max: sec.max }));
    return relativePositionFor(level, secs, est.score);
  }, [level, est]);

  const totalHensachi = official ? hensachi(est.score, OFFICIAL_TOTAL_STAT[official].mean, OFFICIAL_TOTAL_STAT[official].sd) : null;
  const topTotal = rel?.total?.top ?? null;
  const grade = topTotal != null ? gradeFromTop(topTotal) : null;

  // 合格可能性(得点と合格ラインの差＋足切り)。
  const anyBelow = est.sections.some((sec) => sec.below);
  const margin = est.score - est.passTotal;
  const chance = anyBelow
    ? { key: 'mockres.chance_near', color: c.amber }
    : margin >= 15 ? { key: 'mockres.chance_high', color: c.green }
      : margin >= 0 ? { key: 'mockres.chance_good', color: c.green }
        : margin >= -10 ? { key: 'mockres.chance_near', color: c.amber }
          : { key: 'mockres.chance_low', color: c.red };

  const radar = RADAR_CATS.filter((r) => byCat[r.key] && byCat[r.key].t > 0)
    .map((r) => ({ label: t(r.labelKey), pct: (100 * byCat[r.key].c) / byCat[r.key].t }));

  // 予想得点の推移(直近8回・mockHistoryは遷移前に記録済み)。
  const trend = (state.mockHistory ?? [])
    .filter((m) => m.level === level && typeof m.predScore === 'number')
    .slice(-8)
    .map((m) => ({ score: m.predScore as number, day: m.day }));

  const secStat = official ? OFFICIAL_SECTION_STATS[official] : null;
  const relByKey: Record<string, number> = {};
  for (const sp of rel?.sections ?? []) relByKey[sp.key] = sp.top;

  return (
    <View style={s.root}>
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
        {/* ヘッダー */}
        <View style={s.topbar}>
          <Text style={s.topTitle}>{t('mockres.title')}</Text>
          <Pressable onPress={() => nav.goBack()} hitSlop={12}><Ionicons name="close" size={26} color={c.mute} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {/* 総合判定ヒーロー */}
          <View style={s.hero}>
            <View style={s.heroTop}>
              <View style={{ flex: 1 }}>
                <Text style={s.heroCap}>{t('mockres.header_score')}</Text>
                <Text style={s.heroScore}>{est.score}<Text style={s.heroMax}> / {est.max}</Text></Text>
                <View style={[s.judgeBadge, { backgroundColor: passed ? c.green : c.red }]}>
                  <Text style={s.judgeBadgeT}>{t(passed ? 'mock.judge_pass' : 'mock.judge_fail')}</Text>
                </View>
                <Text style={s.heroFrac}>{t('mockres.correct_frac', { n: correct, m: total, t: mmss(elapsedMs) })}</Text>
              </View>
              {grade ? (
                <View style={s.gradeWrap}>
                  <Text style={s.gradeCap}>{t('mockres.grade_label')}</Text>
                  <Text style={[s.gradeLetter, { color: grade.color(c) }]}>{grade.letter}</Text>
                  {topTotal != null ? <Stars n={rel!.total!.stars} c={c} size={15} /> : null}
                </View>
              ) : null}
            </View>
            <View style={s.heroStats}>
              {totalHensachi != null ? (
                <View style={s.hstat}>
                  <Text style={s.hstatV}>{totalHensachi}</Text>
                  <Text style={s.hstatL}>{t('mockres.hensachi_label')}</Text>
                </View>
              ) : null}
              {topTotal != null ? (
                <View style={s.hstat}>
                  <Text style={s.hstatV}>{t('mockres.rank_top', { n: Math.round(topTotal) })}</Text>
                  <Text style={s.hstatL}>{t('mockres.examinees')}</Text>
                </View>
              ) : null}
              <View style={s.hstat}>
                <Text style={[s.hstatV, { color: chance.color }]}>{t(chance.key)}</Text>
                <Text style={s.hstatL}>{t('mockres.pass_chance')}</Text>
              </View>
            </View>
            {anyBelow ? (
              <Text style={s.belowWarn}>
                {t('mockres.below_warn', {
                  label: est.sections.filter((x) => x.below).map((x) => t(BLOCK_LABEL[x.key] ?? x.key)).join('・'),
                })}
              </Text>
            ) : null}
          </View>

          {/* 得点分布ベルカーブ */}
          {official ? (
            <View style={s.card}>
              <Text style={s.cardH}>{t('mockres.dist_title')}</Text>
              <BellCurve level={official} score={est.score} passTotal={est.passTotal} width={chartW} c={c} youLabel={t('mockres.you')} passLabel={t('mockres.passline')} />
              <Text style={s.cardCap}>{t('mockres.dist_caption', { base: OFFICIAL_BASE_LABEL, mean: Math.round(OFFICIAL_TOTAL_STAT[official].mean), rate: OFFICIAL_PASS_RATE[official] })}</Text>
            </View>
          ) : null}

          {/* 分野別レーダー */}
          {radar.length >= 3 ? (
            <View style={s.card}>
              <Text style={s.cardH}>{t('mockres.radar_title')}</Text>
              <Radar data={radar} width={chartW} c={c} />
            </View>
          ) : null}

          {/* 区分別スコア表 */}
          <View style={s.card}>
            <Text style={s.cardH}>{t('mockres.table_title')}</Text>
            <View style={s.trow}>
              <Text style={[s.th, s.tSec]}>{t('mockres.col_section')}</Text>
              <Text style={[s.th, s.tNum]}>{t('mockres.col_score')}</Text>
              <Text style={[s.th, s.tNum]}>{t('mockres.col_min')}</Text>
              {secStat ? <Text style={[s.th, s.tNum]}>{t('mockres.col_hensachi')}</Text> : null}
              {rel ? <Text style={[s.th, s.tNum]}>{t('mockres.col_top')}</Text> : null}
            </View>
            {est.sections.map((sec) => {
              const relKey = sec.key === 'gengo_dokkai' ? 'gengo' : sec.key;
              const st = secStat ? secStat[relKey as OfficialSecKey] : null;
              const hh = st ? hensachi(sec.score, st.mean, st.sd) : null;
              const tp = relByKey[relKey];
              return (
                <View key={sec.key} style={s.trow}>
                  <Text style={[s.td, s.tSec]} numberOfLines={1}>{t(BLOCK_LABEL[sec.key] ?? sec.key)}</Text>
                  <Text style={[s.td, s.tNum, sec.below && { color: c.red, fontWeight: '800' }]}>{sec.score}/{sec.max}</Text>
                  <Text style={[s.td, s.tNum, s.tMute]}>{sec.min}</Text>
                  {secStat ? <Text style={[s.td, s.tNum]}>{hh ?? '—'}</Text> : null}
                  {rel ? <Text style={[s.td, s.tNum, s.tMute]}>{tp != null ? `${Math.round(tp)}%` : '—'}</Text> : null}
                </View>
              );
            })}
            <Text style={s.cardCap}>{t('mock.pred_note')}</Text>
          </View>

          {/* 予想得点の推移 */}
          <View style={s.card}>
            <Text style={s.cardH}>{t('mockres.trend_title')}</Text>
            {trend.length >= 2 ? <Trend points={trend} passTotal={est.passTotal} width={chartW} c={c} passLabel={t('mockres.passline')} /> : <Text style={s.cardCap}>{t('mockres.trend_none')}</Text>}
          </View>

          {/* 注記＋出典 */}
          {official ? (
            <>
              <Text style={s.note}>{t('mockres.note', { base: OFFICIAL_BASE_LABEL })}</Text>
              <Text style={s.source}>{t('mockres.source', { src: OFFICIAL_SOURCE })}</Text>
            </>
          ) : null}

          <Pressable style={s.ghost} onPress={() => nav.goBack()}><Text style={s.ghostT}>{t('mock.close')}</Text></Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    topTitle: { fontSize: ty.h2, fontWeight: '900', color: c.ink },
    scroll: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },

    hero: { backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: c.line, marginBottom: spacing.md },
    heroTop: { flexDirection: 'row', alignItems: 'flex-start' },
    heroCap: { fontSize: ty.small, color: c.mute, fontWeight: '700' },
    heroScore: { fontSize: 40, fontWeight: '900', color: c.ink, fontVariant: ['tabular-nums'], marginTop: 2 },
    heroMax: { fontSize: ty.body, fontWeight: '800', color: c.faint },
    judgeBadge: { alignSelf: 'flex-start', borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 3, marginTop: 6 },
    judgeBadgeT: { color: '#fff', fontWeight: '900', fontSize: ty.body },
    heroFrac: { fontSize: ty.small, color: c.mute, marginTop: 8, fontVariant: ['tabular-nums'] },
    gradeWrap: { alignItems: 'center', marginLeft: spacing.sm },
    gradeCap: { fontSize: ty.small, color: c.mute, fontWeight: '700' },
    gradeLetter: { fontSize: 56, fontWeight: '900', lineHeight: 60 },
    heroStats: { flexDirection: 'row', marginTop: spacing.md, borderTopWidth: 1, borderTopColor: c.line, paddingTop: spacing.sm },
    hstat: { flex: 1, alignItems: 'center' },
    hstatV: { fontSize: ty.h2, fontWeight: '900', color: c.ink, fontVariant: ['tabular-nums'] },
    hstatL: { fontSize: 10, color: c.mute, marginTop: 2, fontWeight: '700' },
    belowWarn: { marginTop: spacing.sm, fontSize: ty.small, color: c.red, fontWeight: '700', lineHeight: 18 },

    card: { backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: c.line, marginBottom: spacing.md },
    cardH: { fontSize: ty.body, fontWeight: '800', color: c.ink, marginBottom: spacing.sm },
    cardCap: { fontSize: 11, color: c.mute, marginTop: spacing.xs, lineHeight: 16 },

    trow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: c.line },
    th: { fontSize: 11, color: c.mute, fontWeight: '800' },
    td: { fontSize: ty.small, color: c.ink2, fontWeight: '700', fontVariant: ['tabular-nums'] },
    tSec: { flex: 1.6, textAlign: 'left' },
    tNum: { flex: 1, textAlign: 'right' },
    tMute: { color: c.mute, fontWeight: '700' },

    note: { fontSize: 10, color: c.faint, lineHeight: 15, marginTop: spacing.sm },
    source: { fontSize: 10, color: c.faint, marginTop: 2 },
    ghost: { alignItems: 'center', paddingVertical: 14, marginTop: spacing.xs },
    ghostT: { color: c.mute, fontWeight: '800', fontSize: ty.body },
  });
}
