// AIコーチ＝「分析ホーム」。合格の見込み(合格率＋予想得点)・分野別到達度・この7日の成長(証拠つき)・
// 弱点・ゴールまでの見通し・継続/学習量 を1画面に集約。癒し(桜)とは分け、淡々とした分析専用画面。
//  ・データは homeStatus / growthStats の実データ。数値ロジックには触れない(表示のみ)。
import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import Svg, { Path, Circle, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useT } from '../i18n';
import { useAppState } from '../store/store';
import { homeStatus, studyHM } from '../home/homeStatus';
import { weekGain, passGain, passCurve, growthBars } from '../home/growthStats';
import { dayStr, lastNDays } from '../store/state';
import { expectedScoreFor, categoryCoveragePct, categoryCoverageFrac, SECTION_LABEL } from '../store/selectors';
import { dueCount } from '../review/selectReview';
import type { Category } from '../engine/engine';
import RingGauge from '../components/RingGauge';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function AICoachScreen() {
  const c = useColors();
  const t = useT();
  const nav = useNavigation<Nav>();
  const state = useAppState();
  const s = useMemo(() => makeStyles(c), [c]);

  const d = useMemo(() => {
    const now = Date.now();
    const st = homeStatus(state, now);
    const today = dayStr(now);
    const subs = st.subjects;
    const weakest = subs.reduce((a, b) => (b.pct < a.pct ? b : a), subs[0]);
    const strongest = subs.reduce((a, b) => (b.pct > a.pct ? b : a), subs[0]);
    const wg = weekGain(state, today, 7);
    const pg = Math.round(passGain(state, today, 7));
    const curve = passCurve(state, today, 14);
    const bars = growthBars(state, today, 14);
    const learned = bars.length ? bars[bars.length - 1] : 0;
    const { h, m } = studyHM(st.studySeconds);
    const weeks = st.passPct >= 80 ? 0 : pg > 0 ? Math.max(1, Math.ceil((80 - st.passPct) / pg)) : null;
    // 科目別の予想得点＋基準点(合格率が予想得点より低い理由=科目落ちの可視化)。
    let score: ReturnType<typeof expectedScoreFor> | null = null;
    try { score = expectedScoreFor(state, now); } catch { score = null; }
    // 復習待ち(忘れかけ)の面数=面別マスタリーの due 数。
    const due = state.mastery ? dueCount(state.mastery, now) : 0;
    // 学習量の推移: 累積「覚えた語」の日次差分=その日の新規習得数(15点→14本のバー)。
    const cum = growthBars(state, today, 15);
    const daily = cum.slice(1).map((v, i) => Math.max(0, v - cum[i]));
    // カバー率(学んだ範囲の割合): 4区分ごとの習得済み/全項目。正答率(質)と別の「量」の指標。
    const RING_CATS: Category[] = ['moji_goi', 'bunpou', 'dokkai', 'choukai'];
    const CAT_LABEL: Record<string, string> = { moji_goi: 'home.cat_moji_goi', bunpou: 'home.cat_bunpou', dokkai: 'home.cat_dokkai', choukai: 'home.cat_choukai' };
    const coverage = RING_CATS.map((cat) => ({ cat, labelKey: CAT_LABEL[cat], pct: categoryCoveragePct(state, now, cat), ...categoryCoverageFrac(state, now, cat) }));
    // 継続(継続カードから統合): 連続/最長/フリーズ＋直近7/28日の学習ドット。
    const streak = state.streak;
    const week = lastNDays(today, 7);
    const month = lastNDays(today, 28);
    const studied = new Set(streak.history);
    return { st, subs, weakest, strongest, wg, pg, curve, learned, h, m, weeks, score, due, daily, coverage, streak, week, month, studied, today };
  }, [state]);

  const { st } = d;
  const levelLabel = (state.settings.targetExam ?? 'jlpt') === 'jft' ? 'JFT' : state.settings.level;
  // 合格率(passPct)はユーザー指定で非表示(計算は残す=あとで復活可)。表示は予想得点＋科目別基準点に集約。
  const scorePct = st.predMax > 0 ? Math.round((st.predScore / st.predMax) * 100) : 0;
  const goalPct = st.predMax > 0 ? Math.round((st.passTotal / st.predMax) * 100) : 50;
  // 予想得点=主役。合格ラインに届いていれば緑・未満は橙。
  const scoreColor = st.predScore >= st.passTotal && st.passTotal > 0 ? c.green : c.amber;
  const startLearn = () => { nav.goBack(); nav.navigate('Quiz', { review: true }); };

  const cat = t(d.weakest.labelKey);

  return (
    <SafeAreaView style={s.c} edges={['top', 'bottom']}>
      {/* ヘッダー */}
      <View style={s.head}>
        <View style={s.brand}>
          <View style={s.sigil}><Ionicons name="sparkles" size={15} color="#fff" /></View>
          <View>
            <Text style={s.brandT}>{t('home.ai_title')}</Text>
          </View>
        </View>
        <Pressable onPress={() => nav.goBack()} hitSlop={12}><Ionicons name="close" size={24} color={c.mute} /></Pressable>
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        {/* ① 合格の見込み(ヒーロー)。淡いグラデ地に予想得点リングを主役で置く。 */}
        <View style={s.hero}>
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
            <Defs>
              <LinearGradient id="aiHeroBg" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={c.blueLight} stopOpacity={1} />
                <Stop offset="1" stopColor={c.surface} stopOpacity={1} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#aiHeroBg)" />
          </Svg>
          <View style={s.heroInner}>
            <View style={s.heroEyebrow}>
              <Text style={s.heroEyebrowT}>合格の見込み</Text>
            </View>
            {/* 主役=予想得点リング。中央にレベル(N4など)＋予想得点。｜印=合格ライン。 */}
            <View style={s.heroCenter}>
              <RingGauge value={scorePct} color={scoreColor} size={150} stroke={13} mark={goalPct}>
                <View style={[s.ringLevel, { backgroundColor: scoreColor }]}><Text style={s.ringLevelT}>{levelLabel}</Text></View>
                <Text style={[s.ringBig, { color: scoreColor }]}>{st.predScore}<Text style={s.ringPct}>/{st.predMax}</Text></Text>
                <Text style={s.ringCap}>予想得点</Text>
              </RingGauge>
              <Text style={s.mNote}>合格ライン {st.passTotal}点（リングの｜印）</Text>
            </View>
            {/* 科目別の予想得点＋基準点(合否の見通し=合格率の代わりにここで示す) */}
            {d.score && d.score.sections.length > 0 && (
              <View style={s.scoreList}>
                {d.score.sections.map((sec) => {
                  const cleared = sec.score >= sec.minPoint;
                  const col = cleared ? c.green : c.red;
                  const fillW = sec.max > 0 ? Math.min(100, Math.round((100 * sec.score) / sec.max)) : 0;
                  const markW = sec.max > 0 ? Math.min(100, Math.round((100 * sec.minPoint) / sec.max)) : 0;
                  return (
                    <View key={sec.key} style={[s.scoreItem, !cleared && { borderColor: c.red + '55', backgroundColor: c.red + '11' }]}>
                      <View style={s.scoreHead}>
                        <Text style={s.scoreLabel}>{SECTION_LABEL[sec.key] ?? sec.key}</Text>
                        <Text style={[s.scoreStatus, { color: col }]}>{cleared ? 'クリア✓' : `基準点まであと${sec.minPoint - sec.score}点`}</Text>
                      </View>
                      <View style={s.scoreBar}>
                        <View style={[s.scoreBarFill, { width: `${fillW}%`, backgroundColor: col }]} />
                        <View style={[s.scoreMk, { left: `${markW}%` }]} />
                      </View>
                      <Text style={s.scoreSub}>予想 <Text style={s.scoreSubEm}>{sec.score}</Text> / {sec.max}点（基準点 {sec.minPoint}点 ＝ ｜印）</Text>
                    </View>
                  );
                })}
              </View>
            )}
            <Text style={s.diff}>💡 予想得点＝取れそうな点。1科目でも基準点（各科目の最低ライン）を割ると不合格です。赤い科目を最優先で。</Text>
          </View>
        </View>

        {/* ② 分野別の到達度 */}
        <View style={s.card}>
          <SecLabel c={c} s={s} text="分野別の正解率" />
          <View style={s.facets}>
            {d.subs.map((sub) => (
              <RingGauge key={sub.key} value={sub.pct} color={sub.color} size={52} stroke={6} label={t(sub.labelKey)} />
            ))}
          </View>
        </View>

        {/* ③ カバー率(学んだ範囲=量)。習得/全体の分数＋%。分野別正解率の直下。 */}
        <View style={s.card}>
          <SecLabel c={c} s={s} text="カバー率（学んだ範囲）" />
          <View style={s.covList}>
            {d.coverage.map((cv) => {
              const pct = cv.pct ?? 0;
              return (
                <View key={cv.cat} style={s.covRow}>
                  <Text style={s.covLabel}>{t(cv.labelKey)}</Text>
                  <View style={s.covBar}><View style={[s.covBarFill, { width: `${pct}%`, backgroundColor: c.blue }]} /></View>
                  <Text style={s.covFrac}>{cv.total > 0 ? `${cv.learned}/${cv.total}` : '—'}</Text>
                  <Text style={s.covPct}>{cv.pct === null ? '—' : `${pct}%`}</Text>
                </View>
              );
            })}
          </View>
          <Text style={s.diff}>💡 分数＝覚えた数／全部の数。「どれだけ広く学んだか（量）」の目安で、正解率（質）とは別の指標です。</Text>
        </View>

        {/* ④ 復習の待ち(忘れかけ) */}
        <View style={s.card}>
          <SecLabel c={c} s={s} text="復習の待ち（忘れかけ）" />
          <View style={s.dueRow}>
            <Text style={[s.dueBig, { color: d.due > 0 ? c.amber : c.green }]}>{d.due}<Text style={s.dueUnit}>語</Text></Text>
            <Text style={s.dueNote}>{d.due > 0 ? '復習のタイミングが来た語です。今日はここから始めると、忘れる前に定着します。' : 'いまは忘れかけなし。よく復習できています。'}</Text>
          </View>
        </View>

        {/* ⑤ 今日のおすすめ問題(主導線) */}
        <Pressable style={({ pressed }) => [s.cta, pressed && { opacity: 0.9 }]} onPress={startLearn}>
          <Ionicons name="sparkles" size={16} color="#fff" />
          <Text style={s.ctaT}>{t('home.cta_title')}</Text>
        </Pressable>

        {/* ⑥ この7日の成長(合格率は非表示。覚えた語・予想得点・伸びた分野で示す) */}
        <View style={s.card}>
          <SecLabel c={c} s={s} text="この7日の成長" />
          <View style={s.growthRow}>
            <Stat s={s} tt="覚えた語" v={`+${d.wg}`} unit="語" up={d.wg > 0} c={c} />
            <Stat s={s} tt="予想得点" v={`${st.predScore}`} unit={`/${st.predMax}`} up={false} c={c} />
            <Stat s={s} tt="伸びた分野" v={t(d.strongest.labelKey)} unit="" up={false} c={c} color={d.strongest.color} />
          </View>
        </View>

        {/* いちばんの弱点 */}
        <View style={[s.card, s.weakCard]}>
          <View style={[s.chip, { backgroundColor: c.red + '22', borderColor: c.red + '55' }]}><Text style={[s.chipT, { color: c.red }]}>弱点</Text></View>
          <Text style={s.weakT}>いちばんの伸びしろは <Text style={{ color: c.red, fontWeight: '800' }}>{cat}（{d.weakest.pct}%）</Text>。ここを上げると予想得点が大きく動きます。</Text>
        </View>

        {/* ⑧ ゴールまでの見通し(合格率は非表示。予想得点と合格ラインで示す) */}
        <View style={s.card}>
          <SecLabel c={c} s={s} text="ゴールまでの見通し" />
          {st.predScore >= st.passTotal && st.passTotal > 0 ? (
            <Text style={s.goalT}>いまの予想得点は合格ラインを超えています。この力を保ち、弱点を仕上げれば安心です。</Text>
          ) : d.weeks != null ? (
            <Text style={s.goalT}>このペースなら <Text style={s.goalEm}>約{d.weeks}週間</Text> で合格圏に届く見込みです。</Text>
          ) : (
            <Text style={s.goalT}>学習を続けると、合格までの見通し（あと何週間か）がここに出ます。</Text>
          )}
          <View style={s.goalbar}>
            <View style={[s.goalbarFill, { width: `${Math.min(100, scorePct)}%`, backgroundColor: c.green }]} />
            <View style={[s.goalMk, { left: `${goalPct}%` }]} />
          </View>
          <View style={s.goalScale}><Text style={s.goalScaleT}>予想 {st.predScore}点</Text><Text style={s.goalScaleT}>合格ライン {st.passTotal}点</Text></View>
        </View>

        {/* ⑦ 学習量の推移(覚えた語/日・直近14日) */}
        <View style={s.card}>
          <SecLabel c={c} s={s} text="学習量（覚えた語/日・直近14日）" />
          <BarChart s={s} c={c} data={d.daily} />
          <Text style={s.barCap}>直近14日で ＋{d.daily.reduce((a, b) => a + b, 0)}語</Text>
        </View>

        {/* ⑥ 継続・学習量 */}
        <View style={s.strip}>
          <StripCell s={s} n={`${d.st.streakDays}`} unit="日" tt="連続学習" c={c} />
          <StripCell s={s} n={`${d.h}`} unit={`時間${d.m}分`} tt="学習時間" c={c} border />
          <StripCell s={s} n={`${d.learned}`} unit="語" tt="覚えた語 合計" c={c} />
        </View>

        {/* ⑥-b 継続カレンダー(継続カードを統合: 最長・フリーズ＋直近7日/28日の学習ドット) */}
        <View style={s.card}>
          <SecLabel c={c} s={s} text="継続カレンダー" />
          <Text style={s.calMeta}>最長 <Text style={s.calMetaEm}>{d.streak.longest}日</Text>　　❄️ フリーズ {d.streak.freezes}</Text>
          <View style={s.week}>
            {d.week.map((day) => <View key={day} style={[s.wdot, d.studied.has(day) && { backgroundColor: c.amber, borderColor: c.amber }, day === d.today && { borderWidth: 2, borderColor: c.ink }]} />)}
          </View>
          <View style={s.heat}>
            {d.month.map((day) => <View key={day} style={[s.hdot, d.studied.has(day) && { backgroundColor: c.amber, borderColor: c.amber }, day === d.today && { borderWidth: 1.5, borderColor: c.ink }]} />)}
          </View>
        </View>

        {/* コーチの一言(締め) */}
        <View style={s.voice}>
          <View style={s.voiceB}><Text style={s.voiceBt}>◇</Text></View>
          <Text style={s.voiceT}>着実に前進しています。今日は「{cat}」を少し。弱点がひとつ埋まるたび、予想得点は面白いほど動きます。</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SecLabel({ c, s, text }: { c: ThemeColors; s: Styles; text: string }) {
  return (
    <View style={s.secLabel}>
      <View style={[s.tick, { backgroundColor: c.blue }]} />
      <Text style={s.secLabelT}>{text}</Text>
    </View>
  );
}

function Stat({ s, tt, v, unit, up, c, color }: { s: Styles; tt: string; v: string; unit: string; up: boolean; c: ThemeColors; color?: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statT}>{tt}</Text>
      <View style={s.statN}>
        <Text style={[s.statV, up && { color: c.green }, color ? { color, fontSize: ty.body } : null]}>{v}</Text>
        {!!unit && <Text style={s.statU}>{unit}</Text>}
      </View>
    </View>
  );
}

function BarChart({ s, c, data }: { s: Styles; c: ThemeColors; data: number[] }) {
  const W = 320, H = 64, gap = 3;
  const n = Math.max(1, data.length);
  const bw = (W - gap * (n - 1)) / n;
  const max = Math.max(1, ...data);
  return (
    <View style={s.bars}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {data.map((v, i) => {
          const h = v > 0 ? Math.max(2, (v / max) * (H - 4)) : 0;
          return <Rect key={i} x={i * (bw + gap)} y={H - h} width={bw} height={h} rx={1.5} fill={c.blue} opacity={v > 0 ? 0.85 : 0.16} />;
        })}
      </Svg>
    </View>
  );
}

function StripCell({ s, n, unit, tt, c, border }: { s: Styles; n: string; unit: string; tt: string; c: ThemeColors; border?: boolean }) {
  return (
    <View style={[s.stripCell, border && { borderLeftWidth: 1, borderRightWidth: 1, borderColor: c.line }]}>
      <Text style={s.stripN}>{n}<Text style={s.stripU}>{unit}</Text></Text>
      <Text style={s.stripT}>{tt}</Text>
    </View>
  );
}

type Styles = ReturnType<typeof makeStyles>;
const makeStyles = (c: ThemeColors) => StyleSheet.create({
  c: { flex: 1, backgroundColor: c.bg },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  sigil: { width: 30, height: 30, borderRadius: 9, backgroundColor: c.blue, alignItems: 'center', justifyContent: 'center' },
  brandT: { fontSize: 15.5, fontWeight: '800', color: c.ink },
  brandS: { fontSize: 10.5, color: c.faint, fontWeight: '600', marginTop: 1 },
  body: { padding: spacing.lg, paddingTop: spacing.xs, gap: spacing.sm },

  secLabel: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: spacing.sm },
  tick: { width: 5, height: 14, borderRadius: 3 },
  secLabelT: { fontSize: 11, letterSpacing: 1.4, color: c.ink2, fontWeight: '800' },

  hero: { borderWidth: 1, borderColor: c.line, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: c.blueLight, ...shadow1(c) },
  heroInner: { padding: spacing.md },
  heroCenter: { alignItems: 'center', gap: 6, marginBottom: spacing.sm },
  ringLevel: { paddingHorizontal: 7, paddingVertical: 1, borderRadius: 5, marginBottom: 3 },
  ringLevelT: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  heroEyebrow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm },
  heroBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  heroBadgeT: { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  heroEyebrowT: { fontSize: 11, letterSpacing: 1.4, color: c.ink2, fontWeight: '800' },
  passChip: { alignSelf: 'stretch', backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: radius.md, paddingVertical: 9, paddingHorizontal: 12 },
  passChipLbl: { fontSize: 10.5, color: c.ink2, fontWeight: '700' },
  passChipV: { fontSize: 26, fontWeight: '900', marginTop: 1, fontVariant: ['tabular-nums'] },
  passChipU: { fontSize: 12, color: c.faint, fontWeight: '700' },
  passChipSub: { fontSize: 9.5, color: c.faint, fontWeight: '600', marginTop: 1 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  ringBig: { fontSize: 30, fontWeight: '900', fontVariant: ['tabular-nums'] },
  ringPct: { fontSize: 13, fontWeight: '800' },
  ringCap: { fontSize: 10.5, color: c.mute, fontWeight: '700', marginTop: 2 },
  subMetric: { borderTopWidth: 1, borderTopColor: c.line, paddingTop: spacing.sm },
  subMetricT: { fontSize: 10.5, color: c.ink2, fontWeight: '700' },
  subMetricV: { fontSize: 17, fontWeight: '900', marginTop: 1, fontVariant: ['tabular-nums'] },
  subMetricU: { fontSize: 11, color: c.faint, fontWeight: '600' },
  heroSide: { flex: 1, gap: spacing.sm },
  mK: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  mKt: { fontSize: 11, color: c.ink2, fontWeight: '700' },
  mV: { fontSize: 22, fontWeight: '900', color: c.ink, marginTop: 2, fontVariant: ['tabular-nums'] },
  mVs: { fontSize: 12, color: c.faint, fontWeight: '600' },
  mNote: { fontSize: 10.5, color: c.faint, marginTop: 3, fontWeight: '600' },
  passbar: { height: 6, borderRadius: 6, backgroundColor: c.bgSoft, marginTop: 6, position: 'relative', overflow: 'hidden' },
  passbarFill: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: 6 },
  passbarGoal: { position: 'absolute', top: -2, bottom: -2, width: 2, backgroundColor: c.ink2, borderRadius: 2 },
  diff: { fontSize: 10.5, color: c.faint, marginTop: spacing.sm, lineHeight: 15, textAlign: 'center' },

  card: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: radius.lg, padding: spacing.md, ...shadow1(c) },
  facets: { flexDirection: 'row', justifyContent: 'space-between' },

  // 科目別の予想得点＋基準点
  scoreList: { gap: spacing.xs },
  scoreItem: { backgroundColor: c.bgSoft, borderWidth: 1, borderColor: c.line, borderRadius: radius.md, paddingVertical: 9, paddingHorizontal: 10, gap: 6 },
  scoreHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  scoreLabel: { fontSize: 12.5, fontWeight: '800', color: c.ink },
  scoreStatus: { fontSize: 11.5, fontWeight: '800' },
  scoreBar: { height: 7, borderRadius: 7, backgroundColor: c.surface, position: 'relative', overflow: 'hidden', borderWidth: 1, borderColor: c.line },
  scoreBarFill: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: 7 },
  scoreMk: { position: 'absolute', top: -3, bottom: -3, width: 2, backgroundColor: c.ink2 },
  scoreSub: { fontSize: 10.5, color: c.faint, fontWeight: '600' },
  scoreSubEm: { fontSize: 12, color: c.ink, fontWeight: '900' },

  // カバー率(量)
  covList: { gap: spacing.xs },
  covRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  covLabel: { width: 58, fontSize: 11.5, color: c.ink2, fontWeight: '700' },
  covFrac: { minWidth: 52, textAlign: 'right', fontSize: 11, color: c.mute, fontWeight: '700', fontVariant: ['tabular-nums'] },
  covBar: { flex: 1, height: 8, borderRadius: 8, backgroundColor: c.bgSoft, overflow: 'hidden' },
  covBarFill: { height: '100%', borderRadius: 8 },
  covPct: { width: 40, textAlign: 'right', fontSize: 12, fontWeight: '800', color: c.ink, fontVariant: ['tabular-nums'] },

  // 復習の待ち
  dueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dueBig: { fontSize: 40, fontWeight: '900', fontVariant: ['tabular-nums'] },
  dueUnit: { fontSize: 15, fontWeight: '800' },
  dueNote: { flex: 1, fontSize: 12, color: c.ink2, lineHeight: 18, fontWeight: '600' },

  // 学習量の推移
  bars: { marginTop: 2 },
  barCap: { fontSize: 10.5, color: c.faint, fontWeight: '700', marginTop: 6, textAlign: 'right' },

  growthRow: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, backgroundColor: c.bgSoft, borderWidth: 1, borderColor: c.line, borderRadius: radius.md, paddingVertical: 9, paddingHorizontal: 10 },
  statT: { fontSize: 10.5, color: c.ink2, fontWeight: '700' },
  statN: { flexDirection: 'row', alignItems: 'baseline', gap: 3, marginTop: 3 },
  statV: { fontSize: 21, fontWeight: '900', color: c.ink, fontVariant: ['tabular-nums'] },
  statU: { fontSize: 11, color: c.faint, fontWeight: '600' },
  spark: { marginTop: spacing.md },
  sparkCap: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  sparkCapT: { fontSize: 10, color: c.faint, fontWeight: '700', letterSpacing: 0.5 },
  sparkEnd: { fontSize: 10, fontWeight: '800' },

  weakCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chip: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1 },
  chipT: { fontSize: 11, fontWeight: '800' },
  weakT: { flex: 1, fontSize: 12.5, color: c.ink, lineHeight: 19 },

  goalT: { fontSize: 12.5, color: c.ink, lineHeight: 20, marginBottom: spacing.sm },
  goalEm: { color: c.green, fontWeight: '800' },
  goalbar: { height: 8, borderRadius: 8, backgroundColor: c.bgSoft, position: 'relative', overflow: 'hidden' },
  goalbarFill: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: 8 },
  goalMk: { position: 'absolute', top: -3, bottom: -3, width: 2, backgroundColor: c.ink2 },
  goalScale: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  goalScaleT: { fontSize: 9.5, color: c.faint, fontWeight: '700' },

  strip: { flexDirection: 'row', backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: radius.lg, overflow: 'hidden', ...shadow1(c) },
  stripCell: { flex: 1, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center' },
  stripN: { fontSize: 19, fontWeight: '900', color: c.ink, fontVariant: ['tabular-nums'] },
  stripU: { fontSize: 11, color: c.faint, fontWeight: '600' },
  stripT: { fontSize: 10, color: c.ink2, fontWeight: '700', marginTop: 5 },

  // 継続カレンダー(継続カードから統合)
  calMeta: { fontSize: 11.5, color: c.ink2, fontWeight: '700', marginBottom: spacing.sm },
  calMetaEm: { color: c.ink, fontWeight: '900' },
  week: { flexDirection: 'row', gap: 6, marginBottom: spacing.sm },
  wdot: { flex: 1, height: 16, borderRadius: 5, backgroundColor: c.bgSoft, borderWidth: 1, borderColor: c.line },
  heat: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  hdot: { width: 12, height: 12, borderRadius: 3, backgroundColor: c.bgSoft, borderWidth: 1, borderColor: c.line },

  voice: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: c.blueLight, borderWidth: 1, borderColor: c.blue + '3a', borderLeftWidth: 3, borderLeftColor: c.blue, borderRadius: radius.md, padding: spacing.sm },
  voiceB: { width: 22, height: 22, borderRadius: 7, backgroundColor: c.blue, alignItems: 'center', justifyContent: 'center' },
  voiceBt: { color: '#fff', fontSize: 12, fontWeight: '900' },
  voiceT: { flex: 1, fontSize: 12.5, color: c.ink, lineHeight: 19 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: c.blue, borderRadius: radius.md, paddingVertical: 14, marginTop: 2 },
  ctaT: { color: '#fff', fontSize: 15, fontWeight: '800' },
});

function shadow1(c: ThemeColors) {
  return { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 } as const;
}
