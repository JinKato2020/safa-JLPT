// アカウント作成/ログイン(段階1)。メール+パスワード。確認メールON=新規作成後は確認案内→ログイン。
// 案内=桜の巫女(既存アセット GUIDE.open)。文言は i18n(個人名を使わない)。
import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Image, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useT } from '../i18n';
import { signUp, signIn, signOut } from '../auth/authClient';
import { signInWithProvider, signInWithApple, isAppleAvailable } from '../auth/oauth';
import { mapAuthError } from '../auth/authErrors';
import { GUIDE } from '../data/mywordsArt';
import { useAppState } from '../store/store';
import { SHOP_BY_ID } from '../data/shop';
import { useSync } from '../auth/SyncProvider';
import AccountGrowthCard from '../components/AccountGrowthCard';
import AccountStreakCard from '../components/AccountStreakCard';

// 成長→継続カード。ログイン中・未ログインの両状態で画面上部に表示(統計はローカル)。
function StatCards() {
  return (
    <>
      <AccountGrowthCard />
      <AccountStreakCard />
    </>
  );
}

type Tab = 'signup' | 'login';

export default function AccountScreen() {
  const t = useT();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const nav = useNavigation();
  const { session, email: acctEmail, lastSyncedAt } = useSync();
  // 上部キャラ＝ホーム(HomeCoach)と同じ選択: 民族衣装 > 背負い筆 > 既定の案内キャラ。装備なしはGUIDE。
  const appState = useAppState();
  const eqBrush = appState.equipped?.brush;
  const isShort = appState.equipped?.hair === 'hair_short';
  const bItem = eqBrush ? SHOP_BY_ID[eqBrush] : undefined;
  const brushImg = bItem ? (isShort ? bItem.homeShort : bItem.homeLong) : undefined;
  const eqCostume = appState.equipped?.costume;
  const costumeImg = eqCostume ? SHOP_BY_ID[eqCostume]?.asset : undefined;
  const heroChar = costumeImg ?? brushImg ?? GUIDE.open;
  const heroFull = !!(costumeImg ?? brushImg); // 全身立ち絵(縦長)か
  const [tab, setTab] = useState<Tab>('signup');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [errKey, setErrKey] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [appleOk, setAppleOk] = useState(false);
  useEffect(() => { void isAppleAvailable().then(setAppleOk); }, []);

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

  const onGoogle = async () => {
    setErrKey(null);
    setConfirmSent(false);
    setBusy(true);
    try {
      const r = await signInWithProvider('google');
      if (r.error === 'cancelled') return; // ユーザーが閉じた=エラー表示しない
      if (r.error) { setErrKey(r.error.startsWith('account.') ? r.error : 'account.err_oauth'); return; }
      nav.goBack(); // 成功→設定へ戻る(SyncProviderがpull/push)
    } finally {
      setBusy(false);
    }
  };

  const onApple = async () => {
    setErrKey(null);
    setConfirmSent(false);
    setBusy(true);
    try {
      const r = await signInWithApple();
      if (r.error === 'cancelled') return;
      if (r.error) { setErrKey(r.error.startsWith('account.') ? r.error : 'account.err_oauth'); return; }
      nav.goBack();
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = email.trim().length > 3 && pw.length >= 8 && !busy;

  // ログイン中は「ログイン中の状態」＋「ログアウト」だけを表示(他カード/アカウント削除は出さない=ユーザー指定)。
  if (session) {
    const syncedLabel = lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString() : t('account.not_synced');
    return (
      <SafeAreaView style={s.c} edges={['top']}>
        <ScrollView contentContainerStyle={s.body}>
          <Pressable style={s.close} onPress={() => nav.goBack()} hitSlop={12}><Text style={s.closeTxt}>✕</Text></Pressable>
          {/* 最上部: 桜(ホームと同じ装備キャラ) + ログイン中 + メールアドレス */}
          <View style={s.hero}>
            <Image source={heroChar} style={heroFull ? s.guideFull : s.guide} resizeMode="contain" />
            <Text style={s.benefitTitle}>{t('account.logged_in_title')}</Text>
            <Text style={s.acctEmail}>{acctEmail}</Text>
            <Text style={s.benefitSub}>{t('account.synced_at', { t: syncedLabel })}</Text>
          </View>
          {/* ログアウトは一番下へ押し下げる */}
          <View style={s.spacer} />
          <Pressable style={s.manageBtn} onPress={() => { void signOut(); }}>
            <Ionicons name="log-out-outline" size={20} color={c.ink} />
            <Text style={s.manageTxt}>{t('account.logout')}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.c} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          <Pressable style={s.close} onPress={() => nav.goBack()} hitSlop={12}>
            <Text style={s.closeTxt}>✕</Text>
          </Pressable>

          <StatCards />

          <View style={s.hero}>
            <Image source={heroChar} style={heroFull ? s.guideFull : s.guide} resizeMode="contain" />
            <Text style={s.benefitTitle}>{t('account.benefit_title')}</Text>
            <Text style={s.benefitSub}>{t('account.benefit_sub')}</Text>
          </View>

          <Pressable style={[s.googleBtn, busy && s.ctaOff]} onPress={onGoogle} disabled={busy}>
            <Ionicons name="logo-google" size={20} color="#EA4335" />
            <Text style={s.googleTxt}>{t('account.google')}</Text>
          </Pressable>
          {appleOk ? (
            <Pressable style={[s.appleBtn, busy && s.ctaOff]} onPress={onApple} disabled={busy}>
              <Ionicons name="logo-apple" size={20} color="#fff" />
              <Text style={s.appleTxt}>{t('account.apple')}</Text>
            </Pressable>
          ) : null}
          <View style={s.divider}>
            <View style={s.divLine} />
            <Text style={s.divTxt}>{t('account.or')}</Text>
            <View style={s.divLine} />
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
    body: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl, flexGrow: 1 },
    spacer: { flex: 1, minHeight: spacing.lg },
    close: { alignSelf: 'flex-end', padding: spacing.xs },
    closeTxt: { fontSize: ty.h2, color: c.mute, fontWeight: '700' },
    hero: { alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
    guide: { width: 120, height: 134 },
    guideFull: { width: 168, height: 230 }, // 全身立ち絵(民族衣装/背負い筆)は縦長(≒864x1184)
    benefitTitle: { fontSize: ty.h2, fontWeight: '800', color: c.ink, textAlign: 'center' },
    benefitSub: { fontSize: ty.small, color: c.mute, textAlign: 'center' },
    acctEmail: { fontSize: ty.body, fontWeight: '800', color: c.ink, textAlign: 'center' },
    manageBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1, borderColor: c.line, borderRadius: radius.md, backgroundColor: c.surface, paddingVertical: spacing.md, marginTop: spacing.md },
    manageTxt: { fontSize: ty.body, fontWeight: '800', color: c.ink },
    deleteRow: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.sm },
    deleteTxt: { fontSize: ty.small, color: c.red, fontWeight: '700' },
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
    googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1, borderColor: c.line, borderRadius: radius.md, backgroundColor: c.surface, paddingVertical: spacing.md },
    googleTxt: { fontSize: ty.body, fontWeight: '800', color: c.ink },
    appleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radius.md, backgroundColor: '#000', paddingVertical: spacing.md, marginTop: spacing.sm },
    appleTxt: { fontSize: ty.body, fontWeight: '800', color: '#fff' },
    divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.xs },
    divLine: { flex: 1, height: 1, backgroundColor: c.line },
    divTxt: { fontSize: ty.small, color: c.faint },
  });
