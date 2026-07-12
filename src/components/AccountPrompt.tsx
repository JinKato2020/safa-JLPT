// 初回起動時(オンボード＋ツアー後・未ログイン時)に一度だけ出すアカウント登録の案内。
// 「登録する」→Account画面へ / 「あとで」→閉じる。どちらも accountPromptSeen=true にして再表示しない。
import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Image } from 'react-native';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useT } from '../i18n';
import { useAppActions } from '../store/store';
import { GUIDE } from '../data/mywordsArt';
import { navigationRef } from '../navigation/navRef';

export default function AccountPrompt() {
  const t = useT();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const { setSettings } = useAppActions();

  const dismiss = () => setSettings({ accountPromptSeen: true });
  const register = () => {
    setSettings({ accountPromptSeen: true });
    if (navigationRef.isReady()) navigationRef.navigate('Account');
  };

  return (
    <View style={s.backdrop}>
      <View style={s.card}>
        <Image source={GUIDE.open} style={s.guide} resizeMode="contain" />
        <Text style={s.title}>{t('account.intro_title')}</Text>
        <Text style={s.body}>{t('account.intro_body')}</Text>
        <Pressable style={s.cta} onPress={register}>
          <Text style={s.ctaTxt}>{t('account.intro_cta')}</Text>
        </Pressable>
        <Pressable style={s.later} onPress={dismiss} hitSlop={8}>
          <Text style={s.laterTxt}>{t('account.intro_later')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg, zIndex: 50 },
    card: { width: '100%', maxWidth: 380, backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: spacing.lg, alignItems: 'center', gap: spacing.sm },
    guide: { width: 110, height: 123, marginBottom: spacing.xs },
    title: { fontSize: ty.h2, fontWeight: '800', color: c.ink, textAlign: 'center' },
    body: { fontSize: ty.body, color: c.ink2, textAlign: 'center', lineHeight: 22 },
    cta: { alignSelf: 'stretch', marginTop: spacing.sm, backgroundColor: c.blue, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
    ctaTxt: { fontSize: ty.body, fontWeight: '800', color: '#fff' },
    later: { paddingVertical: spacing.sm },
    laterTxt: { fontSize: ty.small, color: c.mute, fontWeight: '600' },
  });
