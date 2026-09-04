// AIコーチ＝「分析ホーム」。合格の見込み(合格率＋予想得点)・分野別到達度・この7日の成長(証拠つき)・
// 弱点・ゴールまでの見通し・継続/学習量 を1画面に集約。癒し(桜)とは分け、淡々とした分析専用画面。
//  ・データは homeStatus / growthStats の実データ。数値ロジックには触れない(表示のみ)。
import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Image, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import Svg, { Path, Circle, Rect, Defs, LinearGradient, Stop, Polygon, Line, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, useColors, type ThemeColors } from '../theme';
import { useT } from '../i18n';
import { useAppState } from '../store/store';
import { homeStatus, studyHM } from '../home/homeStatus';
import { weekGain, passGain, passCurve, growthBars } from '../home/growthStats';
import { dayStr, lastNDays, type MockResult } from '../store/state';
import type { Level } from '../engine/engine';
import { expectedScoreFor, coverageBars, coverageCurve } from '../store/selectors';
import { relativePositionFor, isOfficialLevel } from '../ladder/relativePosition';
import { OFFICIAL_TOTAL_STAT, OFFICIAL_PASS_RATE, OFFICIAL_BASE_LABEL, type OfficialLevel } from '../data/officialStats';
import { dueCount } from '../review/selectReview';
import { avatarOf } from '../plaza/avatars';
import RingGauge from '../components/RingGauge';
import { BellCurve } from '../components/BellCurve';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function AICoachScreen() {
  const c = useColors();
  const t = useT();
  const nav = useNavigation<Nav>();
  const state = useAppState();
  const s = useMemo(() => makeStyles(c), [c]);
  const { width: winW } = useWindowDimensions();
  const chartW = winW - spacing.lg * 2 - spacing.md * 2; // 画面(body:lg)＋カード(md)のパディング分

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
    // 相対的な位置(本番受験者の中で上位何%相当か)。JLPTのみ・公式統計を持つレベルのみ。
    const lv = state.settings.level;
    const isJlpt = (state.settings.targetExam ?? 'jlpt') !== 'jft';
    const rel = isJlpt && score ? relativePositionFor(lv, score.sections, score.score) : null;
    const official = isJlpt && isOfficialLevel(lv)
      ? { mean: OFFICIAL_TOTAL_STAT[lv].mean, passRate: OFFICIAL_PASS_RATE[lv], base: OFFICIAL_BASE_LABEL }
      : null;
    // N4/N5 は公式配点で「言語知識・読解」が合算1区分(N3以上は別区分)。相対位置カードのラベルを合算表記に。
    const relGengoCombined = lv === 'N4' || lv === 'N5';
    // 復習待ち(忘れかけ)の面数=面別マスタリーの due 数。
    const due = state.mastery ? dueCount(state.mastery, now) : 0;
    // 分類別カバー率(覚えた数)の推移=漢字/語彙/文法の3本折れ線(縦=累計語数・横=直近14日)。
    // 旧「学習量の推移」バー(合算・日次)はこの折れ線に統合(線の傾き=その日の増加・高さ=累計)。
    const covCurve = coverageCurve(state, today, 14);
    const firstCov = covCurve[0];
    const lastCov = covCurve[covCurve.length - 1];
    const covGain = Math.max(0, (lastCov.kanji + lastCov.vocab + lastCov.grammar) - (firstCov.kanji + firstCov.vocab + firstCov.grammar));
    // カバー率(覚えた数)=書庫の3辞書(漢字/語彙/文法)の当該レベル総数を分母にする。
    // 読解・聴解はスキル(般化)で「語数」ではないため、覚えた数/カバー率の分母には含めない(単語タブの3カードと一致)。
    // 漢字ID有効化で漢字面が習得を持つため分割(ユーザー確定2026-08-23)＝漢字/語彙/文法の3バー。
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
    const mockTrend = scoredMocks.slice(-8); // フル記録を保持(タップで成績表を開くため)
    return { st, subs, weakest, strongest, wg, pg, curve, learned, h, m, weeks, score, rel, official, relGengoCombined, due, covCurve, covGain, coverage, covLearned, covTotalAll, nextGoal, streak, week, month, studied, today, latestMock, prevMock, mockTrend };
  }, [state]);

  const { st } = d;
  const levelLabel = (state.settings.targetExam ?? 'jlpt') === 'jft' ? 'JFT' : state.settings.level;
  // 合格率(passPct)はユーザー指定で非表示(計算は残す=あとで復活可)。表示は予想得点＋科目別基準点に集約。
  const scorePct = st.predMax > 0 ? Math.round((st.predScore / st.predMax) * 100) : 0;
  const goalPct = st.predMax > 0 ? Math.round((st.passTotal / st.predMax) * 100) : 50;
  // 予想得点=主役。合格ラインに届いていれば緑・未満は橙。
  const scoreColor = st.predScore >= st.passTotal && st.passTotal > 0 ? c.green : c.amber;
  const startLearn = () => { nav.goBack(); nav.navigate('Quiz', { review: true }); };
  // 過去の模試を成績表(MockResultScreen)で開く。区分別実測(byCat)を保存している回のみ・JLPTのみ。
  const isJlptExam = (state.settings.targetExam ?? 'jlpt') !== 'jft';
  const canOpenMock = (mk: MockResult) => isJlptExam && !!mk.byCat && !!mk.level;
  const openMock = (mk: MockResult) => {
    if (!canOpenMock(mk)) return;
    const passed = (mk.predScore ?? 0) >= (mk.passTotal ?? Number.MAX_SAFE_INTEGER) && !(mk.sections ?? []).some((sc) => sc.below);
    nav.navigate('MockResultDetail', { level: mk.level as Level, byCat: mk.byCat!, passed, elapsedMs: mk.elapsedMs ?? 0 });
  };

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
        <View style={s.headRight}>
          {/* 結果カードを画像化して共有(予想得点＋伸び＋紹介コード/QR)。 */}
          <Pressable onPress={() => nav.navigate('ShareCard')} hitSlop={12} accessibilityLabel={t('share.title')}>
            <Ionicons name="share-outline" size={22} color={c.blue} />
          </Pressable>
          <Pressable onPress={() => nav.goBack()} hitSlop={12}><Ionicons name="close" size={24} color={c.mute} /></Pressable>
        </View>
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
            {/* 合格までの見通し(旧「ゴールまでの見通し」カードを統合): 合格圏内 / あと◯週間。 */}
            <Text style={[s.heroGoal, { color: cleared ? c.green : c.ink }]}>
              {cleared ? t('coach.goal_cleared') : d.weeks != null ? t('coach.goal_weeks', { n: d.weeks }) : t('coach.goal_none')}
            </Text>
            <Text style={s.diff}>{t('coach.hero_note')}</Text>
          </View>
        </View>

        {/* ①' 本番受験者の中での位置。星ではなく「得点分布ベルカーブ」にあなたを重ねて直感的に示す
              (模試詳細結果と同じ図・ユーザー要望2026-08-25=星/上位%は分かりにくい)。 */}
        {d.rel && d.official && d.rel.total && (
          <View style={s.card}>
            <SecLabel c={c} s={s} text={t('coach.rel_title')} />
            <View style={s.relChart}>
              <BellCurve
                level={state.settings.level as OfficialLevel}
                score={st.predScore}
                passTotal={st.passTotal}
                width={chartW}
                c={c}
                youLabel={t('mockres.you')}
                passLabel={t('mockres.passline')}
              />
            </View>
            <Text style={s.relRef}>{t('coach.rel_ref', { label: d.official.base, mean: Math.round(d.official.mean), rate: d.official.passRate })}</Text>
            <Text style={s.diff}>{t('coach.rel_note')}</Text>
          </View>
        )}

        {/* ② 分野別の到達度(5軸レーダー: 漢字/語彙/文法/読解/聴解) */}
        <View style={s.card}>
          <SecLabel c={c} s={s} text={t('coach.facet_title')} />
          <FacetRadar data={d.subs.map((sub) => ({ label: t(sub.labelKey), pct: sub.pct, color: sub.color }))} c={c} />
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
          {/* 分類別の推移(漢字青/語彙緑/文法赤・縦=累計語数/横=直近14日)。旧「学習量の推移」バーをここへ統合(線の傾き=その日の増加・高さ=累計)。 */}
          <View style={s.growthWrap}>
            <LineChart c={c} width={chartW} data={d.covCurve} leftLabel={t('coach.growth_ago')} rightLabel={t('coach.growth_today')} />
            <View style={s.legendRow}>
              {[
                { k: 'cards.kanji', col: c.blue, v: d.covCurve[d.covCurve.length - 1].kanji },
                { k: 'cards.vocab', col: c.green, v: d.covCurve[d.covCurve.length - 1].vocab },
                { k: 'cards.grammar', col: c.red, v: d.covCurve[d.covCurve.length - 1].grammar },
              ].map((lg) => (
                <View key={lg.k} style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: lg.col }]} />
                  <Text style={s.legendLbl}>{t(lg.k)}</Text>
                  <Text style={s.legendVal}>{lg.v}</Text>
                </View>
              ))}
            </View>
            <Text style={s.barCap}>{t('coach.vol_recent', { n: d.covGain })}</Text>
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

        {/* ⑥' 模試の記録(実戦の予想得点)。※旧「この7日の成長」は重複(予想得点/伸びた分野)のため撤去し、
            週の伸びは下の「学習量の推移」で表す。 */}
        <View style={s.card}>
          <SecLabel c={c} s={s} text={t('coach.mock_title')} />
          {d.latestMock ? (
            <>
              <Pressable style={s.mockHero} onPress={() => openMock(d.latestMock!)} disabled={!canOpenMock(d.latestMock!)}>
                <View style={{ flex: 1 }}>
                  <Text style={s.mockScore}>{d.latestMock.predScore}<Text style={s.mockScoreMax}>{t('coach.score_of', { n: d.latestMock.predMax ?? 180 })}</Text></Text>
                  <Text style={s.mockMeta}>{t('coach.mock_meta', { n: d.latestMock.passTotal ?? '—', day: d.latestMock.day })}</Text>
                </View>
                {(() => {
                  const pass = (d.latestMock!.predScore ?? 0) >= (d.latestMock!.passTotal ?? Number.MAX_SAFE_INTEGER);
                  return <Text style={[s.mockJudge, { color: pass ? c.green : c.amber, borderColor: (pass ? c.green : c.amber) + '88' }]}>{pass ? t('coach.mock_pass') : t('coach.mock_close')}</Text>;
                })()}
                {canOpenMock(d.latestMock!) ? <Ionicons name="chevron-forward" size={20} color={c.mute} style={{ marginLeft: 2 }} /> : null}
              </Pressable>
              {d.prevMock ? (() => {
                const delta = (d.latestMock!.predScore ?? 0) - (d.prevMock!.predScore ?? 0);
                const deltaStr = delta > 0 ? `▲${delta}` : delta < 0 ? `▼${-delta}` : '±0';
                return <Text style={[s.mockDelta, { color: delta > 0 ? c.green : delta < 0 ? c.red : c.mute }]}>{t('coach.mock_delta', { prev: d.prevMock!.predScore ?? 0, cur: d.latestMock!.predScore ?? 0, delta: deltaStr })}</Text>;
              })() : null}
              {/* 区分別スコアは重複のため撤去(タップで成績表を開けば偏差値つきで確認できる)。 */}
              {d.mockTrend.length > 1 ? (
                <View style={s.mockTrendRow}>
                  {d.mockTrend.map((mt, i) => {
                    const open = canOpenMock(mt);
                    return (
                      <Pressable key={i} style={s.mockTrendItem} onPress={() => openMock(mt)} disabled={!open} hitSlop={6}>
                        <Text style={[s.mockTrendScore, i === d.mockTrend.length - 1 && { color: c.blue }, open && { textDecorationLine: 'underline' }]}>{mt.predScore}</Text>
                        <Text style={s.mockTrendDay}>{mt.day.slice(5)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
              {d.mockTrend.some(canOpenMock) ? <Text style={s.mockTapHint}>{t('coach.mock_tap_hint')}</Text> : null}
              <Text style={s.diff}>{t('coach.mock_note')}</Text>
            </>
          ) : (
            <Pressable style={s.mockEmpty} onPress={() => nav.navigate('Mock', { full: true })}>
              <Text style={s.mockEmptyT}>{t('coach.mock_empty')}</Text>
              <Text style={s.mockEmptyCta}>{t('coach.mock_empty_cta')}</Text>
            </Pressable>
          )}
        </View>

        {/* ⑥ 継続・学習量(継続ストリップ＋カレンダーを1枚に統合: 連続/時間/累計＋最長・フリーズ＋7日/28日ドット) */}
        <View style={s.card}>
          <SecLabel c={c} s={s} text={t('coach.cal_title')} />
          <View style={s.stripRow}>
            <StripCell s={s} n={`${d.st.streakDays}`} unit={t('coach.unit_days')} tt={t('coach.strip_streak')} c={c} />
            <StripCell s={s} n={`${d.h}`} unit={t('coach.unit_hm', { m: d.m })} tt={t('coach.strip_time')} c={c} border />
            <StripCell s={s} n={`${d.learned}`} unit={t('coach.due_unit')} tt={t('coach.strip_total')} c={c} />
          </View>
          <Text style={s.calMeta}>{t('coach.cal_meta', { n: d.streak.longest, f: d.streak.freezes })}</Text>
          <View style={s.week}>
            {d.week.map((day) => <View key={day} style={[s.wdot, d.studied.has(day) && { backgroundColor: c.amber, borderColor: c.amber }, day === d.today && { borderWidth: 2, borderColor: c.ink }]} />)}
          </View>
          <View style={s.heat}>
            {d.month.map((day) => <View key={day} style={[s.hdot, d.studied.has(day) && { backgroundColor: c.amber, borderColor: c.amber }, day === d.today && { borderWidth: 1.5, borderColor: c.ink }]} />)}
          </View>
        </View>

        {/* コーチのアドバイス(いちばんの弱点＋締めの一言を1枚に統合＝同じアドバイス系のため) */}
        <View style={s.voice}>
          <View style={s.voiceB}><Text style={s.voiceBt}>◇</Text></View>
          <View style={s.voiceBody}>
            <View style={s.weakLine}>
              <View style={[s.chip, { backgroundColor: c.red + '22', borderColor: c.red + '55' }]}><Text style={[s.chipT, { color: c.red }]}>{t('coach.weak_chip')}</Text></View>
              <Text style={s.weakInline}>{t('coach.weak_text', { cat, pct: d.weakest.pct })}</Text>
            </View>
            <Text style={s.voiceT}>{coachMsg}</Text>
          </View>
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

// 分野別到達度の5軸レーダー(漢字/語彙/文法/読解/聴解)。各頂点は区分色の点＋ラベル＋%。
function FacetRadar({ data, c }: { data: { label: string; pct: number; color: string }[]; c: ThemeColors }) {
  const W = 300, H = 230, cx = W / 2, cy = H / 2, R = 66;
  const n = Math.max(1, data.length);
  const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i: number, r: number) => [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))] as const;
  const grid = [0.25, 0.5, 0.75, 1];
  const poly = data.map((d, i) => pt(i, R * Math.max(0.02, d.pct / 100)).join(',')).join(' ');
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      {grid.map((rr, k) => (
        <Polygon key={k} points={data.map((_, i) => pt(i, R * rr).join(',')).join(' ')} fill="none" stroke={c.line} strokeWidth={1} />
      ))}
      {data.map((_, i) => { const [x, y] = pt(i, R); return <Line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={c.line} strokeWidth={1} />; })}
      <Polygon points={poly} fill={c.blue} fillOpacity={0.2} stroke={c.blue} strokeWidth={2} />
      {data.map((d, i) => { const [x, y] = pt(i, R * Math.max(0.02, d.pct / 100)); return <Circle key={i} cx={x} cy={y} r={3.5} fill={d.color} />; })}
      {data.map((d, i) => {
        const [x, y] = pt(i, R + 26);
        return <SvgText key={`l${i}`} x={x} y={y} fontSize={12} fill={c.ink2} fontWeight="800" textAnchor="middle">{d.label}</SvgText>;
      })}
      {data.map((d, i) => {
        const [x, y] = pt(i, R + 26);
        return <SvgText key={`p${i}`} x={x} y={y + 15} fontSize={12} fill={d.color} fontWeight="800" textAnchor="middle">{`${Math.round(d.pct)}%`}</SvgText>;
      })}
    </Svg>
  );
}

// 分類別カバー率(覚えた数)の3本折れ線。漢字=青/語彙=緑/文法=赤。縦=累計語数・横=直近14日。
// 実px幅(width)で描く=viewBox伸縮による端点マーカーの歪みを避ける(BellCurveと同方針)。
function LineChart({ c, width, data, leftLabel, rightLabel }: { c: ThemeColors; width: number; data: { day: string; kanji: number; vocab: number; grammar: number }[]; leftLabel: string; rightLabel: string }) {
  const H = 142, padT = 12, padB = 24, padX = 6; // padB を広めに取り、横軸の端ラベル(◯週間前→今日)を置く
  const W = Math.max(220, width);
  const n = Math.max(1, data.length);
  const series = [
    { key: 'kanji', color: c.blue, vals: data.map((d) => d.kanji) },
    { key: 'vocab', color: c.green, vals: data.map((d) => d.vocab) },
    { key: 'grammar', color: c.red, vals: data.map((d) => d.grammar) },
  ];
  const max = Math.max(1, ...series.flatMap((sr) => sr.vals));
  const x = (i: number) => padX + (i * (W - 2 * padX)) / Math.max(1, n - 1);
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  const base = H - padB;
  const line = (vals: number[]) => vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  return (
    <Svg width={W} height={H}>
      <Line x1={padX} y1={base} x2={W - padX} y2={base} stroke={c.line} strokeWidth={1} />
      {series.map((sr) => (
        <Path key={sr.key} d={line(sr.vals)} fill="none" stroke={sr.color} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {series.map((sr) => {
        const li = sr.vals.length - 1;
        return <Circle key={sr.key + 'e'} cx={x(li)} cy={y(sr.vals[li])} r={3.2} fill={sr.color} />;
      })}
      {/* 横軸の端ラベル: 左=◯週間前 / 右=今日 */}
      <SvgText x={padX} y={base + 15} fontSize={9} fill={c.faint} fontWeight="700">{leftLabel}</SvgText>
      <SvgText x={W - padX} y={base + 15} fontSize={9} fill={c.faint} fontWeight="700" textAnchor="end">{rightLabel}</SvgText>
    </Svg>
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
  headRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
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
  heroGoal: { fontSize: 12.5, fontWeight: '800', textAlign: 'center', marginTop: spacing.sm },

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
  // 本番受験者の中での位置(相対位置)=得点分布ベルカーブ＋分野別の立ち位置バー
  relChart: { alignItems: 'center', marginBottom: spacing.sm },
  relAxis: { fontSize: 9.5, color: c.faint, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  relList: { gap: spacing.sm },
  relRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  relLabel: { width: 72, fontSize: 12, color: c.ink2, fontWeight: '700' },
  relRef: { fontSize: 10.5, color: c.faint, fontWeight: '600', marginTop: spacing.sm, lineHeight: 15 },
  // 模試の記録カード
  mockHero: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  mockScore: { fontSize: 34, fontWeight: '900', color: c.ink, lineHeight: 38 },
  mockScoreMax: { fontSize: 15, fontWeight: '800', color: c.faint },
  mockMeta: { fontSize: 11.5, color: c.mute, fontWeight: '700', marginTop: 2 },
  mockJudge: { fontSize: 12, fontWeight: '900', borderWidth: 1.5, borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 12, overflow: 'hidden' },
  mockDelta: { fontSize: 12, fontWeight: '800', marginTop: spacing.xs },
  mockTrendRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: c.line },
  mockTrendItem: { alignItems: 'center', flex: 1 },
  mockTrendScore: { fontSize: 13, fontWeight: '800', color: c.ink2, fontVariant: ['tabular-nums'] },
  mockTrendDay: { fontSize: 9, color: c.faint, marginTop: 1 },
  mockTapHint: { fontSize: 10.5, color: c.blue, fontWeight: '700', textAlign: 'center', marginTop: 6 },
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

  // 分類別の推移(3本折れ線＝旧「学習量の推移」を統合)
  growthWrap: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: c.line },
  legendRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: spacing.md, marginTop: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendLbl: { fontSize: 11.5, color: c.ink2, fontWeight: '700' },
  legendVal: { fontSize: 11.5, color: c.ink, fontWeight: '900', fontVariant: ['tabular-nums'] },
  barCap: { fontSize: 10.5, color: c.faint, fontWeight: '700', marginTop: 6, textAlign: 'center' },

  spark: { marginTop: spacing.md },
  sparkCap: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  sparkCapT: { fontSize: 10, color: c.faint, fontWeight: '700', letterSpacing: 0.5 },
  sparkEnd: { fontSize: 10, fontWeight: '800' },

  weakCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chip: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1 },
  chipT: { fontSize: 11, fontWeight: '800' },
  weakT: { flex: 1, fontSize: 12.5, color: c.ink, lineHeight: 19 },

  stripRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: c.line, paddingBottom: spacing.sm, marginBottom: spacing.sm },
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
  voiceT: { fontSize: 12.5, color: c.ink, lineHeight: 19 },
  voiceBody: { flex: 1, gap: 8 },
  weakLine: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  weakInline: { flex: 1, minWidth: 130, fontSize: 12.5, color: c.ink, lineHeight: 19, fontWeight: '600' },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: c.blue, borderRadius: radius.md, paddingVertical: 14, marginTop: 2 },
  ctaT: { color: '#fff', fontSize: 15, fontWeight: '800' },
});

function shadow1(c: ThemeColors) {
  return { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 } as const;
}
