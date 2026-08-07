import { useEffect, useRef } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, useNavigation, useNavigationState, StackActions } from '@react-navigation/native';
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
import { useT, useUiLang } from './src/i18n';
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
import AICoachScreen from './src/screens/AICoachScreen';
import QuestionReviewScreen from './src/screens/QuestionReviewScreen';
import PaywallScreen from './src/screens/PaywallScreen';
import ReferralScreen from './src/screens/ReferralScreen';
import KotobaTownScreen from './src/screens/KotobaTownScreen';
import InviteScreen from './src/screens/InviteScreen';
import { initPurchases, syncEntitlement, linkAccount, unlinkAccount } from './src/pro/purchases';
import { initAds } from './src/pro/ads';
import { walletPoints } from './src/store/wallet';
import SafeBoundary from './src/components/SafeBoundary';
import { DesignThemeProvider } from './src/design';
import { setTelemetryEnabled, sendDailySnapshot, sendEvent, sendError, flushAnswers, sendLifecycleMetrics } from './src/telemetry/telemetry';

// ナビゲーション状態から現在の画面名(最深ルート)を取得。
function activeRouteName(navState: unknown): string | undefined {
  const st = navState as { index?: number; routes?: { name: string; state?: unknown }[] } | undefined;
  if (!st || typeof st.index !== 'number' || !st.routes) return undefined;
  const route = st.routes[st.index];
  return route?.state ? activeRouteName(route.state) : route?.name;
}

const Tab = createMaterialTopTabNavigator();
const RootStack = createNativeStackNavigator<RootStackParamList>();

// ディープリンク: 招待リンク safajlpt://invite?u=<owner> を Invite 画面へ。u はルートパラメータへ自動マッピング。
// https は配信サイトの招待ページ経由(ページの「アプリで開く」ボタンが safajlpt:// を呼ぶ)。
const LINKING = {
  prefixes: ['safajlpt://', 'https://jinkato2020.github.io/safa-JLPT'],
  config: { screens: { Invite: 'invite' } },
};
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
  // 辞書タブ: 没入する図書館ホーム(DictHome) → 各辞書リスト(DictList=BrowseScreen) / My単語帳(MyWords)。
  // My単語帳はタブ内画面(スタック)に置く=下からせり上がるモーダルにせず、ボトムナビを消さない(ユーザー要望)。
  return (
    <DictStack.Navigator screenOptions={{ headerShown: false }}>
      <DictStack.Screen name="DictHome" component={DictHomeScreen} />
      <DictStack.Screen name="DictList" component={BrowseScreen} />
      <DictStack.Screen name="MyWords" component={MyWordsScreen} />
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

// 上部の共通アイコン列(アカウント/レベル/設定/通知)を隠す画面: 辞書リスト(DictList)と
// 単語タブの練習ホーム・学習リスト(WordKubun/WordList)。各画面自身に×/←戻り＋見出しがあり、没入して学習に集中できる。
const HIDE_TOPBAR = new Set(['DictList', 'WordKubun', 'WordList', 'MyWords']);

function MainTabs() {
  const c = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const state = useAppState();
  const hideTopBar = useNavigationState((s) => HIDE_TOPBAR.has(activeRouteName(s) ?? ''));
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
          // タブから離れたら、そのタブの入れ子スタックを先頭(ハブ=背景画像の画面)まで戻す。
          // 再度スワイプで戻った時に、前に開いていたカード/リストではなく既定の背景が出るように(ユーザー要望)。
          listeners={({ navigation, route }) => ({
            blur: () => {
              const parent = navigation.getState();
              const r = parent.routes.find((x) => x.key === route.key);
              const nestedKey = (r?.state as { key?: string } | undefined)?.key;
              if (nestedKey) navigation.dispatch({ ...StackActions.popToTop(), target: nestedKey });
            },
          })}
          options={{
            tabBarLabel: t(tab.labelKey),
            tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? tab.icon : tab.iconOff} size={22} color={color} />,
          }}
        />
      ))}
    </Tab.Navigator>
      {/* 全タブ共通の上部操作列(左から): アカウント / JLPTレベル / ショップ / 設定(一番右)。辞書リストでは非表示。
          ※持ち物(アイテム一覧)は「桜/柴のタップで購入済みを確認」に集約したため上部アイコンは廃止。 */}
      {!hideTopBar && (
      <View style={[topBar.row, { top: insets.top + 6 }]}>
        {/* 上部操作列は全アイコン等間隔(space-between)。左→右: アカウント / 貝殻 / 設定。
            ・AIコーチ=ホームの合格リングをタップで開く(ヘッダーの✨は廃止)。
            ・模試チケット🎫は廃止(模試は学習タブの「試」カードから。残数はショップ/持ち物で確認)。 */}
        <Pressable onPress={() => nav.navigate('Account')} accessibilityLabel={t('account.title')} hitSlop={6} style={iconBtn}>
          <Ionicons name="person-circle-outline" size={26} color={c.ink} />
        </Pressable>
        {/* 貝殻ポイント(タップでショップへ)。 */}
        <Pressable onPress={() => nav.navigate('Shop')} accessibilityLabel={t('shop.points_label')} hitSlop={6} style={[topBar.pill, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Text style={[topBar.pillTxt, { color: c.ink }]}>🐚 {walletPoints(state)}</Text>
        </Pressable>
        {/* 日本語学習者の町(外の世界を歩く入口)。設定より左に置く(設定は右端固定)。 */}
        <Pressable onPress={() => nav.navigate('KotobaTown')} accessibilityLabel="日本語学習者の町" hitSlop={6} style={iconBtn}>
          <Ionicons name="footsteps-outline" size={22} color={c.ink} />
        </Pressable>
        {/* 設定(歯車)は必ず一番右。今後も動かさない(固定・ユーザー指定)。 */}
        <Pressable onPress={() => nav.navigate('Settings')} accessibilityLabel={t('profile.title')} hitSlop={6} style={iconBtn}>
          <Ionicons name="settings-outline" size={22} color={c.ink} />
        </Pressable>
      </View>
      )}
    </View>
  );
}

const topBar = StyleSheet.create({
  row: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 20 },
  btn: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 5,
  },
  pill: {
    height: 40, minWidth: 46, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
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
  const { addStudySeconds, setPurchaseActive, setSettings } = useAppActions();
  const { session } = useSync();
  const { settings } = state;
  const stateRef = useRef(state);
  stateRef.current = state;
  const c = useColors();

  // 言語の一本化: 表示言語(uiLang＝設定or端末自動判定)と「意味の表示言語(l1)」を常に一致させる。
  // 端末が日本語だと uiLang は自動で ja になるのに、l1 が初回オンボーディングの ne のまま残り
  // 「日本語表示なのに意味がネパール語」になっていた食い違いをここで解消する。
  // 意味データがあるのはネパール語のみ→ne は ne、それ以外(ja/en)は英語で表示。
  const uiLang = useUiLang();
  const meaningLang = uiLang === 'ne' ? 'ne' : 'en';
  useEffect(() => {
    if (!hydrated) return;
    if (settings.l1 !== meaningLang) setSettings({ l1: meaningLang });
  }, [hydrated, meaningLang]); // eslint-disable-line react-hooks/exhaustive-deps

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
      void sendLifecycleMetrics(stateRef.current, Date.now()); // install / 翌日起動を1回だけ(§8)
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

  // 課金(RevenueCat)の初期化とPro状態の同期。キー未設定(src/config/revenuecat.ts が空)なら全て no-op。
  // ログイン中は実IDへ紐付け(機種変で権利がfollow)、匿名なら匿名IDで同期。結果を端末へ保存(通信断でもProが剥がれない)。
  const userId = session?.user?.id;
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    (async () => {
      await initPurchases(userId ?? null);
      let active: boolean | null;
      if (userId) active = await linkAccount(userId);
      else { await unlinkAccount(); active = await syncEntitlement(); }
      if (!cancelled && typeof active === 'boolean') setPurchaseActive(active);
    })();
    return () => { cancelled = true; };
  }, [hydrated, userId]); // eslint-disable-line react-hooks/exhaustive-deps
  // 広告(AdMob)の初期化。iOSはATT(トラッキング許可)を尋ねてから。SDK未リンクなら安全に no-op。
  useEffect(() => {
    if (!hydrated) return;
    void initAds();
  }, [hydrated]);
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
    <NavigationContainer ref={navigationRef} linking={LINKING} key={`${settings.font ?? 'maru'}-${settings.theme ?? 'auto'}`} theme={navTheme} onStateChange={(st) => { const n = activeRouteName(st); if (n) void sendEvent('screen_view', { name: n }); }}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {!settings.onboarded ? (
          <RootStack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          <>
            <RootStack.Screen name="Main" component={MainTabs} />
            {/* 学習系(試験/単語タブ→学習)は全画面切替(card)。下から持ち上がる部分モーダル(上部に背景が覗く)をやめる。ユーザー要望2026-07-17。 */}
            <RootStack.Screen name="Quiz" component={QuizScreen} options={{ presentation: 'card' }} />
            <RootStack.Screen name="Flashcard" component={FlashcardScreen} options={{ presentation: 'card' }} />
            <RootStack.Screen name="MockIntro" component={MockIntroScreen} options={{ presentation: 'card' }} />
            <RootStack.Screen name="Mock" component={MockScreen} options={{ presentation: 'card' }} />
            <RootStack.Screen name="Reading" component={ReadingScreen} options={{ presentation: 'card' }} />
            <RootStack.Screen name="PassageGrammar" component={PassageGrammarScreen} options={{ presentation: 'card' }} />
            <RootStack.Screen name="Listening" component={ListeningScreen} options={{ presentation: 'card' }} />
            <RootStack.Screen name="Kakitori" component={KakitoriScreen} options={{ presentation: 'card' }} />
            <RootStack.Screen name="ListeningQuiz" component={ListeningQuizScreen} options={{ presentation: 'card' }} />
            <RootStack.Screen name="WordDrill" component={WordDrillScreen} options={{ presentation: 'card' }} />
            {/* 以下は overlay/ダイアログ的なのでモーダル(下から)のまま。 */}
            <RootStack.Screen name="KanjiDetail" component={KanjiDetailScreen} options={{ presentation: 'modal' }} />
            {/* My単語帳は辞書タブ内(DictStack)へ移設=タブ内画面。ボトムナビを消さない(ユーザー要望2026-07-27)。 */}
            <RootStack.Screen name="Account" component={AccountScreen} options={{ presentation: 'modal' }} />
            <RootStack.Screen name="Settings" component={ProfileScreen} options={{ presentation: 'modal' }} />
            <RootStack.Screen name="AICoach" component={AICoachScreen} options={{ presentation: 'modal' }} />
            <RootStack.Screen name="QuestionReview" component={QuestionReviewScreen} options={{ presentation: 'modal' }} />
            <RootStack.Screen name="Paywall" component={PaywallScreen} options={{ presentation: 'modal' }} />
            <RootStack.Screen name="Notifications" component={NotificationsScreen} options={{ presentation: 'modal' }} />
            <RootStack.Screen name="Shop" component={ShopScreen} options={{ presentation: 'modal' }} />
            <RootStack.Screen name="Referral" component={ReferralScreen} options={{ presentation: 'modal' }} />
            <RootStack.Screen name="Invite" component={InviteScreen} options={{ presentation: 'modal' }} />
            <RootStack.Screen name="KotobaTown" component={KotobaTownScreen} options={{ presentation: 'card' }} />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
    {settings.onboarded && !session && !settings.accountPromptSeen && <AccountPrompt />}
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
