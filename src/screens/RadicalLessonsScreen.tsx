import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { cachedRadicalCourse, syncRadicalCourse } from '../data/radicalCourseRemote';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import { playVocab, stopVocab } from '../data/vocabAudio';
import { vocabIdForWord } from '../words/vocabIndex';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { useT, useUiLang } from '../i18n';
import { useAppState } from '../store/store';
import { sendEvent } from '../telemetry/telemetry';
import { spacing, useColors } from '../theme';

const COURSE = require('../../assets/radical-lessons/course.html');
const PROGRESS_KEY = 'safa-jlpt:radical-lessons-completed';
const LESSON_ORIGIN = 'https://radical-lessons.invalid';

export default function RadicalLessonsScreen() {
  const navigation = useNavigation();
  const colors = useColors();
  const t = useT();
  const uiLang = useUiLang();
  const level = useAppState().settings.level;
  const language = uiLang;
  
  const [template, setTemplate] = useState<string>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [lessonOpen, setLessonOpen] = useState(false);
  const completed = useRef<Record<string, boolean>>({});
  const audioGeneration = useRef(0);
  const webView = useRef<WebView>(null);

  function returnToLessonList() {
    // The WebView lesson is one navigation step inside this native screen.
    // The level hash also works with previously cached course HTML.
    audioGeneration.current++;
    void Speech.stop();
    void stopVocab();
    webView.current?.injectJavaScript(`location.hash=${JSON.stringify(level)};true;`);
    setLessonOpen(false);
  }

  // Covers Android system back and iOS back gestures as well as our header.
  usePreventRemove(lessonOpen && !failed, returnToLessonList);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [asset, saved] = await Promise.all([
          Asset.fromModule(COURSE).downloadAsync(),
          AsyncStorage.getItem(PROGRESS_KEY).catch(() => null),
        ]);
        if (!asset.localUri) throw new Error('Missing lesson asset');
        const cached = await cachedRadicalCourse();
        // 古いOTA教材は日英のみで表示切り替えボタンもあるため、ローカライズ対応版を使う。
        const html = cached?.includes('const RADICAL_LOCALES =') ? cached : await new File(asset.localUri).text();
        void syncRadicalCourse();
        if (!active) return;
        try { completed.current = { ...JSON.parse(saved ?? '{}'), ...completed.current }; } catch { /* keep current progress */ }
        setTemplate(html);
      } catch {
        if (active) setFailed(true);
      }
    }
    void load();
    return () => { active = false; audioGeneration.current++; void Speech.stop(); void stopVocab(); };
  }, [attempt]);

  const source = useMemo(() => template ? {
    baseUrl: LESSON_ORIGIN + '/',
    html: template.replace('/*APP_LESSON_CONFIG*/ {}', JSON.stringify({
      language, level: level, completed: completed.current,
    }).replaceAll('<', '\\u003c')),
  } : undefined, [template, level, language]);

  function onMessage(event: WebViewMessageEvent) {
    let message: Record<string, unknown>;
    try { message = JSON.parse(event.nativeEvent.data) ?? {}; } catch { return; }
    const { type, id, word } = message;
    if (type === 'menu' && message.level === level) {
      setLessonOpen(false);
    } else if (type === 'stop-audio') {
      audioGeneration.current++;
      void Speech.stop();
      void stopVocab();
    } else if (type === 'speak' && typeof word === 'string' && word.length <= 60 &&
      typeof message.reading === 'string' && message.reading.length <= 60 &&
      typeof message.requestId === 'number' && Number.isSafeInteger(message.requestId)) {
      const generation = ++audioGeneration.current;
      const reading = message.reading;
      const requestId = message.requestId;
      const notify = (status: 'recording' | 'speech' | 'error') => {
        if (generation !== audioGeneration.current) return;
        webView.current?.injectJavaScript(`window.onNativeAudioStatus?.(${requestId},${JSON.stringify(status)});true;`);
      };
      void (async () => {
        await Promise.all([Speech.stop(), stopVocab()]);
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true }).catch(() => {});
        if (generation !== audioGeneration.current) return;
        // Same exact word/reading resolver and cached recording player as the dictionary.
        const id = vocabIdForWord(word, reading) ??
          (word === '終わる' && reading === 'おわる' ? vocabIdForWord('終る', reading) : null);
        const played = id ? await playVocab(id) : false;
        if (generation !== audioGeneration.current) return;
        if (played) notify('recording');
        else {
          Speech.speak(reading, { language: 'ja-JP', onError: () => notify('error') });
          notify('speech');
        }
      })().catch(() => notify('error'));
    } else if (typeof id === 'string' && /^[a-z0-9-]{1,32}$/.test(id)) {
      if (type === 'view' && (message.level === level)) {
        setLessonOpen(true);
        void sendEvent('screen_view', { name: 'RadicalLessons', content: `RadicalLesson:${id}` }, level);
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
          onPress={() => lessonOpen && !failed ? returnToLessonList() : navigation.goBack()}>
          <Text style={[styles.back, { color: colors.ink }]}>‹</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.ink }]}>{t('cards.radical_lessons')}</Text>
      </View>
      {failed ? (
        <Pressable accessibilityRole="button" style={styles.center} onPress={() => { setFailed(false); setAttempt(attempt + 1); }}>
          <Text style={{ color: colors.ink }}>{t('dl.retry')}</Text>
        </Pressable>
      ) : source ? (
        <WebView ref={webView} source={source} originWhitelist={['*']}
          onNavigationStateChange={({ url }) => {
            // Older cached lessons did not emit a menu event.
            if (url === LESSON_ORIGIN + '/#' + level) setLessonOpen(false);
          }}
          onShouldStartLoadWithRequest={({ url }) => {
            if (url === 'about:blank' || url === LESSON_ORIGIN + '/' || url.startsWith(LESSON_ORIGIN + '/#')) return true;
            if (/^https:\/\/www\.(kanjipedia\.jp|mext\.go\.jp)\//.test(url)) void Linking.openURL(url).catch(() => {});
            return false;
          }}
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
