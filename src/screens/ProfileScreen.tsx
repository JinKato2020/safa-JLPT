// 設定タブ(旧「自分」)= 設定特化。目標級・母語(端末言語から自動)・試験日・テーマ＋評価/ポリシー/規約＋出典/リセット。
// 継続・成長・バッジ・到達度はホーム(ダッシュボード)へ移動。
import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as StoreReview from 'expo-store-review';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState, useAppActions } from '../store/store';
import { L1_LIST, l1Name } from '../store/locale';
import { scheduleDailyReminder, cancelReminder } from '../store/notifications';
import { dayStr, daysBetween } from '../store/state';
import { META } from '../data';
import type { Level } from '../engine/engine';
import type { ThemeMode } from '../store/state';

const LEVELS: Level[] = ['N5', 'N4', 'N3'];
const THEMES: { v: ThemeMode; label: string }[] = [
  { v: 'light', label: 'ライト' },
  { v: 'dark', label: 'ダーク' },
  { v: 'auto', label: '自動' },
];
const REMINDERS = ['07:00', '12:00', '19:00', '21:00', '22:00'];

const PRIVACY = `まいにちJLPT プライバシーポリシー

本アプリは学習データ（到達度・学習履歴・設定）を利用者の端末内にのみ保存し、外部へ送信・収集しません。

• アカウント登録は不要で、氏名・メールアドレス等の個人情報は取得しません。
• 広告および解析ツールによる行動追跡は行いません。
• 「アプリを評価」を押すと OS 標準のレビュー機能（App Store / Google Play）が起動します。利用は各社のポリシーに従います。
• 辞書データは KANJIDIC2 / JMdict（© EDRDG）、例文は田中コーパス / Tatoeba を利用しています。

データは「学習データをリセット」またはアプリ削除で端末から完全に消去できます。本ポリシーは予告なく改定されることがあります。`;

const TERMS = `まいにちJLPT 利用規約

• 本アプリは JLPT（日本語能力試験）合格に向けた学習を支援するものです。
• 「到達度」「合格圏」等の指標は学習の目安であり、試験の合否を保証しません。
• JLPT の実施団体（国際交流基金・日本国際教育支援協会）とは関係ありません。
• 本アプリの利用により生じた損害について、開発者は責任を負いかねます。
• 仕様・内容は予告なく変更される場合があります。
• 辞書・例文データは各提供元のライセンス（EDRDG・CC BY 等）に従います。`;

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
        <Text style={s.tab}>設定</Text>
        <Text style={s.title}>設定</Text>

        {/* 学習設定 */}
        <View style={s.card}>
          <Text style={s.setLbl}>目標の級</Text>
          <View style={s.chipRow}>
            {LEVELS.map((lv) => (
              <Pressable key={lv} onPress={() => setSettings({ level: lv })} style={[s.chip, state.settings.level === lv && s.chipOn]}>
                <Text style={[s.chipTxt, state.settings.level === lv && s.chipTxtOn]}>{lv}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={s.setLbl}>母語（自動判定）</Text>
          <Pressable style={s.dropdown} onPress={() => setLangOpen((o) => !o)}>
            <Text style={s.dropdownTxt}>{l1Name(state.settings.l1)}</Text>
            <Text style={s.dropdownCaret}>{langOpen ? '▲' : '▼'}</Text>
          </Pressable>
          {langOpen ? (
            <View style={s.dropdownList}>
              {L1_LIST.map((o) => (
                <Pressable
                  key={o.code}
                  onPress={() => {
                    setSettings({ l1: o.code });
                    setLangOpen(false);
                  }}
                  style={s.dropdownItem}
                >
                  <Text style={[s.dropdownItemTxt, state.settings.l1 === o.code && s.dropdownItemOn]}>{o.name}</Text>
                  {state.settings.l1 === o.code ? <Text style={s.dropdownCheck}>✓</Text> : null}
                </Pressable>
              ))}
            </View>
          ) : null}
          <Text style={s.subtle}>端末の言語から自動設定。必要なら変更できます。</Text>

          <Text style={s.setLbl}>試験日</Text>
          <View style={s.chipWrap}>
            {exams.map((d) => (
              <Pressable key={d} onPress={() => setSettings({ examDate: d })} style={[s.chip, state.settings.examDate === d && s.chipOn]}>
                <Text style={[s.chipTxt, state.settings.examDate === d && s.chipTxtOn]}>
                  {d.slice(5).replace('-', '/')}（あと{daysBetween(today, d)}日）
                </Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setSettings({ examDate: null })} style={[s.chip, !state.settings.examDate && s.chipOn]}>
              <Text style={[s.chipTxt, !state.settings.examDate && s.chipTxtOn]}>未定</Text>
            </Pressable>
          </View>

          <Text style={s.setLbl}>テーマ</Text>
          <View style={s.chipRow}>
            {THEMES.map((t) => (
              <Pressable key={t.v} onPress={() => setSettings({ theme: t.v })} style={[s.chip, state.settings.theme === t.v && s.chipOn]}>
                <Text style={[s.chipTxt, state.settings.theme === t.v && s.chipTxtOn]}>{t.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={s.setLbl}>学習リマインド</Text>
          <View style={s.chipWrap}>
            {REMINDERS.map((t) => (
              <Pressable
                key={t}
                onPress={() => {
                  setSettings({ reminder: t });
                  void scheduleDailyReminder(t);
                }}
                style={[s.chip, state.settings.reminder === t && s.chipOn]}
              >
                <Text style={[s.chipTxt, state.settings.reminder === t && s.chipTxtOn]}>{t}</Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => {
                setSettings({ reminder: null });
                void cancelReminder();
              }}
              style={[s.chip, !state.settings.reminder && s.chipOn]}
            >
              <Text style={[s.chipTxt, !state.settings.reminder && s.chipTxtOn]}>オフ</Text>
            </Pressable>
          </View>
          <Text style={s.subtle}>※ 毎日この時刻に通知します。通知は実機アプリで届きます（Web／一部のExpo Goは制限あり）。</Text>
        </View>

        {/* サポート・規約 */}
        <Text style={s.sectionH}>サポート・規約</Text>
        <View style={s.card}>
          <Pressable style={s.linkRow} onPress={rate}>
            <Text style={s.linkTxt}>⭐ アプリを評価する</Text>
            <Text style={s.chev}>›</Text>
          </Pressable>
          <View style={s.linkDiv} />
          <Pressable style={s.linkRow} onPress={() => setLegal((v) => (v === 'privacy' ? null : 'privacy'))}>
            <Text style={s.linkTxt}>プライバシーポリシー</Text>
            <Text style={s.chev}>{legal === 'privacy' ? '▲' : '›'}</Text>
          </Pressable>
          {legal === 'privacy' ? <Text style={s.legal}>{PRIVACY}</Text> : null}
          <View style={s.linkDiv} />
          <Pressable style={s.linkRow} onPress={() => setLegal((v) => (v === 'terms' ? null : 'terms'))}>
            <Text style={s.linkTxt}>利用規約</Text>
            <Text style={s.chev}>{legal === 'terms' ? '▲' : '›'}</Text>
          </Pressable>
          {legal === 'terms' ? <Text style={s.legal}>{TERMS}</Text> : null}
        </View>

        {/* 出典・リセット */}
        <View style={s.card}>
          <Text style={s.setLbl}>データ出典</Text>
          <Text style={s.credit}>
            漢字=KANJIDIC2 / 語彙=JMdict（© EDRDG・CC BY-SA）。語彙の例文=田中コーパス/Tatoeba（CC BY）。文法の説明・例文・活用は本アプリのオリジナル。
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
              {confirmReset ? 'もう一度タップで全消去' : '学習データをリセット'}
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
