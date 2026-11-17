import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import * as Speech from 'expo-speech';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { useT, useUiLang } from '../i18n';
import { useAppState } from '../store/store';
import { sendEvent } from '../telemetry/telemetry';
import { spacing, useColors } from '../theme';

const FILES = {
  course: require('../../assets/radical-lessons/course.html'),
  human: require('../../assets/radical-lessons/human.html'),
};
const PROGRESS_KEY = 'safa-jlpt:radical-lessons-completed';
const LESSON_ORIGIN = 'https://radical-lessons.invalid';

export default function RadicalLessonsScreen() {
  const navigation = useNavigation();
  const colors = useColors();
  const t = useT();
  const uiLang = useUiLang();
  const level = useAppState().settings.level;
  const [language, setLanguage] = useState(uiLang === 'ja' ? 'ja' : 'en');
  const [page, setPage] = useState<keyof typeof FILES>('course');
  const [initialLevel, setInitialLevel] = useState(level);
  const [template, setTemplate] = useState<string>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const completed = useRef<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [asset, saved] = await Promise.all([
          Asset.fromModule(FILES[page]).downloadAsync(),
          AsyncStorage.getItem(PROGRESS_KEY).catch(() => null),
        ]);
        if (!asset.localUri) throw new Error('Missing lesson asset');
        const html = await new File(asset.localUri).text();
        if (!active) return;
        try { completed.current = { ...JSON.parse(saved ?? '{}'), ...completed.current }; } catch { /* keep current progress */ }
        setTemplate(html);
      } catch {
        if (active) setFailed(true);
      }
    }
    void load();
    return () => { active = false; void Speech.stop(); };
  }, [attempt, page]);

  const source = useMemo(() => template ? {
    baseUrl: LESSON_ORIGIN + '/',
    html: template.replace('/*APP_LESSON_CONFIG*/ {}', JSON.stringify({
      language, level: initialLevel, completed: completed.current,
    }).replaceAll('<', '\\u003c')),
  } : undefined, [template, initialLevel, language]);

  function showPage(next: keyof typeof FILES, nextLanguage = language) {
    setTemplate(undefined);
    setFailed(false);
    setLanguage(nextLanguage);
    setInitialLevel('N5');
    setPage(next);
    if (next === 'human') {
      void sendEvent('screen_view', { name: 'RadicalLessons', content: 'RadicalLesson:human' }, 'N5');
    }
  }

  function onMessage(event: WebViewMessageEvent) {
    let message: Record<string, unknown>;
    try { message = JSON.parse(event.nativeEvent.data) ?? {}; } catch { return; }
    const { type, id, word } = message;
    if (type === 'page' && (message.page === 'course' || message.page === 'human') && message.page !== page) {
      showPage(message.page, message.language === 'ja' ? 'ja' : 'en');
    } else if (type === 'speak' && typeof word === 'string' && word.length <= 60) {
      void Speech.stop().then(() => Speech.speak(word, { language: 'ja-JP', rate: 0.8 })).catch(() => {});
    } else if (typeof id === 'string' && /^[a-z0-9-]{1,32}$/.test(id)) {
      if (type === 'view' && (message.level === 'N3' || message.level === 'N4' || message.level === 'N5')) {
        void sendEvent('screen_view', { name: 'RadicalLessons', content: `RadicalLesson:${id}` }, message.level);
      } else if (type === 'complete') {
        completed.current[id] = true;
        void AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(completed.current)).catch(() => {});
      }
    }
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('mockintro.back')} hitSlop={12}
          onPress={() => page === 'human' ? showPage('course') : navigation.goBack()}>
          <Text style={[styles.back, { color: colors.ink }]}>‹</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.ink }]}>{t('cards.radical_lessons')}</Text>
      </View>
      {failed ? (
        <Pressable accessibilityRole="button" style={styles.center} onPress={() => { setFailed(false); setAttempt(attempt + 1); }}>
          <Text style={{ color: colors.ink }}>{t('dl.retry')}</Text>
        </Pressable>
      ) : source ? (
        <WebView source={source} originWhitelist={['*']}
          onShouldStartLoadWithRequest={({ url }) =>
            url === 'about:blank' || url === LESSON_ORIGIN + '/' || url.startsWith(LESSON_ORIGIN + '/#')}
          onError={() => setFailed(true)} onMessage={onMessage} />
      ) : (
        <View style={styles.center}><ActivityIndicator color={colors.blue} /></View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg },
  back: { fontSize: 36, paddingHorizontal: spacing.xs },
  title: { fontSize: 17, fontWeight: '700', flexShrink: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
