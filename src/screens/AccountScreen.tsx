// アカウント作成/ログイン(段階1)。メール+パスワード。確認メールON=新規作成後は確認案内→ログイン。
// 案内=桜の巫女(既存アセット GUIDE.open)。文言は i18n(個人名を使わない)。
import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Image, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useT } from '../i18n';
import { signUp, signIn } from '../auth/authClient';
import { mapAuthError } from '../auth/authErrors';
import { GUIDE } from '../data/mywordsArt';

type Tab = 'signup' | 'login';

export default function AccountScreen() {
  const t = useT();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const nav = useNavigation();
  const [tab, setTab] = useState<Tab>('signup');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [errKey, setErrKey] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const submit = async () => {
    setErrKey(null);
    setConfirmSent(false);
    setBusy(true);
    try {
      if (tab === 'signup') {
        const r = await signUp(email.trim(), pw);
        if (r.error) { setErrKey(mapAuthError(r.error)); return; }
        if (r.needsConfirm) { setConfirmSent(true); setTab('login'); return; }
        nav.goBack(); // 確認不要設定なら即ログイン→戻る
      } else {
        const r = await signIn(email.trim(), pw);
        if (r.error) { setErrKey(mapAuthError(r.error)); return; }
        nav.goBack(); // ログイン成功→設定へ戻る(SyncProviderがpull/push)
      }
    } catch {
      setErrKey('account.err_network');
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = email.trim().length > 3 && pw.length >= 8 && !busy;

  return (
    <SafeAreaView style={s.c} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          <Pressable style={s.close} onPress={() => nav.goBack()} hitSlop={12}>
            <Text style={s.closeTxt}>✕</Text>
          </Pressable>

          <View style={s.hero}>
            <Image source={GUIDE.open} style={s.guide} resizeMode="contain" />
            <Text style={s.benefitTitle}>{t('account.benefit_title')}</Text>
            <Text style={s.benefitSub}>{t('account.benefit_sub')}</Text>
          </View>

          <View style={s.tabs}>
            {(['signup', 'login'] as const).map((tb) => (
              <Pressable key={tb} onPress={() => { setTab(tb); setErrKey(null); }} style={[s.tab, tab === tb && s.tabOn]}>
                <Text style={[s.tabTxt, tab === tb && s.tabTxtOn]}>{t(tb === 'signup' ? 'account.tab_signup' : 'account.tab_login')}</Text>
              </Pressable>
            ))}
          </View>

          {confirmSent ? (
            <View style={s.notice}>
              <Text style={s.noticeTitle}>{t('account.confirm_sent')}</Text>
              <Text style={s.noticeBody}>{t('account.confirm_hint')}</Text>
            </View>
          ) : null}

          <Text style={s.label}>{t('account.email')}</Text>
          <TextInput
            style={s.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
            placeholder="you@example.com"
            placeholderTextColor={c.faint}
          />

          <Text style={s.label}>{t('account.password')}</Text>
          <View style={s.pwRow}>
            <TextInput
              style={s.pwInput}
              value={pw}
              onChangeText={setPw}
              secureTextEntry={!showPw}
              autoCapitalize="none"
              placeholder={t('account.pw_hint')}
              placeholderTextColor={c.faint}
            />
            <Pressable onPress={() => setShowPw((v) => !v)} hitSlop={8} style={s.pwEye} accessibilityLabel={t(showPw ? 'account.pw_hide' : 'account.pw_show')}>
              <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={22} color={c.mute} />
            </Pressable>
          </View>

          {errKey ? <Text style={s.err}>{t(errKey)}</Text> : null}

          <Pressable style={[s.cta, !canSubmit && s.ctaOff]} onPress={submit} disabled={!canSubmit}>
            {busy ? <ActivityIndicator color="#fff" /> : (
              <Text style={s.ctaTxt}>{t(tab === 'signup' ? 'account.cta_create' : 'account.cta_login')}</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    c: { flex: 1, backgroundColor: c.bg },
    body: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl },
    close: { alignSelf: 'flex-end', padding: spacing.xs },
    closeTxt: { fontSize: ty.h2, color: c.mute, fontWeight: '700' },
    hero: { alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
    guide: { width: 120, height: 134 },
    benefitTitle: { fontSize: ty.h2, fontWeight: '800', color: c.ink, textAlign: 'center' },
    benefitSub: { fontSize: ty.small, color: c.mute, textAlign: 'center' },
    tabs: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
    tab: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface },
    tabOn: { borderColor: c.blue, backgroundColor: c.blueLight },
    tabTxt: { fontSize: ty.body, color: c.ink2, fontWeight: '700' },
    tabTxtOn: { color: c.blueDark, fontWeight: '800' },
    notice: { backgroundColor: c.blueLight, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
    noticeTitle: { fontSize: ty.body, fontWeight: '800', color: c.blueDark },
    noticeBody: { fontSize: ty.small, color: c.ink2, lineHeight: 18 },
    label: { fontSize: ty.small, fontWeight: '700', color: c.ink2, marginTop: spacing.sm },
    input: { borderWidth: 1, borderColor: c.line, borderRadius: radius.md, backgroundColor: c.surface, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, fontSize: ty.body, color: c.ink },
    pwRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: c.line, borderRadius: radius.md, backgroundColor: c.surface, paddingRight: spacing.xs },
    pwInput: { flex: 1, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, fontSize: ty.body, color: c.ink },
    pwEye: { padding: spacing.xs },
    err: { fontSize: ty.small, color: c.red, marginTop: spacing.xs },
    cta: { marginTop: spacing.md, backgroundColor: c.blue, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
    ctaOff: { opacity: 0.5 },
    ctaTxt: { fontSize: ty.body, fontWeight: '800', color: '#fff' },
  });
