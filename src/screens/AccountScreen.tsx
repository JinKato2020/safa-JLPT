// アカウント作成/ログイン(段階1)。メール+パスワード。確認メールON=新規作成後は確認案内→ログイン。
// 案内=桜の巫女(既存アセット GUIDE.open)。文言は i18n(個人名を使わない)。
import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Image, ActivityIndicator, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useT, useUiLang } from '../i18n';
import { signUp, signIn, signOut } from '../auth/authClient';
import { signInWithProvider, signInWithApple, isAppleAvailable } from '../auth/oauth';
import { mapAuthError } from '../auth/authErrors';
import { useAppState, useAppActions } from '../store/store';
import { avatarOf, AVATARS } from '../plaza/avatars';
import { flagOf, countryLabel } from '../plaza/countries';
import { PERSONALITIES, MOOD_MESSAGES, personalityOf, moodMsgOf } from '../plaza/persona';
import { useSync } from '../auth/SyncProvider';
import ExamInfoCard from '../home/ExamInfoCard';

type Tab = 'signup' | 'login';

export default function AccountScreen() {
  const t = useT();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { session, email: acctEmail, lastSyncedAt } = useSync();
  // 最上部プロフィール: 桜ではなく自分のアバター立ち絵＋ステータス(レベル/国/性別/性格/ムード)。性格・ムードは変更可。
  const appState = useAppState();
  const { setSettings } = useAppActions();
  const uiLang = useUiLang();
  const st0 = appState.settings;
  const myAvatarImg = avatarOf(st0.avatar).image;
  const per = personalityOf(st0.personality);
  const moodTxt = moodMsgOf(st0.moodMsg);
  const [pickerOpen, setPickerOpen] = useState<null | 'personality' | 'mood' | 'avatar'>(null);
  const profileHeader = (
    <View style={s.profHeader}>
      <Pressable onPress={() => setPickerOpen('avatar')} style={s.profAvatarWrap} accessibilityLabel="アバターを変更">
        {myAvatarImg != null
          ? <Image source={myAvatarImg} style={s.profAvatar} resizeMode="contain" />
          : <View style={s.profAvatar} />}
        <View style={s.profAvatarEdit}><Ionicons name="pencil" size={12} color="#fff" /></View>
      </Pressable>
      <View style={s.profStats}>
        {st0.nickname ? <Text style={s.profName}>{flagOf(st0.country ?? 'XX')} {st0.nickname}</Text> : null}
        <View style={s.profRow}><Text style={s.profK}>レベル</Text><Text style={s.profV}>{st0.level}</Text></View>
        <View style={s.profRow}><Text style={s.profK}>国</Text><Text style={s.profV}>{flagOf(st0.country ?? 'XX')} {countryLabel(st0.country, uiLang)}</Text></View>
        <View style={s.profRow}><Text style={s.profK}>性別</Text><Text style={s.profV}>{t(st0.gender === 'f' ? 'onboarding.gender_f' : 'onboarding.gender_m')}</Text></View>
        <Pressable style={s.profRow} onPress={() => setPickerOpen('personality')}>
          <Text style={s.profK}>性格</Text>
          <View style={s.profVrow}><Text style={s.profV}>{per ? `${per.emoji} ${per.label}` : '選ぶ'}</Text><Ionicons name="chevron-forward" size={15} color={c.faint} /></View>
        </Pressable>
        <Pressable style={s.profRow} onPress={() => setPickerOpen('mood')}>
          <Text style={s.profK}>ムード</Text>
          <View style={s.profVrow}><Text style={s.profV} numberOfLines={1}>{moodTxt ?? '選ぶ'}</Text><Ionicons name="chevron-forward" size={15} color={c.faint} /></View>
        </Pressable>
      </View>
    </View>
  );
  const pickerModal = (
    <Modal visible={pickerOpen !== null} transparent animationType="slide" onRequestClose={() => setPickerOpen(null)}>
      <Pressable style={s.pickBackdrop} onPress={() => setPickerOpen(null)} />
      <View style={s.pickSheet}>
        <Text style={s.pickTitle}>{pickerOpen === 'avatar' ? 'アバターを選ぶ' : pickerOpen === 'personality' ? '性格を選ぶ' : 'ムードメッセージを選ぶ'}</Text>
        <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ paddingBottom: 8 }}>
          {pickerOpen === 'avatar' ? (
            <View style={s.avGrid}>
              {AVATARS.map((a) => {
                const on = st0.avatar === a.code;
                return (
                  <Pressable key={a.code} style={[s.avCell, on && s.avCellOn]} onPress={() => { setSettings({ avatar: a.code, gender: a.gender }); setPickerOpen(null); }}>
                    {a.image != null ? <Image source={a.image} style={s.avImg} resizeMode="contain" /> : <Text style={s.avEmoji}>{a.emoji}</Text>}
                    {on && <View style={s.avCheck}><Text style={s.avCheckT}>✓</Text></View>}
                  </Pressable>
                );
              })}
            </View>
          ) : pickerOpen === 'personality'
            ? PERSONALITIES.map((p) => {
                const on = st0.personality === p.key;
                return (
                  <Pressable key={p.key} style={[s.pickRow, on && s.pickRowOn]} onPress={() => { setSettings({ personality: p.key }); setPickerOpen(null); }}>
                    <Text style={[s.pickRowTxt, on && s.pickRowTxtOn]}>{p.emoji} {p.label}</Text>
                    {on && <Text style={s.pickCheck}>✓</Text>}
                  </Pressable>
                );
              })
            : MOOD_MESSAGES.map((m) => {
                const on = st0.moodMsg === m.key;
                return (
                  <Pressable key={m.key} style={[s.pickRow, on && s.pickRowOn]} onPress={() => { setSettings({ moodMsg: m.key }); setPickerOpen(null); }}>
                    <Text style={[s.pickRowTxt, on && s.pickRowTxtOn]}>{m.text}</Text>
                    {on && <Text style={s.pickCheck}>✓</Text>}
                  </Pressable>
                );
              })}
        </ScrollView>
      </View>
    </Modal>
  );
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
          {/* 最上部: 自分のアバター＋ステータス(左にアバター/右にレベル・国・性別・性格・ムード) */}
          {profileHeader}
          <View style={s.loginMeta}>
            <Text style={s.benefitTitle}>{t('account.logged_in_title')}</Text>
            <Text style={s.acctEmail}>{acctEmail}</Text>
            <Text style={s.benefitSub}>{t('account.synced_at', { t: syncedLabel })}</Text>
          </View>
          {/* 最終同期の下に試験情報カード(試験日/残日数/申込期間/費用)。ホームのリングシートから移設。 */}
          <ExamInfoCard />
          {/* 友だち紹介(設定画面から移設)。コード発行にアカウントが要るのでログイン中だけ表示。 */}
          <Pressable style={s.referralRow} onPress={() => nav.navigate('Referral')}>
            <View style={s.referralIco}><Ionicons name="gift-outline" size={20} color={c.blue} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.referralTitle}>{t('referral.title')}</Text>
              <Text style={s.referralSub}>{t('referral.subhead')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.faint} />
          </Pressable>
          {/* ログアウトは一番下へ押し下げる */}
          <View style={s.spacer} />
          <Pressable style={s.manageBtn} onPress={() => { void signOut(); }}>
            <Ionicons name="log-out-outline" size={20} color={c.ink} />
            <Text style={s.manageTxt}>{t('account.logout')}</Text>
          </Pressable>
        </ScrollView>
        {pickerModal}
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

          {profileHeader}
          <View style={s.loginMeta}>
            <Text style={s.benefitTitle}>{t('account.benefit_title')}</Text>
            <Text style={s.benefitSub}>{t('account.benefit_sub')}</Text>
          </View>

          {/* 未ログインでも直近の試験情報カードを表示(試験日/残日数/申込期間/費用)。 */}
          <ExamInfoCard />

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
      {pickerModal}
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
    // 最上部プロフィール(アバター左＋ステータス右)
    profHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm, marginBottom: spacing.md },
    profAvatarWrap: { width: 108, height: 116 },
    profAvatar: { width: 108, height: 116 },
    profAvatarEdit: { position: 'absolute', right: 2, bottom: 2, width: 26, height: 26, borderRadius: 13, backgroundColor: c.blue, borderWidth: 2, borderColor: c.bg, alignItems: 'center', justifyContent: 'center' },
    // アバター選択グリッド
    avGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', paddingVertical: 4 },
    avCell: { width: 92, height: 100, borderRadius: radius.lg, borderWidth: 2, borderColor: c.line, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' },
    avCellOn: { borderColor: c.blue, backgroundColor: c.blueLight },
    avImg: { width: 84, height: 92 },
    avEmoji: { fontSize: 44 },
    avCheck: { position: 'absolute', right: 4, top: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: c.blue, alignItems: 'center', justifyContent: 'center' },
    avCheckT: { color: '#fff', fontSize: 13, fontWeight: '900' },
    profStats: { flex: 1, gap: 2 },
    profName: { fontSize: ty.body, fontWeight: '900', color: c.ink, marginBottom: 4 },
    profRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line },
    profK: { fontSize: ty.small, color: c.mute, fontWeight: '700' },
    profV: { fontSize: ty.body, color: c.ink, fontWeight: '800', flexShrink: 1, textAlign: 'right' },
    profVrow: { flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 1 },
    loginMeta: { alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
    // 性格/ムードのリスト選択
    pickBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
    pickSheet: { backgroundColor: c.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 24 },
    pickTitle: { fontSize: ty.body, fontWeight: '900', color: c.ink, marginBottom: 10, textAlign: 'center' },
    pickRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 14, borderRadius: radius.lg, marginBottom: 4 },
    pickRowOn: { backgroundColor: c.blueLight },
    pickRowTxt: { fontSize: ty.body, color: c.ink, fontWeight: '700' },
    pickRowTxtOn: { color: c.blue, fontWeight: '900' },
    pickCheck: { fontSize: 16, color: c.blue, fontWeight: '900' },
    benefitTitle: { fontSize: ty.h2, fontWeight: '800', color: c.ink, textAlign: 'center' },
    benefitSub: { fontSize: ty.small, color: c.mute, textAlign: 'center' },
    acctEmail: { fontSize: ty.body, fontWeight: '800', color: c.ink, textAlign: 'center' },
    referralRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: c.line, borderRadius: radius.lg, backgroundColor: c.surface, padding: spacing.md, marginTop: spacing.sm },
    referralIco: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: c.blueLight, alignItems: 'center', justifyContent: 'center' },
    referralTitle: { fontSize: ty.body, fontWeight: '800', color: c.ink },
    referralSub: { fontSize: ty.small, color: c.mute, marginTop: 1 },
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
