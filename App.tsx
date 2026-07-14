import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Modal, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, useNavigation, useNavigationState } from '@react-navigation/native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { createNativeStackNavigator, type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from './src/theme';
import { useAppFonts, setActiveFont } from './src/theme/fonts';
import WatercolorBackground from './src/components/WatercolorBackground';
import { AppProvider, useAppState, useAppActions, useHydrated } from './src/store/store';
import { SyncProvider, useSync } from './src/auth/SyncProvider';
import { navigationRef } from './src/navigation/navRef';
import AccountPrompt from './src/components/AccountPrompt';
import { isWatercolor } from './src/store/state';
import { useT } from './src/i18n';
import type { RootStackParamList, WordsStackParamList, DictStackParamList, StudyStackParamList } from './src/navigation/types';
import HomeScreen from './src/screens/HomeScreen';
import StudyHomeScreen from './src/screens/StudyHomeScreen';
import StudyCategoryScreen from './src/screens/StudyCategoryScreen';
import WordsHubScreen from './src/screens/WordsHubScreen';
import DictHomeScreen from './src/screens/DictHomeScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import QuizScreen from './src/screens/QuizScreen';
import FlashcardScreen from './src/screens/FlashcardScreen';
import MockScreen from './src/screens/MockScreen';
import MockIntroScreen from './src/screens/MockIntroScreen';
import ReadingScreen from './src/screens/ReadingScreen';
import PassageGrammarScreen from './src/screens/PassageGrammarScreen';
import ListeningScreen from './src/screens/ListeningScreen';
import BrowseScreen from './src/screens/BrowseScreen';
import CardsScreen from './src/screens/CardsScreen';
import KakitoriScreen from './src/screens/KakitoriScreen';
import KanjiDetailScreen from './src/screens/KanjiDetailScreen';
import ListeningQuizScreen from './src/screens/ListeningQuizScreen';
import WordDrillScreen from './src/screens/WordDrillScreen';
import MyWordsScreen from './src/screens/MyWordsScreen';
import AccountScreen from './src/screens/AccountScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import ShopScreen from './src/screens/ShopScreen';
import { walletPoints } from './src/store/wallet';
import TourOverlay from './src/components/TourOverlay';
import SafeBoundary from './src/components/SafeBoundary';
import { DesignThemeProvider } from './shared/JLPT-Listening/design';
import { setTelemetryEnabled, sendDailySnapshot, sendEvent, sendError, flushAnswers } from './src/telemetry/telemetry';

// ナビゲーション状態から現在の画面名(最深ルート)を取得。
function activeRouteName(navState: unknown): string | undefined {
  const st = navState as { index?: number; routes?: { name: string; state?: unknown }[] } | undefined;
  if (!st || typeof st.index !== 'number' || !st.routes) return undefined;
  const route = st.routes[st.index];
  return route?.state ? activeRouteName(route.state) : route?.name;
}

const Tab = createMaterialTopTabNavigator();
const RootStack = createNativeStackNavigator<RootStackParamList>();
const WordsStack = createNativeStackNavigator<WordsStackParamList>();
function WordsTab() {
  // 単語タブ: 世界観ハブ(WordsHome) → 区分の練習ホーム(WordKubun=CardsScreen) → 学習リスト(WordList=BrowseScreen)。
  return (
    <WordsStack.Navigator screenOptions={{ headerShown: false }}>
      <WordsStack.Screen name="WordsHome" component={WordsHubScreen} />
      <WordsStack.Screen name="WordKubun" component={CardsScreen} />
      <WordsStack.Screen name="WordList" component={BrowseScreen} initialParams={{ mode: 'study' }} />
    </WordsStack.Navigator>
  );
}
const DictStack = createNativeStackNavigator<DictStackParamList>();
function DictTab() {
  // 辞書タブ: 没入する図書館ホーム(DictHome) → 各辞書リスト(DictList=BrowseScreen)。My単語帳はRootStackモーダル。
  return (
    <DictStack.Navigator screenOptions={{ headerShown: false }}>
      <DictStack.Screen name="DictHome" component={DictHomeScreen} />
      <DictStack.Screen name="DictList" component={BrowseScreen} />
    </DictStack.Navigator>
  );
}
const StudyStack = createNativeStackNavigator<StudyStackParamList>();
function StudyTab() {
  // 試験タブ: 世界観タイルホーム(StudyHome) → 各カテゴリ詳細(StudyCategory)。
  return (
    <StudyStack.Navigator screenOptions={{ headerShown: false }}>
      <StudyStack.Screen name="StudyHome" component={StudyHomeScreen} />
      <StudyStack.Screen name="StudyCategory" component={StudyCategoryScreen} />
    </StudyStack.Navigator>
  );
}

const TABS = [
  { name: 'ホーム', component: HomeScreen, icon: 'home', iconOff: 'home-outline', labelKey: 'nav.home' },
  { name: '単語', component: WordsTab, icon: 'language', iconOff: 'language-outline', labelKey: 'cards.tab' },
  { name: '学習', component: StudyTab, icon: 'book', iconOff: 'book-outline', labelKey: 'study.tab' },
  { name: '辞書', component: DictTab, icon: 'library', iconOff: 'library-outline', labelKey: 'dict.tab' },
] as const;

const JLPT_LEVELS = ['N5', 'N4', 'N3'] as const;

function MainTabs() {
  const c = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const state = useAppState();
  const { setSettings } = useAppActions();
  const [lvlOpen, setLvlOpen] = useState(false);
  // 辞書リスト(DictList)・単語の学習リスト(WordList)では上部の共通アイコン列を隠す(各画面自身に×/←戻り＋見出しがある)。
  const hideTopBar = useNavigationState((s) => { const n = activeRouteName(s); return n === 'DictList' || n === 'WordList'; });
  const isJft = (state.settings.targetExam ?? 'jlpt') === 'jft';
  const level = state.settings.level;
  // ボトムタブの見た目を保ちつつ、画面間を横スワイプで移動可能に(material-top-tabs を下配置)。
  // 設定タブは廃止 → 画面上部に共通の操作列(左から): アカウント/JLPTレベル/設定/通知。
  const iconBtn = [topBar.btn, { backgroundColor: c.surface, borderColor: c.line }];
  return (
    <View style={{ flex: 1 }}>
    <Tab.Navigator
      tabBarPosition="bottom"
      screenOptions={{
        swipeEnabled: true,
        lazy: true,
        tabBarActiveTintColor: c.blue,
        tabBarInactiveTintColor: c.faint,
        tabBarShowIcon: true,
        tabBarPressColor: 'transparent',
        tabBarLabelStyle: { fontSize: 10, textTransform: 'none', margin: 0, marginTop: 2 },
        tabBarItemStyle: { paddingVertical: 4 },
        tabBarIndicatorStyle: { height: 0 }, // 上のインジケータ線は隠す(ボトムナビ風)
        tabBarStyle: {
          backgroundColor: c.surface,
          borderTopWidth: 1,
          borderTopColor: c.line,
          height: 54 + insets.bottom,
          paddingBottom: insets.bottom,
          elevation: 0,
          shadowOpacity: 0,
        },
      }}
    >
      {TABS.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          options={{
            tabBarLabel: t(tab.labelKey),
            tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? tab.icon : tab.iconOff} size={22} color={color} />,
          }}
        />
      ))}
    </Tab.Navigator>
      {/* 全タブ共通の上部操作列(左から): アカウント / JLPTレベル / 設定 / 通知。辞書リストでは非表示。 */}
      {!hideTopBar && (
      <View style={[topBar.row, { top: insets.top + 6 }]}>
        <Pressable onPress={() => nav.navigate('Account')} accessibilityLabel={t('account.title')} hitSlop={6} style={iconBtn}>
          <Ionicons name="person-circle-outline" size={26} color={c.ink} />
        </Pressable>
        <Pressable
          onPress={() => { if (!isJft) setLvlOpen(true); }}
          accessibilityLabel={t('profile.targetLevel')}
          hitSlop={6}
          style={[topBar.pill, { backgroundColor: c.surface, borderColor: c.line }]}
        >
          <Text style={[topBar.pillTxt, { color: c.blue }]}>{isJft ? 'JFT' : level}</Text>
        </Pressable>
        <Pressable onPress={() => nav.navigate('Settings')} accessibilityLabel={t('profile.title')} hitSlop={6} style={iconBtn}>
          <Ionicons name="settings-outline" size={22} color={c.ink} />
        </Pressable>
        <Pressable onPress={() => nav.navigate('Notifications')} accessibilityLabel={t('notif.title')} hitSlop={6} style={iconBtn}>
          <Ionicons name="notifications-outline" size={22} color={c.ink} />
        </Pressable>
        <Pressable onPress={() => nav.navigate('Shop')} accessibilityLabel={t('shop.title')} hitSlop={6} style={[topBar.pill, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Text style={[topBar.pillTxt, { color: c.ink }]}>🐚 {walletPoints(state)}</Text>
        </Pressable>
      </View>
      )}
      {/* JLPTレベルの選択メニュー(N5/N4/N3)。レベルピル直下に出す。 */}
      <Modal visible={lvlOpen} transparent animationType="fade" onRequestClose={() => setLvlOpen(false)}>
        <Pressable style={topBar.backdrop} onPress={() => setLvlOpen(false)}>
          <View style={[topBar.menu, { top: insets.top + 50, backgroundColor: c.surface, borderColor: c.line }]}>
            {JLPT_LEVELS.map((lv) => {
              const on = level === lv;
              return (
                <Pressable key={lv} onPress={() => { setSettings({ level: lv, targetExam: 'jlpt' }); setLvlOpen(false); }} style={topBar.menuItem}>
                  <Text style={[topBar.menuTxt, { color: on ? c.blue : c.ink2 }, on && { fontWeight: '900' }]}>{lv}</Text>
                  {on ? <Text style={[topBar.menuCheck, { color: c.blue }]}>✓</Text> : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const topBar = StyleSheet.create({
  row: { position: 'absolute', left: 12, flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 20 },
  btn: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 5,
  },
  pill: {
    height: 40, minWidth: 46, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 5,
  },
  pillTxt: { fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  backdrop: { flex: 1 },
  menu: { position: 'absolute', left: 60, minWidth: 92, borderRadius: 14, borderWidth: 1, paddingVertical: 4, overflow: 'hidden', elevation: 8, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 16 },
  menuTxt: { fontSize: 16, fontWeight: '700' },
  menuCheck: { fontSize: 15, fontWeight: '900' },
});

function Root() {
  const hydrated = useHydrated();
  const state = useAppState();
  const { addStudySeconds } = useAppActions();
  const { session } = useSync();
  const { settings } = state;
  const stateRef = useRef(state);
  stateRef.current = state;
  const c = useColors();

  // 匿名計測: 日次スナップショット＋アプリ往来/滞在＋回答flush＋クラッシュ報告。
  useEffect(() => {
    if (!hydrated) return;
    setTelemetryEnabled(stateRef.current.settings.telemetry !== false);
    // クラッシュ/エラーを匿名報告(既存ハンドラはそのまま呼ぶ)。
    const g = global as unknown as { ErrorUtils?: { getGlobalHandler?: () => ((e: unknown, f?: boolean) => void); setGlobalHandler?: (h: (e: unknown, f?: boolean) => void) => void } };
    const prev = g.ErrorUtils?.getGlobalHandler?.();
    g.ErrorUtils?.setGlobalHandler?.((e: unknown, isFatal?: boolean) => {
      try { void sendError((e as { message?: string })?.message || String(e), !!isFatal); } catch { /* noop */ }
      prev?.(e, isFatal);
    });
    let activeSince = Date.now();
    const fire = (force: boolean) => {
      setTelemetryEnabled(stateRef.current.settings.telemetry !== false);
      void sendDailySnapshot(stateRef.current, Date.now(), force);
    };
    fire(false);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') { activeSince = Date.now(); fire(false); }
      else if (s === 'background') {
        const sec = Math.round((Date.now() - activeSince) / 1000);
        if (sec > 0 && sec < 6 * 3600) addStudySeconds(sec); // 前面滞在秒を累計学習時間へ(異常値は加算しない)
        void sendEvent('app_session', { sec });
        void flushAnswers();
        fire(true); // 閉じる時=学習後の状態で当日分を上書き(1行のまま)
      }
    });
    return () => sub.remove();
  }, [hydrated]); // eslint-disable-line react-hooks/exhaustive-deps
  // 現在フォントを設定値に同期(このレンダー→配下の全Textが新フォントで描画)。既定=maru(丸ゴシック)。
  setActiveFont(settings.font ?? 'maru');
  const sys = useColorScheme();
  // 水彩テーマ(桜/空/緑/藤/茜)はライト系。ナビ背景を透明化して背後の水彩レイヤーを見せる。
  const skin = isWatercolor(settings.theme) ? settings.theme : null;
  const scheme: 'light' | 'dark' = skin ? 'light' : settings.theme === 'auto' ? (sys ?? 'light') : settings.theme === 'dark' ? 'dark' : 'light';
  const navTheme = {
    ...DefaultTheme,
    colors: { ...DefaultTheme.colors, background: skin ? 'transparent' : c.bg, card: c.surface, text: c.ink, border: c.line, primary: c.blue },
  };

  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
        <ActivityIndicator color={c.blue} />
      </View>
    );
  }

  return (
    <DesignThemeProvider scheme={scheme}>
    <View style={{ flex: 1, backgroundColor: c.bg }}>
    {skin ? <WatercolorBackground skin={skin} /> : null}
    <NavigationContainer ref={navigationRef} key={`${settings.font ?? 'maru'}-${settings.theme ?? 'auto'}`} theme={navTheme} onStateChange={(st) => { const n = activeRouteName(st); if (n) void sendEvent('screen_view', { name: n }); }}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {!settings.onboarded ? (
          <RootStack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          <>
            <RootStack.Screen name="Main" component={MainTabs} />
            <RootStack.Screen name="Quiz" component={QuizScreen} options={{ presentation: 'modal' }} />
            <RootStack.Screen name="Flashcard" component={FlashcardScreen} options={{ presentation: 'modal' }} />
            <RootStack.Screen name="MockIntro" component={MockIntroScreen} options={{ presentation: 'modal' }} />
            <RootStack.Screen name="Mock" component={MockScreen} options={{ presentation: 'modal' }} />
            <RootStack.Screen name="Reading" component={ReadingScreen} options={{ presentation: 'modal' }} />
            <RootStack.Screen name="PassageGrammar" component={PassageGrammarScreen} options={{ presentation: 'modal' }} />
            <RootStack.Screen name="Listening" component={ListeningScreen} options={{ presentation: 'modal' }} />
            <RootStack.Screen name="Kakitori" component={KakitoriScreen} options={{ presentation: 'modal' }} />
            <RootStack.Screen name="KanjiDetail" component={KanjiDetailScreen} options={{ presentation: 'modal' }} />
            <RootStack.Screen name="ListeningQuiz" component={ListeningQuizScreen} options={{ presentation: 'modal' }} />
            <RootStack.Screen name="WordDrill" component={WordDrillScreen} options={{ presentation: 'modal' }} />
            <RootStack.Screen name="MyWords" component={MyWordsScreen} options={{ presentation: 'modal' }} />
            <RootStack.Screen name="Account" component={AccountScreen} options={{ presentation: 'modal' }} />
            <RootStack.Screen name="Settings" component={ProfileScreen} options={{ presentation: 'modal' }} />
            <RootStack.Screen name="Notifications" component={NotificationsScreen} options={{ presentation: 'modal' }} />
            <RootStack.Screen name="Shop" component={ShopScreen} options={{ presentation: 'modal' }} />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
    {settings.onboarded && !settings.tourDone && <TourOverlay />}
    {settings.onboarded && settings.tourDone && !session && !settings.accountPromptSeen && <AccountPrompt />}
    </View>
    </DesignThemeProvider>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useAppFonts();
  // フォント読込前は端末既定で表示(白画面回避)。読込後に丸ゴシック等へ差し替わる。
  // 読込エラー時は待たずに端末既定フォントで起動する(フォント失敗でスプラッシュに固着させない)。
  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: '#0b1220' }} />;
  }
  // 防波堤はプロバイダの外側に置く(プロバイダ初期化中の例外も捕捉。native例外は捕捉不可)。
  return (
    <SafeBoundary
      tag="app"
      fallback={(
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#0b1220' }}>
          <Text style={{ color: '#fff', fontSize: 16, textAlign: 'center', lineHeight: 24 }}>
            問題が発生しました。アプリを再起動してください。{'\n'}Something went wrong. Please restart the app.
          </Text>
        </View>
      )}
    >
      <AppProvider>
        <SyncProvider>
          <SafeAreaProvider>
            <Root />
            <StatusBar style="auto" />
          </SafeAreaProvider>
        </SyncProvider>
      </AppProvider>
    </SafeBoundary>
  );
}
