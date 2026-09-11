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
import * as StoreReview from 'expo-store-review';
import { useAppState, useAppActions } from '../store/store';
import { dayStr, daysBetween, type Settings } from '../store/state';
import { weekGain, coverGain } from './growthStats';
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

  // 今週の伸び(既存データ・合格率は使わない)。覚えた語＋カバー率(覚えた範囲)の伸び。
  const wGain = useMemo(() => weekGain(state, today), [state, today]);
  const cGain = useMemo(() => coverGain(state, today), [state, today]);

  // 出すかどうか(すべて満たす時だけ)。
  const installedDay = state.installedAt ? dayStr(state.installedAt) : null;
  const ageOK = !installedDay || daysBetween(installedDay, today) >= WEEK; // 初回はインストール7日後から
  const last = state.settings.weeklyLetterDay;
  const gapOK = !last || daysBetween(last, today) >= WEEK;                 // 前回から7日以上あき
  const hasGrowth = wGain > 0 || cGain > 0;                                // 伸びゼロの週は出さない(空振りで押し付けない)
  const notBusy = (state.ticketNotice ?? 0) === 0;                         // 模試チケット配布の祝いと重ねない
  const eligible = ageOK && gapOK && hasGrowth && notBusy;

  // この通に添える“そっと”した1サービス(交互・最大1つ)。
  const forced = preview != null;
  const previewHost = onPreviewClose != null; // プレビュー用(設定画面)のインスタンス=自動表示しない
  const turn = state.settings.weeklyLetterTurn ?? 0;
  const ratingSlot = turn % 2 === 1;
  const goodWeek = wGain >= 5 || cGain > 0;                                  // 評価は良い週だけ
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
  // 桜が先に「気に入ってくれてる?」と聞き、“うん”の時だけOSの評価画面を出す(いやな人には出さない=低評価を招かない)。
  const onRate = async () => {
    close();
    try { if (await StoreReview.isAvailableAsync()) await StoreReview.requestReview(); } catch { /* 使えない環境では何もしない */ }
  };

  if (!visible) return null;

  // プレビューで伸びが0でもレイアウトを確認できるよう見本の数字を補う(プレビュー時のみ)。
  const showW = forced ? (wGain || 12) : wGain;
  const showC = forced ? (cGain || 6) : cGain;

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

          {/* 今週のがんばり(伸びのある項目だけ) */}
          <View style={s.gains}>
            {showW > 0 ? (
              <View style={s.gainRow}>
                <Text style={s.gainIco}>🌱</Text>
                <Text style={s.gainTxt}>{t('weekly.words', { n: showW })}</Text>
              </View>
            ) : null}
            {showC > 0 ? (
              <View style={s.gainRow}>
                <Text style={s.gainIco}>📖</Text>
                <Text style={s.gainTxt}>{t('weekly.cover_up', { n: showC })}</Text>
              </View>
            ) : null}
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
    gains: { width: '100%', gap: 6, backgroundColor: c.bgSoft, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, paddingVertical: spacing.md, paddingHorizontal: spacing.md, marginTop: spacing.xs },
    gainRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
    gainIco: { fontSize: 20 },
    gainTxt: { fontSize: ty.body, fontWeight: '800', color: c.ink },
    more: { fontSize: ty.small, fontWeight: '700', color: c.mute, textAlign: 'center', marginTop: spacing.xs, lineHeight: 22 },
    cta: { width: '100%', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: c.line, paddingTop: spacing.md },
    ctaLine: { fontSize: ty.body, fontWeight: '700', color: c.ink, textAlign: 'center', lineHeight: 24 },
    primary: { backgroundColor: c.blue, borderRadius: radius.lg, paddingVertical: spacing.sm, paddingHorizontal: spacing.xl, minWidth: 180, alignItems: 'center' },
    primaryTxt: { color: '#fff', fontSize: ty.body, fontWeight: '900' },
    ghost: { paddingVertical: 6, paddingHorizontal: spacing.md },
    ghostTxt: { color: c.mute, fontSize: ty.small, fontWeight: '800' },
    soloClose: { marginTop: spacing.sm },
  });
