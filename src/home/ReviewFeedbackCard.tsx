import { useCallback, useRef, useState } from 'react';
import { Alert, AppState, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAppState } from '../store/store';
import { useT } from '../i18n';
import { useColors, spacing, radius } from '../theme';
import { maybeAskForReview } from '../pro/reviewPrompt';
import { feedbackMailUrl, FEEDBACK_EMAIL } from '../pro/reviewPromptCore';

/** Native review + independent feedback entry, on the same four-day cycle. */
export default function ReviewFeedbackCard({ onBusyChange }: { onBusyChange: (busy: boolean) => void }) {
  const state = useAppState();
  const t = useT();
  const c = useColors();
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);
  const blocked = (state.ticketNotice ?? 0) > 0;

  useFocusEffect(useCallback(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (blocked) { onBusyChange(false); return; }
    const check = () => {
      if (timer) clearTimeout(timer);
      onBusyChange(true);
      timer = setTimeout(async () => {
        const due = await maybeAskForReview(state.installedAt ?? 0);
        if (!active) return;
        if (due) { visibleRef.current = true; setVisible(true); }
        onBusyChange(visibleRef.current);
      }, 700);
    };
    check();
    const sub = AppState.addEventListener('change', next => { if (next === 'active') check(); });
    return () => { active = false; if (timer) clearTimeout(timer); sub.remove(); onBusyChange(false); };
  }, [state.installedAt, blocked, onBusyChange]));

  const dismiss = () => { visibleRef.current = false; setVisible(false); onBusyChange(false); };
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
    <View style={[s.card, { backgroundColor: c.surface, borderColor: c.line }]}>
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
  card: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.lg, zIndex: 40, elevation: 8, padding: spacing.md, borderWidth: 1, borderRadius: radius.lg, gap: spacing.sm },
  title: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  body: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  button: { borderRadius: radius.lg, padding: spacing.sm, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  later: { alignItems: 'center', padding: 8 },
});
