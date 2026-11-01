import { useCallback, useRef, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAppState } from '../store/store';
import { useT } from '../i18n';
import { useColors, spacing, radius } from '../theme';
import { maybeAskForReview } from '../pro/reviewPrompt';
import { feedbackMailUrl, FEEDBACK_EMAIL } from '../pro/reviewPromptCore';

/** 学習完了画面だけで、約4日ごとの評価・要望案内を出す。 */
export default function ReviewFeedbackCard({ completed, floating = false }: { completed: boolean; floating?: boolean }) {
  const state = useAppState();
  const t = useT();
  const c = useColors();
  const [visible, setVisible] = useState(false);
  const checkedRef = useRef(false);

  useFocusEffect(useCallback(() => {
    if (!completed || checkedRef.current) return;
    let active = true;
    const timer = setTimeout(async () => {
      checkedRef.current = true;
      const due = await maybeAskForReview(state.installedAt ?? 0, completed);
      if (active && due) setVisible(true);
    }, 700);
    return () => { active = false; clearTimeout(timer); };
  }, [state.installedAt, completed]));

  const dismiss = () => setVisible(false);
  const send = async () => {
    try {
      await Linking.openURL(feedbackMailUrl(t('feedback.subject')));
      dismiss();
    } catch {
      Alert.alert(t('feedback.title'), t('feedback.email_error', { email: FEEDBACK_EMAIL }));
    }
  };
  if (!visible) return null;
  return (
    <View style={[s.card, floating && s.floating, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Text style={[s.title, { color: c.ink }]}>{t('feedback.title')}</Text>
      <Text style={[s.body, { color: c.ink2 }]}>{t('feedback.body')}</Text>
      <Pressable accessibilityRole="button" onPress={send} style={[s.button, { backgroundColor: c.blue }]}>
        <Text style={s.buttonText}>{t('feedback.send')}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={dismiss} hitSlop={8} style={s.later}>
        <Text style={{ color: c.mute }}>{t('weekly.later')}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  card: { width: '100%', marginVertical: spacing.sm, padding: spacing.md, borderWidth: 1, borderRadius: radius.lg, gap: spacing.sm },
  floating: { position: 'absolute', width: undefined, left: spacing.md, right: spacing.md, bottom: spacing.lg, zIndex: 40, elevation: 8 },
  title: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  body: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  button: { borderRadius: radius.lg, padding: spacing.sm, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  later: { alignItems: 'center', padding: 8 },
});
