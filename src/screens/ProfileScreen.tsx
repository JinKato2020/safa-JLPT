// 設定タブ(旧「自分」)= 設定特化。目標級・母語(端末言語から自動)・試験日・テーマ＋評価/ポリシー/規約＋出典/リセット。
// 継続・成長・バッジ・到達度はホーム(ダッシュボード)へ移動。
import { useMemo, useState, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Switch, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import * as StoreReview from 'expo-store-review';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState, useAppActions } from '../store/store';
import { scheduleDailyReminder, cancelReminder } from '../store/notifications';
import { dayStr, daysBetween } from '../store/state';
import { META } from '../data';
import type { Level } from '../engine/engine';
import type { ThemeMode } from '../store/state';
import { useT, UI_LANGS, useUiLang } from '../i18n';
import { legalUrl } from '../config/legal';
import { nativeLangCC } from '../plaza/countries';
import ListeningDownloadGate from '../components/ListeningDownloadGate';
import Slider from '../components/Slider';
import MiniCalendar from '../components/MiniCalendar';
import { upcomingExams } from '../data/jlptDates';
import { setTelemetryEnabled, sendEvent } from '../telemetry/telemetry';
import * as Application from 'expo-application';
import { useSync } from '../auth/SyncProvider';
import { deleteAccount } from '../auth/authClient';
import { proStatus } from '../pro/entitlement';
import { FREE_SESSIONS_PER_DAY } from '../pro/dailyQuota';
import UnlockCelebration from '../components/UnlockCelebration';
import { UNLOCKS, type UnlockKey } from '../store/unlocks';

const LEVELS: Level[] = ['N5', 'N4', 'N3'];
const pad2 = (n: number) => String(n).padStart(2, '0');


export default function ProfileScreen() {
  const t = useT();
  const uiLang = useUiLang();
  const state = useAppState();
  const { setSettings, reset } = useAppActions();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const today = dayStr(Date.now());
  const isJft = (state.settings.targetExam ?? 'jlpt') === 'jft';
  const exams = useMemo(() => upcomingExams(today), [today]);
  // 【開発用】合格率を固定して、合格率連動UI(辞書タブ背景/AIコーチ等)の挙動を確認する。
  const devPass = state.settings.devPassPct ?? null;
  const stepPass = (d: number) => { const cur = state.settings.devPassPct ?? 0; setSettings({ devPassPct: Math.max(0, Math.min(100, cur + d)) }); };
  const [confirmReset, setConfirmReset] = useState(false);
  // 【開発用】書斎の解禁演出を単体プレビューする(全体カバー率に達しなくても各画面を確認)。
  const [unlockPreview, setUnlockPreview] = useState<UnlockKey | null>(null);
  const previewUnlock = unlockPreview ? UNLOCKS.find((u) => u.key === unlockPreview) ?? null : null;
  const [langOpen, setLangOpen] = useState(false);
  const [showDl, setShowDl] = useState(false);
  // 開発用セクションの隠しゲート: 一番下のバージョン表示を7回タップで解禁(TestFlight/本番でも使える・実ユーザーには見えない)。開発クライアントは既定で表示。
  // 解禁状態は state.settings.devToolsUnlocked に保存=全体で共有(大問の問題ID選択もこのフラグで表示)＋再起動後も維持。
  const devUnlocked = __DEV__ || state.settings.devToolsUnlocked === true;
  const devTapRef = useRef(0);
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { session } = useSync();

  // 今の状態(Pro / お試し中 / 無料)。判定は proStatus ただ1つに任せる(画面では判定しない)。
  const pro = proStatus(state, Date.now());
  const proText = pro.source === 'trial'
    ? t('pro.state_trial', { n: pro.trialDaysLeft })
    : pro.isPro
      ? t('pro.state_pro')
      : t('pro.state_free', { n: FREE_SESSIONS_PER_DAY });

  // アカウント削除(ログイン中のみ・設定の最後に配置)。Apple審査要件=アプリ内から退会できること。
  const onDelete = () => {
    if (!session) return;
    const uid = session.user.id;
    Alert.alert(t('account.delete'), t('account.delete_confirm'), [
      { text: t('account.delete_no'), style: 'cancel' },
      // 退会=クラウド(②③)を消した後、端末内(名前・進捗)もまっさらにする。①利用ログ(匿名ID)は分析用に残す。
      { text: t('account.delete_yes'), style: 'destructive', onPress: () => { void deleteAccount(uid).finally(() => reset()); } },
    ]);
  };

  const rate = async () => {
    try {
      if (await StoreReview.isAvailableAsync()) await StoreReview.requestReview();
    } catch {
      // レビュー機能が使えない環境では何もしない
    }
  };

  // 学習リマインド: 時:分をカウンター(±)で指定するシンプルUI。ONで通知を予約、OFFで解除。
  const reminderOn = state.settings.reminder != null;
  const [remH, setRemH] = useState(() => Number((state.settings.reminder ?? '19:00').split(':')[0]));
  const [remM, setRemM] = useState(() => Number((state.settings.reminder ?? '19:00').split(':')[1]));
  const applyReminder = (hh: number, mm: number) => { const v = `${pad2(hh)}:${pad2(mm)}`; setSettings({ reminder: v }); void scheduleDailyReminder(v, uiLang); };
  const stepH = (d: number) => { const nh = (remH + d + 24) % 24; setRemH(nh); if (reminderOn) applyReminder(nh, remM); };
  const stepM = (d: number) => { const nm = (remM + d * 5 + 60) % 60; setRemM(nm); if (reminderOn) applyReminder(remH, nm); };
  const toggleReminder = (v: boolean) => { if (v) applyReminder(remH, remM); else { setSettings({ reminder: null }); void cancelReminder(); } };

  return (
    <SafeAreaView style={s.c} edges={['top']}>
      <ScrollView contentContainerStyle={s.body}>
        <View style={s.headRow}>
          <Text style={s.title}>{t('profile.title')}</Text>
          <Pressable onPress={() => nav.goBack()} hitSlop={12} accessibilityLabel={t('nav.close')}>
            <Text style={s.closeX}>×</Text>
          </Pressable>
        </View>

        {/* アカウント管理(メール・同期・ログアウト・削除)は上部の人アイコン→アカウント画面に集約。設定にカードは置かない。 */}

        {/* 学習設定 */}
        <View style={s.card}>
          {/* JLPTの目標レベル(目標試験の選択はJLPTのみ実装のため廃止) */}
          <Text style={s.setLbl}>{t('profile.targetLevel')}</Text>
          <View style={s.chipRow}>
            {LEVELS.map((lv) => (
              <Pressable key={lv} onPress={() => setSettings({ level: lv })} style={[s.chip, state.settings.level === lv && s.chipOn]}>
                <Text style={[s.chipTxt, state.settings.level === lv && s.chipTxtOn]}>{lv}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={s.setLbl}>{t('profile.nativeLang')}</Text>
          <Pressable style={s.dropdown} onPress={() => setLangOpen((o) => !o)}>
            <Text style={s.dropdownTxt}>{UI_LANGS.find((l) => l.code === uiLang)?.name ?? uiLang}</Text>
            <Text style={s.dropdownCaret}>{langOpen ? '▲' : '▼'}</Text>
          </Pressable>
          {langOpen ? (
            <View style={s.dropdownList}>
              {UI_LANGS.map((o) => (
                <Pressable
                  key={o.code}
                  onPress={() => {
                    sendEvent('language_changed', { lang: o.code });
                    // 母語を一本化: UI言語＝意味の表示言語。意味翻訳がある言語(現状ネパール語)はその言語、無ければ英語で表示。
                    // アカウント画面の母語(＝uiLang表示)と連動。国旗(country)も母語から更新して一致させる。
                    setSettings({ uiLang: o.code, l1: o.code === 'ne' ? 'ne' : 'en', country: nativeLangCC(o.code) });
                    setLangOpen(false);
                  }}
                  style={s.dropdownItem}
                >
                  <Text style={[s.dropdownItemTxt, uiLang === o.code && s.dropdownItemOn]}>{o.name}</Text>
                  {uiLang === o.code ? <Text style={s.dropdownCheck}>✓</Text> : null}
                </Pressable>
              ))}
            </View>
          ) : null}
          <Text style={s.subtle}>{t('profile.nativeLangHint')}</Text>

          <Text style={s.setLbl}>{t('profile.examDate')}</Text>
          {isJft ? (
            /* JFT=CBT(随時)。日程は自分でカレンダー入力 */
            <>
              <Text style={s.subtle}>{t('profile.examJftHint')}</Text>
              {state.settings.examDate ? (
                <Text style={s.examSel}>
                  {state.settings.examDate.replace(/-/g, '/')}{t('profile.examDaysLeft', { n: daysBetween(today, state.settings.examDate) })}
                </Text>
              ) : null}
              <MiniCalendar value={state.settings.examDate} min={today} onSelect={(d) => setSettings({ examDate: d })} />
              <View style={s.chipWrap}>
                <Pressable onPress={() => setSettings({ examDate: null })} style={[s.chip, !state.settings.examDate && s.chipOn]}>
                  <Text style={[s.chipTxt, !state.settings.examDate && s.chipTxtOn]}>{t('profile.examUndecided')}</Text>
                </Pressable>
              </View>
            </>
          ) : (
            /* JLPT=年2回(7月/12月の第1日曜)から2択 */
            <View style={s.chipWrap}>
              {exams.map((d) => (
                <Pressable key={d} onPress={() => setSettings({ examDate: d })} style={[s.chip, state.settings.examDate === d && s.chipOn]}>
                  <Text style={[s.chipTxt, state.settings.examDate === d && s.chipTxtOn]}>
                    {d.slice(5).replace('-', '/')}{t('profile.examDaysLeft', { n: daysBetween(today, d) })}
                  </Text>
                </Pressable>
              ))}
              {/* 「未定」チップは非表示(ユーザー指定)。試験日は7月/12月から選ぶ。 */}
            </View>
          )}

          {/* テーマ = ライト/ダーク/自動。水彩(桜/空/緑/藤/茜)はユーザー指定で撤去(2026-07-31)。 */}
          <Text style={s.setLbl}>{t('profile.theme')}</Text>
          <View style={s.chipWrap}>
            {(['light', 'dark', 'auto'] as const).map((th) => {
              const on = (state.settings.theme ?? 'auto') === th;
              const label = th === 'light' ? t('profile.themeLight') : th === 'dark' ? t('profile.themeDark') : t('profile.themeAuto');
              return (
                <Pressable key={th} onPress={() => setSettings({ theme: th })} style={[s.chip, on && s.chipOn]}>
                  <Text style={[s.chipTxt, on && s.chipTxtOn]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={s.setLbl}>{t('profile.reminder')}</Text>
          <View style={s.reminderRow}>
            <Switch
              value={reminderOn}
              onValueChange={toggleReminder}
              trackColor={{ true: c.blueLight, false: c.line }}
              thumbColor={c.faint}
            />
            <View style={[s.counter, !reminderOn && s.counterOff]}>
              <Pressable style={s.stepBtn} onPress={() => stepH(-1)} disabled={!reminderOn} hitSlop={6}><Text style={s.stepTxt}>−</Text></Pressable>
              <Text style={s.counterNum}>{pad2(remH)}</Text>
              <Pressable style={s.stepBtn} onPress={() => stepH(1)} disabled={!reminderOn} hitSlop={6}><Text style={s.stepTxt}>＋</Text></Pressable>
              <Text style={s.counterColon}>:</Text>
              <Pressable style={s.stepBtn} onPress={() => stepM(-1)} disabled={!reminderOn} hitSlop={6}><Text style={s.stepTxt}>−</Text></Pressable>
              <Text style={s.counterNum}>{pad2(remM)}</Text>
              <Pressable style={s.stepBtn} onPress={() => stepM(1)} disabled={!reminderOn} hitSlop={6}><Text style={s.stepTxt}>＋</Text></Pressable>
            </View>
          </View>
          <Text style={s.subtle}>{t('profile.reminderHint')}</Text>

          {/* 利用状況データの送信: 目立たない控えめ表示(小さめ・淡色・区切り線で降格) */}
          <View style={s.telemRow}>
            <View style={s.telemTxt}>
              <Text style={s.telemLbl}>{t('profile.telemetry')}</Text>
              <Text style={s.subtle}>{t('profile.telemetryHint')}</Text>
            </View>
            <Switch
              style={s.telemSwitch}
              value={state.settings.telemetry !== false}
              onValueChange={(v) => { setSettings({ telemetry: v }); setTelemetryEnabled(v); }}
              trackColor={{ true: c.blueLight, false: c.line }}
              thumbColor={c.faint}
            />
          </View>

          {/* 広告トラッキング許可: 既定ON。オフにすると広告が非パーソナライズになる。 */}
          <View style={s.telemRow}>
            <View style={s.telemTxt}>
              <Text style={s.telemLbl}>{t('profile.adTracking')}</Text>
              <Text style={s.subtle}>{t('profile.adTrackingHint')}</Text>
            </View>
            <Switch
              style={s.telemSwitch}
              value={state.settings.adTracking !== false}
              onValueChange={(v) => { setSettings({ adTracking: v }); }}
              trackColor={{ true: c.blueLight, false: c.line }}
              thumbColor={c.faint}
            />
          </View>
        </View>

        {/* 聴解音声のダウンロード導線(今のレベルの音声を端末に保存=オフライン再生)。取得方式トグル(配信/一括)は廃止。 */}
        <View style={s.card}>
          <Text style={s.setLbl}>{t('profile.listeningAudio')}</Text>
          <Pressable style={s.linkRow} onPress={() => setShowDl(true)}>
            <Text style={s.linkTxt}>{t('dl.title')}</Text>
            <Text style={s.chev}>›</Text>
          </Pressable>
        </View>

        {/* 聴解音声の再生スピード(0.5〜1.5倍。ネイティブ非依存の自作スライダー=OTA配信可) */}
        <View style={s.card}>
          <Text style={s.setLbl}>{t('profile.listeningRate')}</Text>
          <Slider
            value={state.settings.listeningRate ?? 1}
            min={0.5}
            max={1.5}
            step={0.1}
            onChange={(v) => setSettings({ listeningRate: v })}
            trackColor={c.line}
            fillColor={c.blue}
            formatValue={(v) => `${v.toFixed(1)}×`}
          />
          <Text style={s.subtle}>{t('profile.listeningRateHint')}</Text>
        </View>

        {/* おさんぽの操作カーソルは画面下部の中央に固定(左右の設定は廃止)。
            町のアバターのプロフィール(勉強分野/性格/ムード/ニックネーム/国/性別/アバター)は
            アカウント画面(上部の人アイコン)に集約。設定タブには重複カードを置かない。 */}

        {/* サポート・規約 */}
        <Text style={s.sectionH}>{t('profile.supportSection')}</Text>
        <View style={s.card}>
          <Pressable style={s.linkRow} onPress={rate}>
            <Text style={s.linkTxt}>{t('profile.rateApp')}</Text>
            <Text style={s.chev}>›</Text>
          </Pressable>
          {/* プライバシーポリシー/利用規約=本番URL(各言語)をブラウザで開く。アプリ内本文は持たない(内容が実態と乖離しないよう一元管理)。 */}
          <View style={s.linkDiv} />
          <Pressable style={s.linkRow} onPress={() => Linking.openURL(legalUrl('privacy', uiLang))}>
            <Text style={s.linkTxt}>{t('profile.privacy')}</Text>
            <Text style={s.chev}>↗</Text>
          </Pressable>
          <View style={s.linkDiv} />
          <Pressable style={s.linkRow} onPress={() => Linking.openURL(legalUrl('terms', uiLang))}>
            <Text style={s.linkTxt}>{t('profile.terms')}</Text>
            <Text style={s.chev}>↗</Text>
          </Pressable>
          {/* JLPT公式サンプル問題(外部リンク)。本番の出題形式を公式サイトで確認できる。 */}
          <Pressable style={s.linkRow} onPress={() => Linking.openURL('https://www.jlpt.jp/samples/forlearners.html')}>
            <Text style={s.linkTxt}>{t('profile.jlptSamples')}</Text>
            <Text style={s.chev}>↗</Text>
          </Pressable>
        </View>

        {/* 出典・リセット */}
        <View style={s.card}>
          <Text style={s.setLbl}>{t('profile.dataSource')}</Text>
          <Text style={s.credit}>
            {t('profile.dataSourceBody')}
            {META.license ? `\n${META.license}` : ''}
          </Text>
          <Pressable
            onPress={() => {
              if (confirmReset) {
                reset();
                setConfirmReset(false);
              } else {
                setConfirmReset(true);
              }
            }}
            style={[s.resetBtn, confirmReset && s.resetBtnArm]}
          >
            <Text style={[s.resetTxt, confirmReset && s.resetTxtArm]}>
              {confirmReset ? t('profile.resetConfirm') : t('profile.resetBtn')}
            </Text>
          </Pressable>
        </View>

        {/* 開発用トグル(テスト用途)。隠しゲート devUnlocked=本番でも非表示(バージョン7回タップで表示)。実ユーザーには出さないので翻訳も不要。 */}
        {devUnlocked && (<>
        <Text style={s.sectionH}>開発用</Text>
        <View style={s.card}>
          <View style={s.telemRow}>
            <View style={s.telemTxt}>
              <Text style={s.telemLbl}>ポイント無限</Text>
              <Text style={s.subtle}>ONでショップを桜貝の残高に関係なく無制限に購入＋獲得の1日上限(300貝)も無視(テスト用)</Text>
            </View>
            <Switch
              style={s.telemSwitch}
              value={state.settings.devUnlimitedPoints === true}
              onValueChange={(v) => setSettings({ devUnlimitedPoints: v })}
              trackColor={{ true: c.blueLight, false: c.line }}
              thumbColor={c.faint}
            />
          </View>
          <View style={s.telemRow}>
            <View style={s.telemTxt}>
              <Text style={s.telemLbl}>Pro課金</Text>
              <Text style={s.subtle}>ON=Pro課金状態 / OFF=無課金ユーザー状態として扱う</Text>
            </View>
            <Switch
              style={s.telemSwitch}
              value={state.settings.devPro === true}
              onValueChange={(v) => setSettings(v ? { devPro: true, devFree: false } : { devPro: false })}
              trackColor={{ true: c.blueLight, false: c.line }}
              thumbColor={c.faint}
            />
          </View>
          <View style={s.telemRow}>
            <View style={s.telemTxt}>
              <Text style={s.telemLbl}>無料ユーザー</Text>
              <Text style={s.subtle}>
                ON=お試し中でも無料ユーザー扱い。1日{FREE_SESSIONS_PER_DAY}回の上限もこの端末だけ実際にかかる
              </Text>
            </View>
            <Switch
              style={s.telemSwitch}
              value={state.settings.devFree === true}
              onValueChange={(v) => setSettings(v ? { devFree: true, devPro: false } : { devFree: false })}
              trackColor={{ true: c.blueLight, false: c.line }}
              thumbColor={c.faint}
            />
          </View>
          {/* オープニング(初回のオンボーディング)を再表示。onboarded=falseで App が Onboarding 画面へ切替(認証フロー型)。 */}
          <Pressable style={s.telemRow} onPress={() => setSettings({ onboarded: false })}>
            <View style={s.telemTxt}>
              <Text style={s.telemLbl}>オープニングを確認する</Text>
              <Text style={s.subtle}>初回のオープニング（桜の挨拶→初期設定）をもう一度表示する</Text>
            </View>
            <Text style={s.chev}>›</Text>
          </Pressable>
          <View style={s.telemRow}>
            <View style={s.telemTxt}>
              <Text style={s.telemLbl}>{t('pro.row_label')}</Text>
              <Text style={s.subtle}>{proText}</Text>
            </View>
          </View>
          {/* 合格率を固定(開発用)。辞書タブ背景・AIコーチ等の合格率連動を確認。 */}
          <View style={s.telemRow}>
            <View style={s.telemTxt}>
              <Text style={s.telemLbl}>合格率を固定</Text>
              <Text style={s.subtle}>設定中はこの値で辞書タブ背景・AIコーチ等が動く。「自動」で通常の計算に戻す</Text>
            </View>
          </View>
          <View style={s.ppRow}>
            <Pressable onPress={() => stepPass(-5)} style={s.ppStep} hitSlop={6}><Text style={s.ppStepTxt}>−</Text></Pressable>
            <Text style={s.ppVal}>{devPass == null ? '自動' : devPass + '%'}</Text>
            <Pressable onPress={() => stepPass(5)} style={s.ppStep} hitSlop={6}><Text style={s.ppStepTxt}>＋</Text></Pressable>
          </View>
          <View style={s.ppChips}>
            {[0, 20, 40, 60, 80, 100].map((v) => (
              <Pressable key={v} onPress={() => setSettings({ devPassPct: v })} style={[s.ppChip, devPass === v && s.ppChipOn]}>
                <Text style={[s.ppChipTxt, devPass === v && s.ppChipTxtOn]}>{v}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setSettings({ devPassPct: null })} style={[s.ppChip, devPass == null && s.ppChipOn]}>
              <Text style={[s.ppChipTxt, devPass == null && s.ppChipTxtOn]}>自動</Text>
            </Pressable>
          </View>
          {/* 模試終了後の画面を確認(開発用): 模試終了→計算演出→合否の証明書を直接開く。 */}
          <View style={s.telemRow}>
            <View style={s.telemTxt}>
              <Text style={s.telemLbl}>模試終了後の画面へ</Text>
              <Text style={s.subtle}>模試終了→結果計算→合否の証明書を確認（開発用）</Text>
            </View>
          </View>
          <View style={s.ppChips}>
            <Pressable onPress={() => nav.navigate('Mock', { full: true, preview: 'pass' })} style={[s.ppChip, { flex: 1 }]}>
              <Text style={s.ppChipTxt}>合格版</Text>
            </Pressable>
            <Pressable onPress={() => nav.navigate('Mock', { full: true, preview: 'fail' })} style={[s.ppChip, { flex: 1 }]}>
              <Text style={s.ppChipTxt}>不合格版</Text>
            </Pressable>
          </View>
          {/* 模試を無制限に(開発用): ON=チケットを消費せず何回でも受験できる。 */}
          <View style={s.telemRow}>
            <View style={s.telemTxt}>
              <Text style={s.telemLbl}>模試を無制限にする</Text>
              <Text style={s.subtle}>ON＝模試チケットを消費せず、何回でも受験できる（開発用）</Text>
            </View>
            <Switch
              style={s.telemSwitch}
              value={state.settings.devUnlimitedMock === true}
              onValueChange={(v) => setSettings({ devUnlimitedMock: v })}
              trackColor={{ true: c.blueLight, false: c.line }}
              thumbColor={c.faint}
            />
          </View>
          {/* 模試スキップ(開発用): ON=模試中に「⏭ 次の休憩」ボタンを表示。現ブロックの設問を全カットして次の休憩(最終ブロックは模試終了)へワープ。 */}
          <View style={s.telemRow}>
            <View style={s.telemTxt}>
              <Text style={s.telemLbl}>模試の設問をスキップ</Text>
              <Text style={s.subtle}>ON＝模試中に「⏭ 次の休憩」ボタンを表示。設問を全部飛ばして次の休憩画面（最後の科目なら終了）へ進む（開発用）</Text>
            </View>
            <Switch
              style={s.telemSwitch}
              value={state.settings.devMockSkip === true}
              onValueChange={(v) => setSettings({ devMockSkip: v })}
              trackColor={{ true: c.blueLight, false: c.line }}
              thumbColor={c.faint}
            />
          </View>
          {/* 全モード解禁(開発用): ON=書斎の学習を全体カバー率に関係なく全解禁。ポイント無限とは独立(混同を避ける)。 */}
          <View style={s.telemRow}>
            <View style={s.telemTxt}>
              <Text style={s.telemLbl}>全モードを解禁</Text>
              <Text style={s.subtle}>ON＝書斎の学習（聞き取り・書き取り・語彙/文法パズル）を全体カバー率に関係なく全部解禁。通常は5/10/15/20%で順に解禁（開発用・ポイント無限とは別）</Text>
            </View>
            <Switch
              style={s.telemSwitch}
              value={state.settings.devUnlockAll === true}
              onValueChange={(v) => setSettings({ devUnlockAll: v })}
              trackColor={{ true: c.blueLight, false: c.line }}
              thumbColor={c.faint}
            />
          </View>
          {/* 書斎の解禁演出を確認(開発用): 各しきい値の解禁画面を単体で表示。 */}
          <View style={s.telemRow}>
            <View style={s.telemTxt}>
              <Text style={s.telemLbl}>解禁演出を確認</Text>
              <Text style={s.subtle}>書斎タブの各学習の解禁画面（画像＋「◯◯ 解禁」）を表示する（開発用）</Text>
            </View>
          </View>
          <View style={s.ppChips}>
            {UNLOCKS.map((u) => (
              <Pressable key={u.key} onPress={() => setUnlockPreview(u.key)} style={[s.ppChip, { flex: 1 }]}>
                <Text style={s.ppChipTxt} numberOfLines={1}>{t(u.labelKey)}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        </>)}

        {/* アカウント削除(ログイン中のみ・設定の一番下)。誤タップ防止に確認ダイアログ。 */}
        {session ? (
          <Pressable style={s.deleteBottom} onPress={onDelete} hitSlop={6}>
            <Text style={s.deleteBottomTxt}>{t('account.delete')}</Text>
          </Pressable>
        ) : null}

        {/* バージョン＋Build番号(全セッション共通ルール: 画面に版を表示)。7回タップで開発用セクションを表示(隠しゲート)。 */}
        <Pressable onPress={() => { devTapRef.current += 1; if (devTapRef.current >= 7) setSettings({ devToolsUnlocked: true }); }}>
          <Text style={s.version}>
            v{Application.nativeApplicationVersion ?? '1.1.0'} (build {Application.nativeBuildVersion ?? '—'})
          </Text>
        </Pressable>
      </ScrollView>
      {showDl ? (
        <View style={StyleSheet.absoluteFill}>
          <ListeningDownloadGate level={state.settings.level} allowSkip manual onComplete={() => setShowDl(false)} />
        </View>
      ) : null}
      {/* 開発用: 解禁演出の単体プレビュー(全体カバー率に達しなくても各画面を確認)。 */}
      <UnlockCelebration
        visible={previewUnlock !== null}
        unlockKey={previewUnlock?.key ?? null}
        modeLabel={previewUnlock ? t(previewUnlock.labelKey) : ''}
        need={previewUnlock?.need ?? 0}
        onClose={() => setUnlockPreview(null)}
      />
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    c: { flex: 1, backgroundColor: c.bg },
    body: { padding: spacing.lg, gap: spacing.sm },
    tab: { fontSize: ty.small, fontWeight: '700', letterSpacing: 1, color: c.mute },
    title: { fontSize: ty.h1, fontWeight: '800', color: c.ink, marginTop: spacing.xs },
    headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    closeX: { fontSize: 30, color: c.mute, fontWeight: '700', paddingHorizontal: spacing.xs },
    reminderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs },
    counter: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderWidth: 1, borderColor: c.line, borderRadius: radius.md, paddingVertical: 4, paddingHorizontal: spacing.sm, backgroundColor: c.surface },
    counterOff: { opacity: 0.4 },
    stepBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bgSoft },
    stepTxt: { fontSize: ty.h2, fontWeight: '900', color: c.blue },
    counterNum: { fontSize: ty.h2, fontWeight: '800', color: c.ink, minWidth: 30, textAlign: 'center', fontVariant: ['tabular-nums'] },
    counterColon: { fontSize: ty.h2, fontWeight: '800', color: c.ink, marginHorizontal: 2 },
    sectionH: { fontSize: ty.small, fontWeight: '800', color: c.ink2, marginTop: spacing.md },
    card: {
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.line,
      padding: spacing.md,
      marginTop: spacing.sm,
    },
    setLbl: { fontSize: ty.small, fontWeight: '700', color: c.ink2, marginTop: spacing.sm, marginBottom: spacing.xs },
    chipRow: { flexDirection: 'row', gap: spacing.sm },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: {
      paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.pill,
      borderWidth: 1, borderColor: c.line, backgroundColor: c.surface,
    },
    chipOn: { borderColor: c.blue, backgroundColor: c.blueLight },
    chipTxt: { fontSize: ty.small, color: c.ink2, fontWeight: '600' },
    chipTxtOn: { color: c.blueDark, fontWeight: '800' },
    dropdown: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      borderWidth: 1, borderColor: c.line, borderRadius: radius.md, backgroundColor: c.surface,
      paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    },
    dropdownTxt: { fontSize: ty.body, color: c.ink, fontWeight: '700' },
    dropdownCaret: { fontSize: ty.small, color: c.mute },
    dropdownList: { borderWidth: 1, borderColor: c.line, borderRadius: radius.md, marginTop: spacing.xs, overflow: 'hidden' },
    dropdownItem: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderTopWidth: 1, borderTopColor: c.line,
    },
    dropdownItemTxt: { fontSize: ty.body, color: c.ink2 },
    dropdownItemOn: { color: c.blueDark, fontWeight: '800' },
    dropdownCheck: { color: c.blue, fontWeight: '800' },
    linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm },
    linkTxt: { fontSize: ty.body, color: c.ink2, fontWeight: '600' },
    chev: { fontSize: ty.h2, color: c.trace, fontWeight: '700' },
    linkDiv: { height: 1, backgroundColor: c.line },
    subtle: { fontSize: ty.tiny, color: c.faint, marginTop: spacing.sm, lineHeight: 15 },
    examSel: { fontSize: ty.body, fontWeight: '800', color: c.blue, marginTop: spacing.xs },
    toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
    telemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
    telemTxt: { flex: 1 },
    telemLbl: { fontSize: ty.tiny, fontWeight: '600', color: c.mute },
    telemSwitch: { transform: [{ scale: 0.72 }] },
    credit: { fontSize: ty.tiny, color: c.mute, lineHeight: 16 },
    resetBtn: {
      marginTop: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: c.line,
      paddingVertical: spacing.sm, alignItems: 'center',
    },
    resetBtnArm: { borderColor: c.red, backgroundColor: c.ngBg },
    resetTxt: { fontSize: ty.small, color: c.mute, fontWeight: '700' },
    resetTxtArm: { color: c.red, fontWeight: '800' },
    // 開発用: 合格率ステッパー＋クイックチップ
    ppRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, marginTop: 6, marginBottom: 10 },
    ppStep: { width: 44, height: 44, borderRadius: 999, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' },
    ppStepTxt: { fontSize: 22, fontWeight: '800', color: c.ink2, marginTop: -2 },
    ppVal: { minWidth: 88, textAlign: 'center', fontSize: 22, fontWeight: '900', color: c.ink, fontVariant: ['tabular-nums'] },
    ppChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    ppChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface },
    ppChipOn: { backgroundColor: c.blue, borderColor: c.blue },
    ppChipTxt: { fontSize: 14, fontWeight: '800', color: c.ink2 },
    ppChipTxtOn: { color: '#fff' },
    version: { textAlign: 'center', color: c.faint, fontSize: ty.tiny, fontWeight: '600', marginTop: spacing.md, marginBottom: spacing.lg },
    acctCta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    acctGuide: { width: 48, height: 54 },
    acctTitle: { fontSize: ty.body, fontWeight: '800', color: c.ink },
    acctEmail: { fontSize: ty.body, fontWeight: '700', color: c.ink, marginTop: spacing.xs },
    deleteBottom: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.sm },
    deleteBottomTxt: { fontSize: ty.small, color: c.red, fontWeight: '700' },
  });
