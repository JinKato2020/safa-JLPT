// 週に1度だけ、桜がそっと「今週のがんばり」を届けるおたより(モーダル)。
//  目的=①学習意欲 ②アプリへの愛着。数字は既存の成長データ(覚えた語 weekGain ＋ カバー率の伸び coverGain)を使うだけ=新しい計算はしない。
//  ※【厳守】「合格率」は廃止指標(ユーザー厳命・[[metric-label-is-predicted-score]])。成長表示に合格率/passGain は一切使わない。
//  1通につき「友だち紹介」「アプリ評価」のどちらか1つだけを“そっと”添える(交互・強く押さない)。評価は良い週だけ＋数ヶ月に1度。
//  出す条件: 初回はインストール7日後以降・前回から7日以上あき・その週に伸びがある時だけ。模試チケット配布の祝い中は出さない。
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, View, Text, Image, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAppState, useAppActions } from '../store/store';
import { dayStr, daysBetween, type Settings } from '../store/state';
import { weekGain, coverGain, scoreGain, growthBars } from './growthStats';
import { coverageBars, expectedScoreFor } from '../store/selectors';
import { askStoreReview } from '../util/storeReview';
import { GUIDE } from '../data/mywordsArt';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useT } from '../i18n';

const WEEK = 7;                          // 出す間隔(日)
const RATE_GAP_MS = 75 * 86_400_000;     // アプリ評価を尋ねる最短間隔(約2.5ヶ月)。OSの年数回制限を無駄使いしない。
const REVEAL_MS = 700;                   // ホーム到着から少し落ち着いてから出す

export type WeeklyService = 'referral' | 'rating' | 'none';
type Service = WeeklyService;

// preview を渡すと(設定の開発者用エリア)、条件を無視してそのサービスで即表示する。プレビューは設定を一切書き換えない。
export default function WeeklyLetter({ preview = null, onPreviewClose }: { preview?: Service | null; onPreviewClose?: () => void } = {}) {
  const state = useAppState();
  const { setSettings } = useAppActions();
  const t = useT();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
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

  // 出すかどうか(すべて満たす時だけ)。
  const installedDay = state.installedAt ? dayStr(state.installedAt) : null;
  const ageOK = !installedDay || daysBetween(installedDay, today) >= WEEK; // 初回はインストール7日後から
  const last = state.settings.weeklyLetterDay;
  const gapOK = !last || daysBetween(last, today) >= WEEK;                 // 前回から7日以上あき
  const hasGrowth = wGain > 0 || cGain > 0 || sGain > 0;                    // 伸びゼロの週は出さない(空振りで押し付けない)
  const notBusy = (state.ticketNotice ?? 0) === 0;                         // 模試チケット配布の祝いと重ねない
  const eligible = ageOK && gapOK && hasGrowth && notBusy;

  // この通に添える“そっと”した1サービス(交互・最大1つ)。
  const forced = preview != null;
  const previewHost = onPreviewClose != null; // プレビュー用(設定画面)のインスタンス=自動表示しない
  const turn = state.settings.weeklyLetterTurn ?? 0;
  const ratingSlot = turn % 2 === 1;
  const goodWeek = wGain >= 5 || cGain > 0 || sGain > 0;                     // 評価は良い週だけ
  const rateDue = now - (state.settings.ratingAskedAt ?? 0) > RATE_GAP_MS;   // 数ヶ月に1度まで
  const service: Service = forced ? (preview as Service) : ratingSlot ? (goodWeek && rateDue ? 'rating' : 'none') : 'referral';

  const [autoVisible, setAutoVisible] = useState(false);
  const [previewDismissed, setPreviewDismissed] = useState(false);
  const shownRef = useRef(false);

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

  const dims = Image.resolveAssetSource(GUIDE.open);
  const aspect = dims?.width && dims?.height ? dims.width / dims.height : 1;
  const imgW = Math.min(132, Math.round(width * 0.34));
  const imgH = Math.round(imgW / aspect);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <Pressable style={s.backdrop} onPress={close}>
        {/* カード本体のタップは閉じない(内側でstopPropagation代わりにonPress空) */}
        <Pressable style={s.card} onPress={() => {}}>
          <Image source={GUIDE.open} style={{ width: imgW, height: imgH }} resizeMode="contain" />
          <Text style={s.title}>{t('weekly.title')}</Text>
          <Text style={s.greet}>{t('weekly.greet')}</Text>

          {/* 今週のようす=3指標の報告(予想得点・カバー率・覚えた語)。各行=指標名｜今の値｜今週の伸び。合格率は使わない。 */}
          <View style={s.gains}>
            <View style={s.mRow}>
              <Text style={s.mIco}>📊</Text>
              <Text style={s.mLabel}>{t('weekly.k_pred')}</Text>
              <Text style={s.mVal}>{t('weekly.v_pred', { now: dPred, max: predMax })}</Text>
              {dPredUp > 0 ? <Text style={s.mUp}>{t('weekly.up_point', { n: dPredUp })}</Text> : null}
            </View>
            <View style={s.mRow}>
              <Text style={s.mIco}>📖</Text>
              <Text style={s.mLabel}>{t('weekly.k_cover')}</Text>
              <Text style={s.mVal}>{t('weekly.v_pct', { n: dCover })}</Text>
              {dCoverUp > 0 ? <Text style={s.mUp}>{t('weekly.up_pct', { n: dCoverUp })}</Text> : null}
            </View>
            <View style={s.mRow}>
              <Text style={s.mIco}>🌱</Text>
              <Text style={s.mLabel}>{t('weekly.k_words')}</Text>
              <Text style={s.mVal}>{t('weekly.v_words', { n: dWords })}</Text>
              {dWordsUp > 0 ? <Text style={s.mUp}>{t('weekly.up_words', { n: dWordsUp })}</Text> : null}
            </View>
          </View>
          <Text style={s.more}>{t('weekly.more')}</Text>

          {/* そっと添える1サービス(交互)。どれも閉じるのが簡単=強く押さない。 */}
          {service === 'referral' ? (
            <View style={s.cta}>
              <Text style={s.ctaLine}>{t('weekly.refer_line')}</Text>
              <Pressable style={s.primary} onPress={onRefer} accessibilityLabel={t('weekly.refer_cta')}>
                <Text style={s.primaryTxt}>{t('weekly.refer_cta')}</Text>
              </Pressable>
              <Pressable style={s.ghost} onPress={close} hitSlop={8}>
                <Text style={s.ghostTxt}>{t('weekly.later')}</Text>
              </Pressable>
            </View>
          ) : service === 'rating' ? (
            <View style={s.cta}>
              <Text style={s.ctaLine}>{t('weekly.rate_line')}</Text>
              <Pressable style={s.primary} onPress={onRate} accessibilityLabel={t('weekly.rate_yes')}>
                <Text style={s.primaryTxt}>{t('weekly.rate_yes')}</Text>
              </Pressable>
              <Pressable style={s.ghost} onPress={close} hitSlop={8}>
                <Text style={s.ghostTxt}>{t('weekly.rate_no')}</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={[s.primary, s.soloClose]} onPress={close}>
              <Text style={s.primaryTxt}>{t('weekly.close')}</Text>
            </Pressable>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
    card: {
      width: '100%', maxWidth: 360, alignItems: 'center', gap: spacing.xs,
      backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line,
      paddingVertical: spacing.lg, paddingHorizontal: spacing.lg,
      shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6,
    },
    title: { fontSize: ty.h2, fontWeight: '900', color: c.ink, marginTop: spacing.xs },
    greet: { fontSize: ty.body, fontWeight: '700', color: c.ink2, textAlign: 'center', lineHeight: 24 },
    gains: { width: '100%', gap: spacing.sm, backgroundColor: c.bgSoft, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, paddingVertical: spacing.md, paddingHorizontal: spacing.md, marginTop: spacing.xs },
    mRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    mIco: { fontSize: 18, width: 24, textAlign: 'center' },
    mLabel: { flex: 1, fontSize: ty.body, fontWeight: '800', color: c.ink2 },
    mVal: { fontSize: ty.body, fontWeight: '900', color: c.ink },
    mUp: { fontSize: ty.small, fontWeight: '900', color: '#2e9e5b', backgroundColor: 'rgba(46,158,91,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden', minWidth: 46, textAlign: 'center' },
    more: { fontSize: ty.small, fontWeight: '700', color: c.mute, textAlign: 'center', marginTop: spacing.xs, lineHeight: 22 },
    cta: { width: '100%', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: c.line, paddingTop: spacing.md },
    ctaLine: { fontSize: ty.body, fontWeight: '700', color: c.ink, textAlign: 'center', lineHeight: 24 },
    primary: { backgroundColor: c.blue, borderRadius: radius.lg, paddingVertical: spacing.sm, paddingHorizontal: spacing.xl, minWidth: 180, alignItems: 'center' },
    primaryTxt: { color: '#fff', fontSize: ty.body, fontWeight: '900' },
    ghost: { paddingVertical: 6, paddingHorizontal: spacing.md },
    ghostTxt: { color: c.mute, fontSize: ty.small, fontWeight: '800' },
    soloClose: { marginTop: spacing.sm },
  });
