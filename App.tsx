import { useEffect, useRef } from 'react';
import { ActivityIndicator, AppState, View, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useColors } from './src/theme';
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
import GrammarScreen from './src/screens/GrammarScreen';
import MockScreen from './src/screens/MockScreen';
import ReadingScreen from './src/screens/ReadingScreen';
import ListeningScreen from './src/screens/ListeningScreen';
import BrowseScreen from './src/screens/BrowseScreen';
import TourOverlay from './src/components/TourOverlay';
import { DesignThemeProvider } from './src/shared-design';
import { setTelemetryEnabled, sendDailySnapshot } from './src/telemetry/telemetry';

const Tab = createBottomTabNavigator();
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
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.blue,
        tabBarInactiveTintColor: c.faint,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.line },
      }}
    >
      {TABS.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          options={{
            tabBarLabel: t(tab.labelKey),
            tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? tab.icon : tab.iconOff} size={size ?? 24} color={color} />,
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

  // 匿名計測(v1.1): 前面化ごとに日次スナップショット(モジュール側で1日1回に抑制)＋キュー再送。
  useEffect(() => {
    if (!hydrated) return;
    const fire = () => {
      setTelemetryEnabled(stateRef.current.settings.telemetry !== false);
      void sendDailySnapshot(stateRef.current, Date.now());
    };
    fire();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') fire(); });
    return () => sub.remove();
  }, [hydrated]); // eslint-disable-line react-hooks/exhaustive-deps
  const sys = useColorScheme();
  const scheme = settings.theme === 'auto' ? (sys ?? 'light') : settings.theme;
  const navTheme = {
    ...DefaultTheme,
    colors: { ...DefaultTheme.colors, background: c.bg, card: c.surface, text: c.ink, border: c.line, primary: c.blue },
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
    <NavigationContainer theme={navTheme}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {!settings.onboarded ? (
          <RootStack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          <>
            <RootStack.Screen name="Main" component={MainTabs} />
            <RootStack.Screen name="Quiz" component={QuizScreen} options={{ presentation: 'modal' }} />
            <RootStack.Screen name="Flashcard" component={FlashcardScreen} options={{ presentation: 'modal' }} />
            <RootStack.Screen name="Grammar" component={GrammarScreen} options={{ presentation: 'modal' }} />
            <RootStack.Screen name="Mock" component={MockScreen} options={{ presentation: 'modal' }} />
            <RootStack.Screen name="Reading" component={ReadingScreen} options={{ presentation: 'modal' }} />
            <RootStack.Screen name="Listening" component={ListeningScreen} options={{ presentation: 'modal' }} />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
    {settings.onboarded && !settings.tourDone && <TourOverlay />}
    </DesignThemeProvider>
  );
}

export default function App() {
  return (
    <AppProvider>
      <SafeAreaProvider>
        <Root />
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </AppProvider>
  );
}
