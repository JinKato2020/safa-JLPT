// 週に1度だけ、桜が「今週のがんばり」を届ける“特別な”おたより(モーダル)。
//  目的=①学習意欲 ②アプリへの愛着。週1回だけなので、視覚(登場アニメ・花びら・和紙グラデ・桜の全身絵)と
//  情報(3指標の報告＋合格ラインまでの進捗＋今週のベスト＋連続日数＋第N号の印)で最大限に喜ばせる。
//  数字は既存の成長データだけ(予想得点 expectedScoreFor / カバー率 coverageBars / 覚えた語 growthStats)。
//  ※【厳守】「合格率」は廃止指標(ユーザー厳命・[[metric-label-is-predicted-score]])。合格率/passGain は一切使わない。
//  1通につき「友だち紹介」「アプリ評価」のどちらか1つだけを添える(交互・強く押さない)。評価は良い週だけ＋数ヶ月に1度。
//  出す条件: 初回はインストール7日後以降・前回から7日以上あき・その週に伸びがある時だけ。模試チケット配布の祝い中は出さない。
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, View, Text, Image, Pressable, StyleSheet, useWindowDimensions, Animated, Easing } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Rect } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAppState, useAppActions } from '../store/store';
import { dayStr, daysBetween, type Settings } from '../store/state';
import { weekGain, coverGain, scoreGain, growthBars } from './growthStats';
import { coverageBars, expectedScoreFor } from '../store/selectors';
import { askStoreReview } from '../util/storeReview';
import { spacing, type as ty } from '../theme';
import { useT } from '../i18n';

const SAKURA = require('../../assets/home/sakura_front_short.png'); // 桜の全身・正面・笑顔(ホームのマスコット)。

const WEEK = 7;                          // 出す間隔(日)
const RATE_GAP_MS = 30 * 86_400_000;     // アプリ評価を尋ねる最短間隔(約1ヶ月)。OS側は年数回しか実際のダイアログを出さない(頻度はOSが制御)。
const REVEAL_MS = 700;                   // ホーム到着から少し落ち着いてから出す

// 和紙調のお祝いパレット(テーマ非依存=常に明るいお便り。暗い背景の上に浮かぶカードなので固定色で読みやすさを担保)。
const CREAM = '#fff8f3', PINK = '#ffe1ec', INK = '#4b3a34', INK2 = '#93726a';
const GOLD = '#e0a92e', ROSE = '#e5709a', GREEN = '#2e9e5b', TRACK = '#f2dde3', LINE = '#f0d7c9';

export type WeeklyService = 'referral' | 'rating' | 'none';
type Service = WeeklyService;

// 舞い散る桜の花びら1枚(ゆっくり落下＋横ゆれ＋回転をループ)。native driver。装飾なのでタップは透過。
function Petal({ x, size, delay, dur, fall }: { x: number; size: number; delay: number; dur: number; fall: number }) {
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(p, { toValue: 1, duration: dur, delay, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [p, dur, delay]);
  const translateY = p.interpolate({ inputRange: [0, 1], outputRange: [-24, fall] });
  const translateX = p.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 16, -8] });
  const rotate = p.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '320deg'] });
  const opacity = p.interpolate({ inputRange: [0, 0.12, 0.82, 1], outputRange: [0, 0.75, 0.75, 0] });
  return (
    <Animated.Text pointerEvents="none" style={{ position: 'absolute', left: x, top: 0, fontSize: size, opacity, transform: [{ translateY }, { translateX }, { rotate }] }}>
      🌸
    </Animated.Text>
  );
}

// preview を渡すと(設定の開発者用エリア)、条件を無視してそのサービスで即表示する。プレビューは設定を一切書き換えない。
export default function WeeklyLetter({ preview = null, onPreviewClose }: { preview?: Service | null; onPreviewClose?: () => void } = {}) {
  const state = useAppState();
  const { setSettings } = useAppActions();
  const t = useT();
  const { width } = useWindowDimensions();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const nowRef = useRef(Date.now());
  const now = nowRef.current;
  const today = dayStr(now);

  // 今週の伸び(既存データ・合格率は使わない)。おたよりは3指標(予想得点・カバー率・覚えた語)を報告する。
  const wGain = useMemo(() => weekGain(state, today), [state, today]);           // 今週 覚えた語の増加
  const cGain = useMemo(() => coverGain(state, today), [state, today]);          // 今週 カバー(漢字+ことば+文法)の増加(件数)
  const sGain = useMemo(() => scoreGain(state, today), [state, today]);          // 今週 予想得点の増加(点)
  // 現在値はホームと同じ関数で出す(表示が食い違わないように)。
  const est = useMemo(() => { try { return expectedScoreFor(state, now); } catch { return null; } }, [state, now]);
  const bars = useMemo(() => { try { return coverageBars(state, now); } catch { return [] as ReturnType<typeof coverageBars>; } }, [state, now]);
  const covLearned = bars.reduce((a, b) => a + b.learned, 0);
  const covTotal = bars.reduce((a, b) => a + b.total, 0);
  const coverPct = covTotal > 0 ? Math.round((covLearned / covTotal) * 100) : 0;  // 今のカバー率(%)
  const coverUpPct = covTotal > 0 ? Math.round((cGain / covTotal) * 100) : 0;      // 今週のカバー率の伸び(%)
  const totalWords = useMemo(() => { const g = growthBars(state, today, 1); return g[g.length - 1] ?? 0; }, [state, today]); // 覚えた語の累計
  const predScore = est?.score ?? 0;
  const predMax = est?.max ?? 180;
  const passTotal = est?.passTotal ?? 0;
  const streakDays = state.streak?.current ?? 0;

  // 出すかどうか(すべて満たす時だけ)。
  const installedDay = state.installedAt ? dayStr(state.installedAt) : null;
  const ageOK = !installedDay || daysBetween(installedDay, today) >= WEEK; // 初回はインストール7日後から
  const last = state.settings.weeklyLetterDay;
  const gapOK = !last || daysBetween(last, today) >= WEEK;                 // 前回から7日以上あき
  const hasGrowth = wGain > 0 || cGain > 0 || sGain > 0;                    // 伸びゼロの週は出さない(空振りで押し付けない)
  const notBusy = (state.ticketNotice ?? 0) === 0;                         // 模試チケット配布の祝いと重ねない
  const eligible = ageOK && gapOK && hasGrowth && notBusy;

  // この通に添える1サービス(交互・最大1つ)。
  const forced = preview != null;
  const previewHost = onPreviewClose != null; // プレビュー用(設定画面)のインスタンス=自動表示しない
  const turn = state.settings.weeklyLetterTurn ?? 0;
  const ratingSlot = turn % 2 === 1;
  const goodWeek = wGain >= 5 || cGain > 0 || sGain > 0;                     // 評価は良い週だけ
  const rateDue = now - (state.settings.ratingAskedAt ?? 0) > RATE_GAP_MS;   // 数ヶ月に1度まで
  const service: Service = forced ? (preview as Service) : ratingSlot ? (goodWeek && rateDue ? 'rating' : 'none') : 'referral';

  const [autoVisible, setAutoVisible] = useState(false);
  const [previewDismissed, setPreviewDismissed] = useState(false);
  const [cardH, setCardH] = useState(520);
  const shownRef = useRef(false);

  // 登場アニメ(ぽんっと弾む)。native driver。
  const pop = useRef(new Animated.Value(0)).current;

  // プレビュー要求が来たら毎回あらためて表示(dismissをリセット)。
  useEffect(() => { if (forced) setPreviewDismissed(false); }, [preview]); // eslint-disable-line react-hooks/exhaustive-deps

  // マウント後に1回だけ判定して出す(プレビュー時は自動表示しない)。出した瞬間に「最後に出した日・通算回数(＋評価なら尋ねた時刻)」を記録。
  useEffect(() => {
    if (forced || previewHost || shownRef.current || !eligible) return;
    shownRef.current = true;
    const id = setTimeout(() => {
      setAutoVisible(true);
      const patch: Partial<Settings> = { weeklyLetterDay: today, weeklyLetterTurn: turn + 1 };
      if (service === 'rating') patch.ratingAskedAt = now;
      setSettings(patch);
    }, REVEAL_MS);
    return () => clearTimeout(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = forced ? !previewDismissed : autoVisible;

  // 表示のたびに弾む登場アニメを最初から。
  useEffect(() => {
    if (!visible) { pop.setValue(0); return; }
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, friction: 6, tension: 90 }).start();
  }, [visible, pop]);

  const close = () => { if (forced) { setPreviewDismissed(true); onPreviewClose?.(); } else setAutoVisible(false); };
  const onRefer = () => { close(); nav.navigate('Referral', { focus: 'share' }); };
  // 桜が先に「気に入ってくれてる?」と聞き、“うん”の時だけ評価へ誘導(いやな人には出さない=低評価を招かない)。
  // 本番はOSの評価ダイアログ、開発プレビュー(forced)は必ずストアのレビューページを開いて動作確認できる。
  const onRate = async () => { close(); await askStoreReview(forced); };

  if (!visible) return null;

  // プレビュー(設定の開発用)では伸び0でもレイアウトを確認できるよう見本の数字を補う(プレビュー時のみ)。
  const pv = (real: number, sample: number) => (forced ? (real || sample) : real);
  const dPred = pv(predScore, 124), dPredUp = pv(sGain, 6);
  const dCover = pv(coverPct, 38), dCoverUp = pv(coverUpPct, 3);
  const dWords = pv(totalWords, 312), dWordsUp = pv(wGain, 12);
  const dPass = pv(passTotal, 95);
  const dStreak = pv(streakDays, 5);
  const sealNo = (state.settings.weeklyLetterTurn ?? 0) + 1;

  // 予想得点の合格ラインまでの進捗(合格率ではなく“点”で表す)。
  const predFill = predMax > 0 ? Math.max(0, Math.min(1, dPred / predMax)) : 0;
  const passMark = predMax > 0 ? Math.max(0, Math.min(1, dPass / predMax)) : 0;
  const reached = dPass > 0 && dPred >= dPass;
  const toPass = Math.max(0, dPass - dPred);
  const coverFill = Math.max(0, Math.min(1, dCover / 100));

  // 今週いちばん伸びた指標(お祝いの主役)。優先=予想得点→カバー率→覚えた語。
  const champ: 'pred' | 'cover' | 'words' = dPredUp > 0 ? 'pred' : dCoverUp > 0 ? 'cover' : 'words';
  const champLabel = champ === 'pred' ? t('weekly.k_pred') : champ === 'cover' ? t('weekly.k_cover') : t('weekly.k_words');
  const champUp = champ === 'pred' ? t('weekly.up_point', { n: dPredUp }) : champ === 'cover' ? t('weekly.up_pct', { n: dCoverUp }) : t('weekly.up_words', { n: dWords });

  const dims = Image.resolveAssetSource(SAKURA);
  const aspect = dims?.width && dims?.height ? dims.width / dims.height : 0.62;
  const imgW = Math.min(150, Math.round(width * 0.4));
  const imgH = Math.round(imgW / aspect);

  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  const petals = [
    { x: 18, size: 16, delay: 0, dur: 5200 }, { x: 70, size: 12, delay: 900, dur: 6100 },
    { x: 130, size: 20, delay: 400, dur: 4800 }, { x: 200, size: 13, delay: 1500, dur: 5600 },
    { x: 250, size: 17, delay: 200, dur: 5000 }, { x: 292, size: 12, delay: 1100, dur: 6300 },
    { x: 160, size: 14, delay: 2200, dur: 5400 },
  ];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Animated.View style={[styles.pop, { opacity: pop, transform: [{ scale }] }]}>
          {/* カード本体のタップは閉じない。overflow hidden でグラデ/花びらを角丸に収める。 */}
          <Pressable style={styles.card} onPress={() => {}} onLayout={(e) => setCardH(e.nativeEvent.layout.height)}>
            {/* 和紙調の縦グラデ(クリーム→桜色) */}
            <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
              <Defs>
                <SvgGradient id="g" x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor={CREAM} />
                  <Stop offset="100%" stopColor={PINK} />
                </SvgGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#g)" />
            </Svg>
            {/* 舞い散る花びら(装飾・タップ透過) */}
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              {petals.map((p, i) => <Petal key={i} {...p} fall={cardH + 24} />)}
            </View>

            {/* 上部の帯: 左=連続日数 / 右=第N号の印 */}
            <View style={styles.topBar}>
              {dStreak >= 2 ? (
                <View style={styles.streakChip}><Text style={styles.streakTxt}>{t('weekly.streak', { n: dStreak })}</Text></View>
              ) : <View />}
              <View style={styles.seal}><Text style={styles.sealTxt}>{t('weekly.seal', { n: sealNo })}</Text></View>
            </View>

            {/* 桜(全身・正面)＋背後のふんわり光 */}
            <View style={styles.heroWrap}>
              <View style={[styles.glow, { width: imgW * 1.25, height: imgW * 1.25, borderRadius: imgW }]} />
              <Image source={SAKURA} style={{ width: imgW, height: imgH }} resizeMode="contain" />
            </View>

            <Text style={styles.title}>{t('weekly.title')}</Text>
            <View style={styles.rule} />
            <Text style={styles.greet}>{t('weekly.greet')}</Text>

            {/* 今週のベスト(お祝いの主役) */}
            <View style={styles.best}>
              <Text style={styles.bestTrophy}>🏆</Text>
              <Text style={styles.bestLabel}>{t('weekly.best')}</Text>
              <Text style={styles.bestName}>{champLabel}</Text>
              <Text style={styles.bestUp}>{champUp}</Text>
            </View>

            {/* 3指標の報告(予想得点・カバー率・覚えた語)。予想得点/カバー率はバー付き。合格率は使わない。 */}
            <View style={styles.metrics}>
              {/* 予想得点＋合格ラインまでの進捗 */}
              <View style={styles.mCard}>
                <View style={styles.mTop}>
                  <Text style={styles.mIco}>📊</Text>
                  <Text style={styles.mLabel}>{t('weekly.k_pred')}</Text>
                  <Text style={styles.mVal}>{t('weekly.v_pred', { now: dPred, max: predMax })}</Text>
                  {dPredUp > 0 ? <Text style={styles.mUp}>{t('weekly.up_point', { n: dPredUp })}</Text> : null}
                </View>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${Math.round(predFill * 100)}%`, backgroundColor: reached ? GREEN : GOLD }]} />
                  {passMark > 0 && passMark < 1 ? <View style={[styles.mark, { left: `${Math.round(passMark * 100)}%` }]} /> : null}
                </View>
                <Text style={[styles.mSub, reached && { color: GREEN }]}>{reached ? t('weekly.reached') : t('weekly.to_pass', { n: toPass })}</Text>
              </View>

              {/* カバー率 */}
              <View style={styles.mCard}>
                <View style={styles.mTop}>
                  <Text style={styles.mIco}>📖</Text>
                  <Text style={styles.mLabel}>{t('weekly.k_cover')}</Text>
                  <Text style={styles.mVal}>{t('weekly.v_pct', { n: dCover })}</Text>
                  {dCoverUp > 0 ? <Text style={styles.mUp}>{t('weekly.up_pct', { n: dCoverUp })}</Text> : null}
                </View>
                <View style={styles.track}><View style={[styles.fill, { width: `${Math.round(coverFill * 100)}%`, backgroundColor: ROSE }]} /></View>
              </View>

              {/* 覚えた語 */}
              <View style={[styles.mCard, styles.mCardRow]}>
                <Text style={styles.mIco}>🌱</Text>
                <Text style={styles.mLabel}>{t('weekly.k_words')}</Text>
                <Text style={styles.mVal}>{t('weekly.v_words', { n: dWords })}</Text>
                {dWordsUp > 0 ? <Text style={styles.mUp}>{t('weekly.up_words', { n: dWordsUp })}</Text> : null}
              </View>
            </View>

            <Text style={styles.more}>{t('weekly.more')}</Text>

            {/* そっと添える1サービス(交互)。どれも閉じるのが簡単=強く押さない。 */}
            {service === 'referral' ? (
              <View style={styles.cta}>
                <Text style={styles.ctaLine}>{t('weekly.refer_line')}</Text>
                <Pressable style={styles.primary} onPress={onRefer} accessibilityLabel={t('weekly.refer_cta')}>
                  <Text style={styles.primaryTxt}>{t('weekly.refer_cta')}</Text>
                </Pressable>
                <Pressable style={styles.ghost} onPress={close} hitSlop={8}>
                  <Text style={styles.ghostTxt}>{t('weekly.later')}</Text>
                </Pressable>
              </View>
            ) : service === 'rating' ? (
              <View style={styles.cta}>
                <Text style={styles.ctaLine}>{t('weekly.rate_line')}</Text>
                <Pressable style={styles.primary} onPress={onRate} accessibilityLabel={t('weekly.rate_yes')}>
                  <Text style={styles.primaryTxt}>{t('weekly.rate_yes')}</Text>
                </Pressable>
                <Pressable style={styles.ghost} onPress={close} hitSlop={8}>
                  <Text style={styles.ghostTxt}>{t('weekly.rate_no')}</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable style={[styles.primary, styles.soloClose]} onPress={close}>
                <Text style={styles.primaryTxt}>{t('weekly.close')}</Text>
              </Pressable>
            )}
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(40,20,30,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  pop: {
    width: '100%', maxWidth: 360,
    shadowColor: '#5a2a3a', shadowOpacity: 0.35, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 12,
  },
  card: {
    width: '100%', alignItems: 'center', gap: spacing.xs, overflow: 'hidden',
    borderRadius: 24, borderWidth: 2, borderColor: '#f4c9a8',
    paddingVertical: spacing.lg, paddingHorizontal: spacing.lg,
  },
  topBar: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 30 },
  streakChip: { backgroundColor: 'rgba(229,112,154,0.14)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(229,112,154,0.35)' },
  streakTxt: { fontSize: ty.small, fontWeight: '900', color: ROSE },
  seal: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#c0405a', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff', transform: [{ rotate: '-8deg' }], shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  sealTxt: { fontSize: 13, fontWeight: '900', color: '#fff', textAlign: 'center', lineHeight: 15 },
  heroWrap: { alignItems: 'center', justifyContent: 'center', marginTop: -4 },
  glow: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.6)' },
  title: { fontSize: ty.h1, fontWeight: '900', color: INK, marginTop: 2, letterSpacing: 0.5 },
  rule: { width: 90, height: 3, borderRadius: 2, backgroundColor: GOLD, marginTop: 6, marginBottom: 2 },
  greet: { fontSize: ty.body, fontWeight: '800', color: INK2, textAlign: 'center', lineHeight: 24 },
  best: {
    width: '100%', flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.sm,
    backgroundColor: 'rgba(224,169,46,0.14)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(224,169,46,0.4)',
    paddingVertical: 10, paddingHorizontal: 12,
  },
  bestTrophy: { fontSize: 20 },
  bestLabel: { fontSize: ty.small, fontWeight: '900', color: '#a9791b' },
  bestName: { flex: 1, fontSize: ty.body, fontWeight: '900', color: INK },
  bestUp: { fontSize: ty.body, fontWeight: '900', color: GREEN },
  metrics: { width: '100%', gap: spacing.sm, marginTop: spacing.sm },
  mCard: { width: '100%', backgroundColor: 'rgba(255,255,255,0.72)', borderRadius: 14, borderWidth: 1, borderColor: LINE, paddingVertical: 10, paddingHorizontal: 12, gap: 8 },
  mCardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  mTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  mIco: { fontSize: 18, width: 24, textAlign: 'center' },
  mLabel: { flex: 1, fontSize: ty.body, fontWeight: '800', color: INK2 },
  mVal: { fontSize: ty.body, fontWeight: '900', color: INK },
  mUp: { fontSize: ty.small, fontWeight: '900', color: GREEN, backgroundColor: 'rgba(46,158,91,0.14)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden', minWidth: 46, textAlign: 'center' },
  track: { width: '100%', height: 9, borderRadius: 5, backgroundColor: TRACK, overflow: 'visible', justifyContent: 'center' },
  fill: { height: 9, borderRadius: 5, position: 'absolute', left: 0, top: 0 },
  mark: { position: 'absolute', top: -3, width: 3, height: 15, borderRadius: 2, backgroundColor: '#7a5c52' },
  mSub: { fontSize: ty.small, fontWeight: '800', color: '#a9791b' },
  more: { fontSize: ty.small, fontWeight: '700', color: INK2, textAlign: 'center', marginTop: spacing.sm, lineHeight: 22 },
  cta: { width: '100%', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, borderTopWidth: 1, borderTopColor: LINE, paddingTop: spacing.md },
  ctaLine: { fontSize: ty.body, fontWeight: '800', color: INK, textAlign: 'center', lineHeight: 24 },
  primary: { backgroundColor: ROSE, borderRadius: 16, paddingVertical: 12, paddingHorizontal: spacing.xl, minWidth: 200, alignItems: 'center', shadowColor: ROSE, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  primaryTxt: { color: '#fff', fontSize: ty.body, fontWeight: '900' },
  ghost: { paddingVertical: 6, paddingHorizontal: spacing.md },
  ghostTxt: { color: INK2, fontSize: ty.small, fontWeight: '800' },
  soloClose: { marginTop: spacing.sm },
});
