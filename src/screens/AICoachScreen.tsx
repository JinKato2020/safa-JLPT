// AIコーチ＝「分析ホーム」。合格の見込み(合格率＋予想得点)・分野別到達度・この7日の成長(証拠つき)・
// 弱点・ゴールまでの見通し・継続/学習量 を1画面に集約。癒し(桜)とは分け、淡々とした分析専用画面。
//  ・データは homeStatus / growthStats の実データ。数値ロジックには触れない(表示のみ)。
import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Image } from 'react-native';
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
import { expectedScoreFor, coverageBars } from '../store/selectors';
import { dueCount } from '../review/selectReview';
import { avatarOf } from '../plaza/avatars';
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
    // カバー率(覚えた数)=書庫の3辞書(漢字/語彙/文法)の当該レベル総数を分母にする。
    // 読解・聴解はスキル(般化)で「語数」ではないため、覚えた数/カバー率の分母には含めない(単語タブの3カードと一致)。
    const CAT_LABEL: Record<string, string> = { kanji: 'cards.kanji', vocab: 'cards.vocab', grammar: 'cards.grammar' };
    const coverage = coverageBars(state, now).map((b) => ({
      cat: b.key,
      labelKey: CAT_LABEL[b.key],
      pct: b.total > 0 ? Math.round((100 * b.learned) / b.total) : 0,
      learned: b.learned,
      total: b.total,
    }));
    // カバー率は「覚えた数」を主役に。総数＋次の目標(10語区切りで最短に届く区分)。
    const covLearned = coverage.reduce((a, b) => a + (b.learned || 0), 0);
    const covTotalAll = coverage.reduce((a, b) => a + (b.total || 0), 0);
    let nextGoal: { labelKey: string; goal: number; remain: number } | null = null;
    for (const cv of coverage) {
      if (!cv.total || cv.learned >= cv.total) continue;
      const goal = Math.min(cv.total, Math.floor(cv.learned / 10) * 10 + 10);
      const remain = goal - cv.learned;
      if (!nextGoal || remain < nextGoal.remain) nextGoal = { labelKey: cv.labelKey, goal, remain };
    }
    // 継続(継続カードから統合): 連続/最長/フリーズ＋直近7/28日の学習ドット。
    const streak = state.streak;
    const week = lastNDays(today, 7);
    const month = lastNDays(today, 28);
    const studied = new Set(streak.history);
    // 模試の記録(実戦の予想得点): フル模試で予想得点を保存した回だけ。最新＋前回＋直近8回の推移。
    const scoredMocks = (state.mockHistory ?? []).filter((mk) => mk.full && typeof mk.predScore === 'number');
    const latestMock = scoredMocks.length ? scoredMocks[scoredMocks.length - 1] : null;
    const prevMock = scoredMocks.length > 1 ? scoredMocks[scoredMocks.length - 2] : null;
    const mockTrend = scoredMocks.slice(-8).map((mk) => ({ day: mk.day, score: mk.predScore as number, max: mk.predMax ?? 180 }));
    return { st, subs, weakest, strongest, wg, pg, curve, learned, h, m, weeks, score, due, daily, coverage, covLearned, covTotalAll, nextGoal, streak, week, month, studied, today, latestMock, prevMock, mockTrend };
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
  const strong = t(d.strongest.labelKey);
  // コーチの締めの一言。実データ(この7日の伸び・予想得点[点]・弱点・得意)を織り込んだ長めの励まし。
  //  指標は現行の「予想得点＝点（満点/合格ライン）」に統一。％や「あと◯語で◯語まで」の旧指標は使わない。
  const cleared = st.predScore >= st.passTotal && st.passTotal > 0;
  const coachMsg =
    (d.wg > 0 ? t('coach.msg_grew', { n: d.wg }) : t('coach.msg_steady')) +
    (cleared
      ? t('coach.msg_pred_over', { score: st.predScore, max: st.predMax, pass: st.passTotal })
      : t('coach.msg_pred_under', { score: st.predScore, pass: st.passTotal })) +
    t('coach.msg_weak', { cat }) +
    t('coach.msg_close', { strong, cat });
  // 予想得点リングの左横に出す自分のアバター(立ち絵)。未選択時は出さない。
  const myAvatar = avatarOf(state.settings.avatar).image;

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
              <Text style={s.heroEyebrowT}>{t('coach.hero_eyebrow')}</Text>
            </View>
            {/* 主役=予想得点リング。左横に自分のアバター(オンボードで選択)。中央にレベル(N4など)＋予想得点。｜印=合格ライン。 */}
            <View style={s.heroCenter}>
              <View style={s.heroRingRow}>
                {myAvatar != null && <Image source={myAvatar} style={s.heroAvatar} resizeMode="contain" />}
                <RingGauge value={scorePct} color={scoreColor} size={150} stroke={13} mark={goalPct}>
                  <View style={[s.ringLevel, { backgroundColor: scoreColor }]}><Text style={s.ringLevelT}>{levelLabel}</Text></View>
                  <Text style={[s.ringBig, { color: scoreColor }]}>{st.predScore}<Text style={s.ringPct}>/{st.predMax}</Text></Text>
                  <Text style={s.ringCap}>{t('coach.pred_score')}</Text>
                </RingGauge>
              </View>
              <Text style={s.mNote}>{t('coach.pass_line_ring', { n: st.passTotal })}</Text>
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
                        <Text style={s.scoreLabel}>{t('mock.block_' + sec.key)}</Text>
                        <Text style={[s.scoreStatus, { color: col }]}>{cleared ? t('coach.sec_cleared') : t('coach.sec_need', { n: sec.minPoint - sec.score })}</Text>
                      </View>
                      <View style={s.scoreBar}>
                        <View style={[s.scoreBarFill, { width: `${fillW}%`, backgroundColor: col }]} />
                        <View style={[s.scoreMk, { left: `${markW}%` }]} />
                      </View>
                      <Text style={s.scoreSub}>{t('coach.sec_sub', { score: sec.score, max: sec.max, min: sec.minPoint })}</Text>
                    </View>
                  );
                })}
              </View>
            )}
            <Text style={s.diff}>{t('coach.hero_note')}</Text>
          </View>
        </View>

        {/* ② 分野別の到達度 */}
        <View style={s.card}>
          <SecLabel c={c} s={s} text={t('coach.facet_title')} />
          <View style={s.facets}>
            {d.subs.map((sub) => (
              <RingGauge key={sub.key} value={sub.pct} color={sub.color} size={52} stroke={6} label={t(sub.labelKey)} />
            ))}
          </View>
        </View>

        {/* ③ カバー率 — 語数(覚えた数)を主役＋小さな目標(次の10語)。%は補足。分野別正解率の直下。 */}
        <View style={s.card}>
          <SecLabel c={c} s={s} text={t('coach.cov_title')} />
          {/* 主役=覚えた総数 */}
          <View style={s.covHero}>
            <View style={s.covHeroLeft}>
              <Text style={s.covHeroN}>{d.covLearned}<Text style={s.covHeroSub}> / {d.covTotalAll}</Text></Text>
              <Text style={s.covHeroLbl}>{t('coach.cov_learned')}</Text>
            </View>
            <Text style={s.covHeroPct}>{d.covTotalAll > 0 ? Math.round((100 * d.covLearned) / d.covTotalAll) : 0}%</Text>
          </View>
          <View style={s.covList}>
            {d.coverage.map((cv) => {
              const pct = cv.pct ?? 0;
              return (
                <View key={cv.cat} style={s.covRow}>
                  <Text style={s.covLabel}>{t(cv.labelKey)}</Text>
                  <View style={s.covBar}><View style={[s.covBarFill, { width: `${pct}%`, backgroundColor: c.blue }]} /></View>
                  <Text style={s.covFrac}>{cv.total > 0 ? `${cv.learned}/${cv.total}` : '—'}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* ④ 復習の待ち(忘れかけ) */}
        <View style={s.card}>
          <SecLabel c={c} s={s} text={t('coach.due_title')} />
          <View style={s.dueRow}>
            <Text style={[s.dueBig, { color: d.due > 0 ? c.amber : c.green }]}>{d.due}<Text style={s.dueUnit}>{t('coach.due_unit')}</Text></Text>
            <Text style={s.dueNote}>{d.due > 0 ? t('coach.due_has') : t('coach.due_none')}</Text>
          </View>
        </View>

        {/* ⑤ 苦手な単語に挑戦(主導線)。練習画面のボタンと同じ文言(cards.reco)を使う。 */}
        <Pressable style={({ pressed }) => [s.cta, pressed && { opacity: 0.9 }]} onPress={startLearn}>
          <Ionicons name="sparkles" size={16} color="#fff" />
          <Text style={s.ctaT}>{t('cards.reco')}</Text>
        </Pressable>

        {/* ⑥ この7日の成長(合格率は非表示。覚えた語・予想得点・伸びた分野で示す) */}
        <View style={s.card}>
          <SecLabel c={c} s={s} text={t('coach.week_title')} />
          <View style={s.growthRow}>
            <Stat s={s} tt={t('coach.stat_learned')} v={`+${d.wg}`} unit={t('coach.due_unit')} up={d.wg > 0} c={c} />
            <Stat s={s} tt={t('coach.pred_score')} v={`${st.predScore}`} unit={`/${st.predMax}`} up={false} c={c} />
            <Stat s={s} tt={t('coach.stat_grew')} v={t(d.strongest.labelKey)} unit="" up={false} c={c} color={d.strongest.color} />
          </View>
        </View>

        {/* ⑥' 模試の記録(実戦の予想得点)。この7日の成長のすぐ後に置く。 */}
        <View style={s.card}>
          <SecLabel c={c} s={s} text={t('coach.mock_title')} />
          {d.latestMock ? (
            <>
              <View style={s.mockHero}>
                <View style={{ flex: 1 }}>
                  <Text style={s.mockScore}>{d.latestMock.predScore}<Text style={s.mockScoreMax}>{t('coach.score_of', { n: d.latestMock.predMax ?? 180 })}</Text></Text>
                  <Text style={s.mockMeta}>{t('coach.mock_meta', { n: d.latestMock.passTotal ?? '—', day: d.latestMock.day })}</Text>
                </View>
                {(() => {
                  const pass = (d.latestMock!.predScore ?? 0) >= (d.latestMock!.passTotal ?? Number.MAX_SAFE_INTEGER);
                  return <Text style={[s.mockJudge, { color: pass ? c.green : c.amber, borderColor: (pass ? c.green : c.amber) + '88' }]}>{pass ? t('coach.mock_pass') : t('coach.mock_close')}</Text>;
                })()}
              </View>
              {d.prevMock ? (() => {
                const delta = (d.latestMock!.predScore ?? 0) - (d.prevMock!.predScore ?? 0);
                const deltaStr = delta > 0 ? `▲${delta}` : delta < 0 ? `▼${-delta}` : '±0';
                return <Text style={[s.mockDelta, { color: delta > 0 ? c.green : delta < 0 ? c.red : c.mute }]}>{t('coach.mock_delta', { prev: d.prevMock!.predScore ?? 0, cur: d.latestMock!.predScore ?? 0, delta: deltaStr })}</Text>;
              })() : null}
              {d.latestMock.sections?.length ? (
                <View style={s.mockSecs}>
                  {d.latestMock.sections.map((sec) => {
                    const cleared = sec.score >= sec.min;
                    const col = cleared ? c.green : c.red;
                    const fillW = sec.max > 0 ? Math.min(100, Math.round((100 * sec.score) / sec.max)) : 0;
                    const markW = sec.max > 0 ? Math.min(100, Math.round((100 * sec.min) / sec.max)) : 0;
                    return (
                      <View key={sec.key} style={[s.scoreItem, !cleared && { borderColor: c.red + '55', backgroundColor: c.red + '11' }]}>
                        <View style={s.scoreHead}>
                          <Text style={s.scoreLabel}>{t('mock.block_' + sec.key)}</Text>
                          <Text style={[s.scoreStatus, { color: col }]}>{cleared ? t('coach.sec_cleared') : t('coach.sec_need', { n: sec.min - sec.score })}</Text>
                        </View>
                        <View style={s.scoreBar}>
                          <View style={[s.scoreBarFill, { width: `${fillW}%`, backgroundColor: col }]} />
                          <View style={[s.scoreMk, { left: `${markW}%` }]} />
                        </View>
                        <Text style={s.scoreSub}>{t('coach.sec_sub', { score: sec.score, max: sec.max, min: sec.min })}</Text>
                      </View>
                    );
                  })}
                </View>
              ) : null}
              {d.mockTrend.length > 1 ? (
                <View style={s.mockTrendRow}>
                  {d.mockTrend.map((mt, i) => (
                    <View key={i} style={s.mockTrendItem}>
                      <Text style={[s.mockTrendScore, i === d.mockTrend.length - 1 && { color: c.blue }]}>{mt.score}</Text>
                      <Text style={s.mockTrendDay}>{mt.day.slice(5)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <Text style={s.diff}>{t('coach.mock_note')}</Text>
            </>
          ) : (
            <Pressable style={s.mockEmpty} onPress={() => nav.navigate('Mock', { full: true })}>
              <Text style={s.mockEmptyT}>{t('coach.mock_empty')}</Text>
              <Text style={s.mockEmptyCta}>{t('coach.mock_empty_cta')}</Text>
            </Pressable>
          )}
        </View>

        {/* いちばんの弱点 */}
        <View style={[s.card, s.weakCard]}>
          <View style={[s.chip, { backgroundColor: c.red + '22', borderColor: c.red + '55' }]}><Text style={[s.chipT, { color: c.red }]}>{t('coach.weak_chip')}</Text></View>
          <Text style={s.weakT}>{t('coach.weak_text', { cat, pct: d.weakest.pct })}</Text>
        </View>

        {/* ⑧ ゴールまでの見通し(合格率は非表示。予想得点と合格ラインで示す) */}
        <View style={s.card}>
          <SecLabel c={c} s={s} text={t('coach.goal_title')} />
          {st.predScore >= st.passTotal && st.passTotal > 0 ? (
            <Text style={s.goalT}>{t('coach.goal_cleared')}</Text>
          ) : d.weeks != null ? (
            <Text style={s.goalT}>{t('coach.goal_weeks', { n: d.weeks })}</Text>
          ) : (
            <Text style={s.goalT}>{t('coach.goal_none')}</Text>
          )}
          <View style={s.goalbar}>
            <View style={[s.goalbarFill, { width: `${Math.min(100, scorePct)}%`, backgroundColor: c.green }]} />
            <View style={[s.goalMk, { left: `${goalPct}%` }]} />
          </View>
          <View style={s.goalScale}><Text style={s.goalScaleT}>{t('coach.pts_pred', { n: st.predScore })}</Text><Text style={s.goalScaleT}>{t('coach.pts_pass', { n: st.passTotal })}</Text></View>
        </View>

        {/* ⑦ 学習量の推移(覚えた語/日・直近14日) */}
        <View style={s.card}>
          <SecLabel c={c} s={s} text={t('coach.vol_title')} />
          <BarChart s={s} c={c} data={d.daily} />
          <Text style={s.barCap}>{t('coach.vol_recent', { n: d.daily.reduce((a, b) => a + b, 0) })}</Text>
        </View>

        {/* ⑥ 継続・学習量 */}
        <View style={s.strip}>
          <StripCell s={s} n={`${d.st.streakDays}`} unit={t('coach.unit_days')} tt={t('coach.strip_streak')} c={c} />
          <StripCell s={s} n={`${d.h}`} unit={t('coach.unit_hm', { m: d.m })} tt={t('coach.strip_time')} c={c} border />
          <StripCell s={s} n={`${d.learned}`} unit={t('coach.due_unit')} tt={t('coach.strip_total')} c={c} />
        </View>

        {/* ⑥-b 継続カレンダー(継続カードを統合: 最長・フリーズ＋直近7日/28日の学習ドット) */}
        <View style={s.card}>
          <SecLabel c={c} s={s} text={t('coach.cal_title')} />
          <Text style={s.calMeta}>{t('coach.cal_meta', { n: d.streak.longest, f: d.streak.freezes })}</Text>
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
          <Text style={s.voiceT}>{coachMsg}</Text>
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
  heroRingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  heroAvatar: { width: 140, height: 150, marginLeft: -6 }, // リングの左横。立ち絵。リング(150)より少し小さいくらい。

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
  // 模試の記録カード
  mockHero: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  mockScore: { fontSize: 34, fontWeight: '900', color: c.ink, lineHeight: 38 },
  mockScoreMax: { fontSize: 15, fontWeight: '800', color: c.faint },
  mockMeta: { fontSize: 11.5, color: c.mute, fontWeight: '700', marginTop: 2 },
  mockJudge: { fontSize: 12, fontWeight: '900', borderWidth: 1.5, borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 12, overflow: 'hidden' },
  mockDelta: { fontSize: 12, fontWeight: '800', marginTop: spacing.xs },
  mockSecs: { gap: 8, marginTop: spacing.sm },
  mockTrendRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: c.line },
  mockTrendItem: { alignItems: 'center', flex: 1 },
  mockTrendScore: { fontSize: 13, fontWeight: '800', color: c.ink2, fontVariant: ['tabular-nums'] },
  mockTrendDay: { fontSize: 9, color: c.faint, marginTop: 1 },
  mockEmpty: { alignItems: 'center', gap: 6, paddingVertical: spacing.md },
  mockEmptyT: { fontSize: 12, color: c.mute, textAlign: 'center', lineHeight: 18 },
  mockEmptyCta: { fontSize: 13, fontWeight: '900', color: c.blue },

  // カバー率(覚えた数)
  covHero: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: c.bgSoft, borderWidth: 1, borderColor: c.line, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 12, marginBottom: spacing.sm },
  covHeroLeft: { flexDirection: 'column' },
  covHeroN: { fontSize: 28, fontWeight: '900', color: c.ink, fontVariant: ['tabular-nums'] },
  covHeroSub: { fontSize: 14, fontWeight: '700', color: c.faint },
  covHeroLbl: { fontSize: 10.5, color: c.ink2, fontWeight: '700', marginTop: 1 },
  covHeroPct: { fontSize: 22, fontWeight: '900', color: c.blue, fontVariant: ['tabular-nums'] },
  covGoal: { backgroundColor: c.blueLight, borderRadius: radius.md, paddingVertical: 7, paddingHorizontal: 10, marginBottom: spacing.sm },
  covGoalT: { fontSize: 12, color: c.ink2, fontWeight: '700' },
  covGoalEm: { color: c.blue, fontWeight: '900' },
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
