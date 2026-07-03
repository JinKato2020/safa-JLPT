import { useEffect, useRef } from 'react';
import { ActivityIndicator, AppState, View, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from './src/theme';
import { useAppFonts, setActiveFont } from './src/theme/fonts';
import WatercolorBackground from './src/components/WatercolorBackground';
import { AppProvider, useAppState, useHydrated } from './src/store/store';
import { useT } from './src/i18n';
import type { RootStackParamList } from './src/navigation/types';
import HomeScreen from './src/screens/HomeScreen';
import StudyScreen from './src/screens/StudyScreen';
import TestScreen from './src/screens/TestScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import QuizScreen from './src/screens/QuizScreen';
import FlashcardScreen from './src/screens/FlashcardScreen';
import MockScreen from './src/screens/MockScreen';
import ReadingScreen from './src/screens/ReadingScreen';
import ListeningScreen from './src/screens/ListeningScreen';
import BrowseScreen from './src/screens/BrowseScreen';
import TourOverlay from './src/components/TourOverlay';
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

const TABS = [
  { name: 'ホーム', component: HomeScreen, icon: 'home', iconOff: 'home-outline', labelKey: 'nav.home' },
  { name: '学習', component: StudyScreen, icon: 'book', iconOff: 'book-outline', labelKey: 'study.tab' },
  { name: 'テスト', component: TestScreen, icon: 'clipboard', iconOff: 'clipboard-outline', labelKey: 'test.tab' },
  { name: '辞書', component: BrowseScreen, icon: 'search', iconOff: 'search-outline', labelKey: 'browse.title' },
  { name: '設定', component: ProfileScreen, icon: 'settings', iconOff: 'settings-outline', labelKey: 'profile.tab' },
] as const;

function MainTabs() {
  const c = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  // ボトムタブの見た目を保ちつつ、画面間を横スワイプで移動可能に(material-top-tabs を下配置)。
  return (
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
  );
}

function Root() {
  const hydrated = useHydrated();
  const state = useAppState();
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
        void sendEvent('app_session', { sec: Math.round((Date.now() - activeSince) / 1000) });
        void flushAnswers();
        fire(true); // 閉じる時=学習後の状態で当日分を上書き(1行のまま)
      }
    });
    return () => sub.remove();
  }, [hydrated]); // eslint-disable-line react-hooks/exhaustive-deps
  // 現在フォントを設定値に同期(このレンダー→配下の全Textが新フォントで描画)。既定=maru(丸ゴシック)。
  setActiveFont(settings.font ?? 'maru');
  const sys = useColorScheme();
  const scheme = settings.theme === 'auto' ? (sys ?? 'light') : settings.theme;
  // 水彩背景(ライトモードのみ)。有効時はナビ背景を透明化して背後の水彩レイヤーを見せる。
  const skin = scheme === 'light' && settings.bgSkin && settings.bgSkin !== 'none' ? settings.bgSkin : null;
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
    <NavigationContainer key={`${settings.font ?? 'maru'}-${settings.bgSkin ?? 'none'}`} theme={navTheme} onStateChange={(st) => { const n = activeRouteName(st); if (n) void sendEvent('screen_view', { name: n }); }}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {!settings.onboarded ? (
          <RootStack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          <>
            <RootStack.Screen name="Main" component={MainTabs} />
            <RootStack.Screen name="Quiz" component={QuizScreen} options={{ presentation: 'modal' }} />
            <RootStack.Screen name="Flashcard" component={FlashcardScreen} options={{ presentation: 'modal' }} />
            <RootStack.Screen name="Mock" component={MockScreen} options={{ presentation: 'modal' }} />
            <RootStack.Screen name="Reading" component={ReadingScreen} options={{ presentation: 'modal' }} />
            <RootStack.Screen name="Listening" component={ListeningScreen} options={{ presentation: 'modal' }} />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
    {settings.onboarded && !settings.tourDone && <TourOverlay />}
    </View>
    </DesignThemeProvider>
  );
}

export default function App() {
  const [fontsLoaded] = useAppFonts();
  // フォント読込前は端末既定で表示(白画面回避)。読込後に丸ゴシック等へ差し替わる。
  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#0b1220' }} />;
  }
  return (
    <AppProvider>
      <SafeAreaProvider>
        <Root />
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </AppProvider>
  );
}
