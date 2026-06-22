import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppActions } from '../store/store';
import { detectL1, l1Name } from '../store/locale';
import type { Level } from '../engine/engine';

const LEVELS: Level[] = ['N5', 'N4', 'N3'];

export default function OnboardingScreen() {
  const { setSettings } = useAppActions();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const [level, setLevel] = useState<Level>('N4');
  const lang = l1Name(detectL1()); // 端末言語を自動判定

  return (
    <SafeAreaView style={s.c}>
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.brand}>まいにちJLPT</Text>
        <Text style={s.title}>はじめましょう</Text>
        <Text style={s.sub}>あなたに合わせて到達度を測ります。</Text>

        <Text style={s.label}>目標の級</Text>
        <View style={s.row}>
          {LEVELS.map((lv) => (
            <Pressable key={lv} onPress={() => setLevel(lv)} style={[s.chip, level === lv && s.chipOn]}>
              <Text style={[s.chipTxt, level === lv && s.chipTxtOn]}>{lv}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={s.cta} onPress={() => setSettings({ level, l1: detectL1(), onboarded: true })}>
          <Text style={s.ctaTxt}>診断を始める</Text>
        </Pressable>
        <Text style={s.note}>
          表示言語は「{lang}」を自動設定（後で「自分」タブから変更できます）。試験日も後で設定できます。
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    c: { flex: 1, backgroundColor: c.bg },
    body: { padding: spacing.lg, gap: spacing.sm },
    brand: { fontSize: ty.h2, fontWeight: '800', color: c.blue },
    title: { fontSize: ty.h1, fontWeight: '800', color: c.ink, marginTop: spacing.sm },
    sub: { fontSize: ty.small, color: c.mute, marginBottom: spacing.md },
    label: { fontSize: ty.small, fontWeight: '700', color: c.ink2, marginTop: spacing.md },
    row: { flexDirection: 'row', gap: spacing.sm },
    chip: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: c.line,
      backgroundColor: c.surface,
    },
    chipOn: { borderColor: c.blue, backgroundColor: c.blueLight },
    chipTxt: { fontSize: ty.body, color: c.ink2, fontWeight: '600' },
    chipTxtOn: { color: c.blueDark, fontWeight: '800' },
    cta: { marginTop: spacing.xl, backgroundColor: c.blue, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center' },
    ctaTxt: { color: '#ffffff', fontSize: ty.h2, fontWeight: '800' },
    note: { fontSize: ty.tiny, color: c.faint, textAlign: 'center', marginTop: spacing.sm, lineHeight: 16 },
  });
