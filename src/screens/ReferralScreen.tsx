// 友だち紹介(リファラル)の導線画面。自分の紹介コードを表示＋共有し、
// 新規は友だちからもらったコードを手入力して登録する(local-first・受取にアカウント必須にしない=ソフト誘導)。
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput, Share, ActivityIndicator } from 'react-native';
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

        {/* 見出し=誘いたくなる一言 */}
        <View style={s.hero}>
          <Text style={s.heroTitle}>{t('referral.headline')}</Text>
          <Text style={s.heroSub}>{t('referral.subhead')}</Text>
        </View>

        {/* 自分の紹介コード＋共有 */}
        <View style={s.card}>
          <Text style={s.lbl}>{t('referral.my_code')}</Text>
          {loading ? (
            <View style={s.codeLoading}><ActivityIndicator color={c.blue} /><Text style={s.loadingTxt}>{t('referral.code_loading')}</Text></View>
          ) : code ? (
            <>
              <View style={s.codeBox}><Text style={s.codeTxt}>{code}</Text></View>
              <Pressable style={s.shareBtn} onPress={onShare}>
                <Text style={s.shareTxt}>{t('referral.share')}</Text>
              </Pressable>
            </>
          ) : (
            <Text style={s.errTxt}>{t('referral.code_error')}</Text>
          )}
        </View>

        {/* 新規=友だちのコードを手入力(受取にアカウント不要) */}
        <View style={s.card}>
          <Text style={s.lbl}>{t('referral.enter_title')}</Text>
          <Text style={s.hint}>{t('referral.enter_hint')}</Text>
          {entered ? (
            <Text style={s.entered}>{t('referral.entered', { code: entered })}</Text>
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

        {/* もらえる条件 */}
        <View style={s.card}>
          <Text style={s.lbl}>{t('referral.how_title')}</Text>
          <Text style={s.hint}>{t('referral.how_body')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    c: { flex: 1, backgroundColor: c.bg },
    body: { padding: spacing.lg, gap: spacing.sm },
    headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { fontSize: ty.h1, fontWeight: '800', color: c.ink, marginTop: spacing.xs },
    closeX: { fontSize: 30, color: c.mute, fontWeight: '700', paddingHorizontal: spacing.xs },
    hero: { marginTop: spacing.xs, marginBottom: spacing.xs, gap: spacing.xs },
    heroTitle: { fontSize: ty.h2, fontWeight: '900', color: c.ink, lineHeight: 30 },
    heroSub: { fontSize: ty.body, fontWeight: '700', color: c.ink2, lineHeight: 22 },
    card: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: spacing.md, marginTop: spacing.sm, gap: spacing.sm },
    lbl: { fontSize: ty.small, fontWeight: '800', color: c.ink2 },
    hint: { fontSize: ty.small, color: c.mute, lineHeight: 19 },
    codeLoading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
    loadingTxt: { fontSize: ty.small, color: c.mute },
    errTxt: { fontSize: ty.small, color: c.red, lineHeight: 19 },
    codeBox: { alignItems: 'center', paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: c.blue, backgroundColor: c.blueLight },
    codeTxt: { fontSize: ty.h1, fontWeight: '900', letterSpacing: 4, color: c.blueDark },
    shareBtn: { alignItems: 'center', paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: c.blue },
    shareTxt: { fontSize: ty.body, fontWeight: '800', color: '#fff' },
    enterRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
    input: { flex: 1, borderWidth: 1, borderColor: c.line, borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, fontSize: ty.body, fontWeight: '800', color: c.ink, letterSpacing: 2, backgroundColor: c.bgSoft },
    saveBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: c.blue },
    saveBtnOff: { opacity: 0.4 },
    saveTxt: { fontSize: ty.small, fontWeight: '800', color: '#fff' },
    entered: { fontSize: ty.body, fontWeight: '800', color: c.green },
  });
