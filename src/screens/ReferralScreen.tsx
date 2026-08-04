// 友だち紹介(リファラル)の導線画面。自分の紹介コードを表示＋共有し、
// 新規は友だちからもらったコードを手入力して登録する(local-first・受取にアカウント必須にしない=ソフト誘導)。
// 演出強化: コードはギフトチケット風＋淡い発光の呼吸、受け取り時はお祝い、ごほうびの予感カード。
// もらえる条件はあえて明記しない(曖昧化)＝純粋に続ける人が自然にごほうびを得る／Pro目当てだけを寄せ付けない。
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput, Share, ActivityIndicator, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState, useAppActions } from '../store/store';
import { useT } from '../i18n';
import { getMyCode } from '../referral/referralClient';

export default function ReferralScreen() {
  const t = useT();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const nav = useNavigation();
  const state = useAppState();
  const { setEnteredCode } = useAppActions();

  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');

  // 自分の紹介コードをサーバーから取得(無ければ採番)。失敗時は空文字→エラー表示。
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cd = await getMyCode();
      if (!cancelled) { setCode(cd); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  // チケットの淡い発光を呼吸させる(ゆっくり明滅＋ごく僅かな拡大)。
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1600, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 1600, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const glowOp = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.55] });
  const glowSc = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });

  const onShare = async () => {
    if (!code) return;
    try {
      await Share.share({ message: t('referral.share_message', { code }) });
    } catch {
      // 共有シートを閉じただけ等は無視
    }
  };

  const entered = state.referral?.enteredCode;
  const onSaveCode = () => {
    const v = input.trim().toUpperCase();
    if (!v) return;
    setEnteredCode(v);
    setInput('');
  };

  return (
    <SafeAreaView style={s.c} edges={['top']}>
      <ScrollView contentContainerStyle={s.body}>
        <View style={s.headRow}>
          <Text style={s.title}>{t('referral.title')}</Text>
          <Pressable onPress={() => nav.goBack()} hitSlop={12} accessibilityLabel={t('nav.close')}>
            <Text style={s.closeX}>×</Text>
          </Pressable>
        </View>

        {/* 見出し=誘いたくなるお祝い感 */}
        <View style={s.hero}>
          <Text style={s.heroEmoji}>🌸</Text>
          <Text style={s.heroTitle}>{t('referral.headline')}</Text>
          <Text style={s.heroSub}>{t('referral.subhead')}</Text>
        </View>

        {/* 自分の紹介コード=ギフトチケット風＋淡い発光の呼吸 */}
        <View style={s.ticketWrap}>
          <Animated.View style={[s.ticketGlow, { opacity: glowOp, transform: [{ scale: glowSc }] }]} />
          <View style={s.ticket}>
            <View style={s.ticketTop}><Text style={s.ticketBadge}>🎁 {t('referral.my_code')}</Text></View>
            {loading ? (
              <View style={s.codeLoading}><ActivityIndicator color={c.blue} /><Text style={s.loadingTxt}>{t('referral.code_loading')}</Text></View>
            ) : code ? (
              <>
                <View style={s.codeBox}><Text style={s.codeTxt}>{code}</Text></View>
                <Pressable style={({ pressed }) => [s.shareBtn, pressed && { opacity: 0.9 }]} onPress={onShare}>
                  <Text style={s.shareTxt}>✉️ {t('referral.share')}</Text>
                </Pressable>
              </>
            ) : (
              <Text style={s.errTxt}>{t('referral.code_error')}</Text>
            )}
          </View>
        </View>

        {/* ごほうびの予感(あえて曖昧に・でも心が躍る) */}
        <View style={s.rewardCard}>
          <Text style={s.rewardTitle}>ふたりで学習を続けると、いいことが。</Text>
          <View style={s.rewardChips}>
            <View style={s.rChip}><Text style={s.rChipE}>🌸</Text><Text style={s.rChipT}>桜貝</Text></View>
            <View style={s.rChip}><Text style={s.rChipE}>🏅</Text><Text style={s.rChipT}>特別バッジ</Text></View>
            <View style={s.rChip}><Text style={s.rChipE}>🎁</Text><Text style={s.rChipT}>おたのしみ</Text></View>
          </View>
        </View>

        {/* 新規=友だちのコードを手入力(受取にアカウント不要) */}
        <View style={s.card}>
          <Text style={s.lbl}>{t('referral.enter_title')}</Text>
          <Text style={s.hint}>{t('referral.enter_hint')}</Text>
          {entered ? (
            <View style={s.enteredBox}>
              <Text style={s.enteredEmoji}>🎉</Text>
              <Text style={s.entered}>{t('referral.entered', { code: entered })}</Text>
            </View>
          ) : (
            <View style={s.enterRow}>
              <TextInput
                style={s.input}
                value={input}
                onChangeText={setInput}
                placeholder={t('referral.enter_placeholder')}
                placeholderTextColor={c.faint}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <Pressable style={[s.saveBtn, !input.trim() && s.saveBtnOff]} onPress={onSaveCode} disabled={!input.trim()}>
                <Text style={s.saveTxt}>{t('referral.enter_save')}</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    c: { flex: 1, backgroundColor: c.bg },
    body: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.lg },
    headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { fontSize: ty.h1, fontWeight: '800', color: c.ink, marginTop: spacing.xs },
    closeX: { fontSize: 30, color: c.mute, fontWeight: '700', paddingHorizontal: spacing.xs },

    hero: { alignItems: 'center', marginTop: spacing.xs, marginBottom: spacing.xs, gap: 4 },
    heroEmoji: { fontSize: 40 },
    heroTitle: { fontSize: ty.h2, fontWeight: '900', color: c.ink, lineHeight: 30, textAlign: 'center' },
    heroSub: { fontSize: ty.body, fontWeight: '700', color: c.ink2, lineHeight: 22, textAlign: 'center' },

    // ギフトチケット＋発光
    ticketWrap: { marginTop: spacing.xs },
    ticketGlow: { position: 'absolute', top: 10, left: 18, right: 18, bottom: 2, borderRadius: radius.lg, backgroundColor: c.blue },
    ticket: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 2, borderColor: c.blue, borderStyle: 'dashed', padding: spacing.md, gap: spacing.sm },
    ticketTop: { alignItems: 'center' },
    ticketBadge: { fontSize: ty.small, fontWeight: '900', color: c.blueDark, letterSpacing: 0.5 },
    codeLoading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, justifyContent: 'center' },
    loadingTxt: { fontSize: ty.small, color: c.mute },
    errTxt: { fontSize: ty.small, color: c.red, lineHeight: 19, textAlign: 'center' },
    codeBox: { alignItems: 'center', paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: c.blueLight },
    codeTxt: { fontSize: ty.h1, fontWeight: '900', letterSpacing: 6, color: c.blueDark },
    shareBtn: { alignItems: 'center', paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: c.blue },
    shareTxt: { fontSize: ty.body, fontWeight: '800', color: '#fff' },

    // ごほうびの予感
    rewardCard: { backgroundColor: c.blueLight, borderRadius: radius.lg, borderWidth: 1, borderColor: c.blue + '33', padding: spacing.md, gap: spacing.sm, marginTop: spacing.sm },
    rewardTitle: { fontSize: ty.body, fontWeight: '800', color: c.ink, textAlign: 'center' },
    rewardChips: { flexDirection: 'row', justifyContent: 'space-around' },
    rChip: { alignItems: 'center', gap: 3, flex: 1 },
    rChipE: { fontSize: 24 },
    rChipT: { fontSize: 11, fontWeight: '700', color: c.ink2 },

    card: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: spacing.md, marginTop: spacing.sm, gap: spacing.sm },
    lbl: { fontSize: ty.small, fontWeight: '800', color: c.ink2 },
    hint: { fontSize: ty.small, color: c.mute, lineHeight: 19 },
    enterRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
    input: { flex: 1, borderWidth: 1, borderColor: c.line, borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, fontSize: ty.body, fontWeight: '800', color: c.ink, letterSpacing: 2, backgroundColor: c.bgSoft },
    saveBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: c.blue },
    saveBtnOff: { opacity: 0.4 },
    saveTxt: { fontSize: ty.small, fontWeight: '800', color: '#fff' },
    enteredBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: c.green + '14', borderRadius: radius.md, padding: spacing.md },
    enteredEmoji: { fontSize: 22 },
    entered: { flex: 1, fontSize: ty.body, fontWeight: '800', color: c.green },
  });
