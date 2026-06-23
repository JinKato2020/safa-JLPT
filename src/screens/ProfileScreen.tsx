// 設定タブ(旧「自分」)= 設定特化。目標級・母語(端末言語から自動)・試験日・テーマ＋評価/ポリシー/規約＋出典/リセット。
// 継続・成長・バッジ・到達度はホーム(ダッシュボード)へ移動。
import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as StoreReview from 'expo-store-review';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState, useAppActions } from '../store/store';
import { scheduleDailyReminder, cancelReminder } from '../store/notifications';
import { dayStr, daysBetween } from '../store/state';
import { META } from '../data';
import type { Level } from '../engine/engine';
import type { ThemeMode } from '../store/state';
import { useT, UI_LANGS, useUiLang } from '../i18n';

const LEVELS: Level[] = ['N5', 'N4', 'N3'];
const THEMES: { v: ThemeMode; labelKey: 'profile.themeLight' | 'profile.themeDark' | 'profile.themeAuto' }[] = [
  { v: 'light', labelKey: 'profile.themeLight' },
  { v: 'dark', labelKey: 'profile.themeDark' },
  { v: 'auto', labelKey: 'profile.themeAuto' },
];
const REMINDERS = ['07:00', '12:00', '19:00', '21:00', '22:00'];


function firstSundayOf(year: number, month: number): string {
  for (let d = 1; d <= 7; d++) {
    if (new Date(Date.UTC(year, month - 1, d)).getUTCDay() === 0) {
      return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  return `${year}-${String(month).padStart(2, '0')}-01`;
}
/** 次回以降のJLPT(7月・12月の第1日曜)を最大2つ。 */
function upcomingExams(today: string): string[] {
  const y = Number(today.slice(0, 4));
  return [firstSundayOf(y, 7), firstSundayOf(y, 12), firstSundayOf(y + 1, 7), firstSundayOf(y + 1, 12)]
    .filter((d) => d > today)
    .slice(0, 2);
}

export default function ProfileScreen() {
  const t = useT();
  const uiLang = useUiLang();
  const state = useAppState();
  const { setSettings, reset } = useAppActions();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const today = dayStr(Date.now());
  const exams = useMemo(() => upcomingExams(today), [today]);
  const [confirmReset, setConfirmReset] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [legal, setLegal] = useState<'privacy' | 'terms' | null>(null);

  const rate = async () => {
    try {
      if (await StoreReview.isAvailableAsync()) await StoreReview.requestReview();
    } catch {
      // レビュー機能が使えない環境では何もしない
    }
  };

  return (
    <SafeAreaView style={s.c} edges={['top']}>
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.tab}>{t('profile.tab')}</Text>
        <Text style={s.title}>{t('profile.title')}</Text>

        {/* 学習設定 */}
        <View style={s.card}>
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
                    setSettings({ uiLang: o.code });
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
          <View style={s.chipWrap}>
            {exams.map((d) => (
              <Pressable key={d} onPress={() => setSettings({ examDate: d })} style={[s.chip, state.settings.examDate === d && s.chipOn]}>
                <Text style={[s.chipTxt, state.settings.examDate === d && s.chipTxtOn]}>
                  {d.slice(5).replace('-', '/')}{t('profile.examDaysLeft', { n: daysBetween(today, d) })}
                </Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setSettings({ examDate: null })} style={[s.chip, !state.settings.examDate && s.chipOn]}>
              <Text style={[s.chipTxt, !state.settings.examDate && s.chipTxtOn]}>{t('profile.examUndecided')}</Text>
            </Pressable>
          </View>

          <Text style={s.setLbl}>{t('profile.theme')}</Text>
          <View style={s.chipRow}>
            {THEMES.map((th) => (
              <Pressable key={th.v} onPress={() => setSettings({ theme: th.v })} style={[s.chip, state.settings.theme === th.v && s.chipOn]}>
                <Text style={[s.chipTxt, state.settings.theme === th.v && s.chipTxtOn]}>{t(th.labelKey)}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={s.setLbl}>{t('profile.reminder')}</Text>
          <View style={s.chipWrap}>
            {REMINDERS.map((r) => (
              <Pressable
                key={r}
                onPress={() => {
                  setSettings({ reminder: r });
                  void scheduleDailyReminder(r);
                }}
                style={[s.chip, state.settings.reminder === r && s.chipOn]}
              >
                <Text style={[s.chipTxt, state.settings.reminder === r && s.chipTxtOn]}>{r}</Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => {
                setSettings({ reminder: null });
                void cancelReminder();
              }}
              style={[s.chip, !state.settings.reminder && s.chipOn]}
            >
              <Text style={[s.chipTxt, !state.settings.reminder && s.chipTxtOn]}>{t('profile.reminderOff')}</Text>
            </Pressable>
          </View>
          <Text style={s.subtle}>{t('profile.reminderHint')}</Text>
        </View>

        {/* サポート・規約 */}
        <Text style={s.sectionH}>{t('profile.supportSection')}</Text>
        <View style={s.card}>
          <Pressable style={s.linkRow} onPress={rate}>
            <Text style={s.linkTxt}>⭐ {t('profile.rateApp')}</Text>
            <Text style={s.chev}>›</Text>
          </Pressable>
          <View style={s.linkDiv} />
          <Pressable style={s.linkRow} onPress={() => setLegal((v) => (v === 'privacy' ? null : 'privacy'))}>
            <Text style={s.linkTxt}>{t('profile.privacy')}</Text>
            <Text style={s.chev}>{legal === 'privacy' ? '▲' : '›'}</Text>
          </Pressable>
          {legal === 'privacy' ? <Text style={s.legal}>{t('profile.privacyBody')}</Text> : null}
          <View style={s.linkDiv} />
          <Pressable style={s.linkRow} onPress={() => setLegal((v) => (v === 'terms' ? null : 'terms'))}>
            <Text style={s.linkTxt}>{t('profile.terms')}</Text>
            <Text style={s.chev}>{legal === 'terms' ? '▲' : '›'}</Text>
          </Pressable>
          {legal === 'terms' ? <Text style={s.legal}>{t('profile.termsBody')}</Text> : null}
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
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    c: { flex: 1, backgroundColor: c.bg },
    body: { padding: spacing.lg, gap: spacing.sm },
    tab: { fontSize: ty.small, fontWeight: '700', letterSpacing: 1, color: c.mute },
    title: { fontSize: ty.h1, fontWeight: '800', color: c.ink, marginTop: spacing.xs },
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
    legal: { fontSize: ty.tiny, color: c.mute, lineHeight: 18, paddingBottom: spacing.sm },
    subtle: { fontSize: ty.tiny, color: c.faint, marginTop: spacing.sm, lineHeight: 15 },
    credit: { fontSize: ty.tiny, color: c.mute, lineHeight: 16 },
    resetBtn: {
      marginTop: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: c.line,
      paddingVertical: spacing.sm, alignItems: 'center',
    },
    resetBtnArm: { borderColor: c.red, backgroundColor: c.ngBg },
    resetTxt: { fontSize: ty.small, color: c.mute, fontWeight: '700' },
    resetTxtArm: { color: c.red, fontWeight: '800' },
  });
