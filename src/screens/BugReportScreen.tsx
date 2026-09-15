// バグ・不具合の報告フォーム。症状を書いてもらい、確認ダイアログを経てから送信する(タップで即送信はしない)。
// 問題画面から開いた時は route.params に問題ID/級/大問/画面名が入り、上部に添付表示＋送信内容へ同梱する。
// 入口は2つ: 設定タブ「サポート・規約」/ 各問題画面ヘッダーの⚠報告(ExamHeader onReport)。
import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useT, useUiLang } from '../i18n';
import { useAppState } from '../store/store';
import { useSync } from '../auth/SyncProvider';
import { submitBugReport, type BugKind } from '../support/bugReportClient';
import type { RootStackParamList } from '../navigation/types';

const KINDS: BugKind[] = ['content', 'bug', 'other'];

export default function BugReportScreen() {
  const t = useT();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const nav = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'BugReport'>>();
  const settings = useAppState().settings;
  const uiLang = useUiLang();
  const { session } = useSync(); // (B) 送信はログイン必須＝未ログインならフォームを出さずログイン導線を出す

  const ctxItemId = route.params?.itemId;
  const ctxDaimon = route.params?.daimon;
  const ctxScreen = route.params?.screen;
  const level = route.params?.level ?? settings.level;

  // 問題から開いた時は「問題の間違い」を既定に。それ以外(設定タブから)は「アプリの不具合」。
  const [kind, setKind] = useState<BugKind>(ctxItemId ? 'content' : 'bug');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const kindLabel = (k: BugKind) => t(k === 'bug' ? 'bug.kind_bug' : k === 'content' ? 'bug.kind_content' : 'bug.kind_other');
  const canSend = msg.trim().length > 0 && !busy;

  const goLogin = () => (nav.navigate as (n: string) => void)('Account');

  const doSend = async () => {
    setBusy(true);
    const r = await submitBugReport({ message: msg, kind, level, uiLang, itemId: ctxItemId, daimon: ctxDaimon, screen: ctxScreen });
    setBusy(false);
    if (r === 'ok') Alert.alert(t('bug.thanksTitle'), t('bug.thanksMsg'), [{ text: t('bug.ok'), onPress: () => nav.goBack() }]);
    else if (r === 'too_soon') Alert.alert(t('bug.failTitle'), t('bug.tooSoon'));           // (C) 連投ガード
    else if (r === 'need_login') Alert.alert(t('bug.loginRequiredTitle'), t('bug.loginRequired')); // (B) ログイン切れ等
    else Alert.alert(t('bug.failTitle'), t('bug.failMsg'));
  };

  // タップで即送信しない=最後に「本当に送るか」確認をはさむ(ユーザー要望)。
  const onSendPress = () => {
    if (!canSend) return;
    Alert.alert(t('bug.confirmTitle'), t('bug.confirmMsg'), [
      { text: t('bug.cancel'), style: 'cancel' },
      { text: t('bug.confirmSend'), onPress: () => { void doSend(); } },
    ]);
  };

  return (
    <SafeAreaView style={s.c}>
      <View style={s.header}>
        <Text style={s.title}>{t('bug.title')}</Text>
        <Pressable onPress={() => nav.goBack()} hitSlop={12} accessibilityLabel={t('nav.close')}><Text style={s.x}>×</Text></Pressable>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          {!session ? (
            /* (B) 未ログイン=フォームを出さず、ログインへ誘導(迷惑な連続送信を防ぐため送信はログイン必須)。 */
            <View style={s.loginBox}>
              <Text style={s.intro}>{t('bug.loginRequired')}</Text>
              <Pressable onPress={goLogin} style={s.sendBtn}><Text style={s.sendTxt}>{t('bug.goLogin')}</Text></Pressable>
            </View>
          ) : (
          <>
          <Text style={s.intro}>{t('bug.intro')}</Text>

          {/* 問題から来た時=対象の問題を添付表示(読み取り専用)。 */}
          {ctxItemId ? (
            <View style={s.ctxBox}>
              <Text style={s.ctxLabel}>{t('bug.contextLabel')}</Text>
              <Text style={s.ctxVal}>{[ctxDaimon, level, ctxItemId].filter(Boolean).join('  ・  ')}</Text>
            </View>
          ) : null}

          {/* 種類 */}
          <Text style={s.label}>{t('bug.kindLabel')}</Text>
          <View style={s.kindRow}>
            {KINDS.map((k) => (
              <Pressable key={k} onPress={() => setKind(k)} style={[s.kindChip, kind === k && s.kindChipOn]}>
                <Text style={[s.kindTxt, kind === k && s.kindTxtOn]}>{kindLabel(k)}</Text>
              </Pressable>
            ))}
          </View>

          {/* 症状・内容(必須) */}
          <Text style={s.label}>{t('bug.symptomLabel')}</Text>
          <TextInput
            style={s.input}
            value={msg}
            onChangeText={setMsg}
            placeholder={t('bug.symptomPlaceholder')}
            placeholderTextColor={c.faint}
            multiline
            textAlignVertical="top"
            maxLength={4000}
          />

          <Pressable onPress={onSendPress} disabled={!canSend} style={[s.sendBtn, !canSend && s.sendBtnOff]}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.sendTxt}>{t('bug.send')}</Text>}
          </Pressable>
          </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    c: { flex: 1, backgroundColor: c.bg },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
    title: { fontSize: ty.h2, fontWeight: '900', color: c.ink },
    x: { fontSize: 26, lineHeight: 28, color: c.mute, fontWeight: '700' },
    body: { padding: spacing.lg, paddingTop: spacing.xs, gap: spacing.sm, paddingBottom: spacing.xl },
    intro: { fontSize: ty.body, color: c.ink2, lineHeight: 22, marginBottom: spacing.xs },
    loginBox: { gap: spacing.md, paddingTop: spacing.md },

    ctxBox: { backgroundColor: c.blueLight, borderRadius: radius.md, padding: spacing.md, gap: 4 },
    ctxLabel: { fontSize: ty.small, fontWeight: '800', color: c.blueDark },
    ctxVal: { fontSize: ty.body, fontWeight: '800', color: c.blueDark },

    label: { fontSize: ty.small, fontWeight: '800', color: c.mute, marginTop: spacing.sm },
    kindRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    kindChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface },
    kindChipOn: { borderColor: c.blue, backgroundColor: c.blueLight },
    kindTxt: { fontSize: ty.body, fontWeight: '700', color: c.ink },
    kindTxtOn: { color: c.blueDark, fontWeight: '900' },

    input: { minHeight: 140, borderWidth: 1, borderColor: c.line, borderRadius: radius.md, backgroundColor: c.surface, padding: spacing.md, fontSize: ty.body, color: c.ink, lineHeight: 22 },

    sendBtn: { marginTop: spacing.md, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: c.blue, minHeight: 50 },
    sendBtnOff: { backgroundColor: c.line },
    sendTxt: { fontSize: ty.body, fontWeight: '900', color: '#fff' },
  });
