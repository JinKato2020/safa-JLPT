import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppActions } from '../store/store';
import { detectL1 } from '../store/locale';
import type { Level } from '../engine/engine';

const LEVELS: Level[] = ['N5', 'N4', 'N3'];

const LEVEL_DESC: Record<Level, string> = {
  N5: 'いちばん易しい入門レベル。ひらがな・基本の語彙と文法から。',
  N4: '基礎レベル。初級（みんなの日本語など）を終えた人向け。',
  N3: '中級レベル。日常の文章がだいたい読める力。',
};

export default function OnboardingScreen() {
  const { setSettings } = useAppActions();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const [level, setLevel] = useState<Level>('N4');

  return (
    <SafeAreaView style={s.c}>
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.brand}>まいにちJLPT</Text>
        <Text style={s.title}>はじめましょう</Text>

        <Text style={s.label}>目標の級を選ぶ</Text>
        <View style={s.row}>
          {LEVELS.map((lv) => (
            <Pressable key={lv} onPress={() => setLevel(lv)} style={[s.chip, level === lv && s.chipOn]}>
              <Text style={[s.chipTxt, level === lv && s.chipTxtOn]}>{lv}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.levelDesc}>{LEVEL_DESC[level]}</Text>
        <Text style={s.levelHint}>後で「設定」から変更できます。</Text>

        <Pressable style={s.cta} onPress={() => setSettings({ level, l1: detectL1(), onboarded: true })}>
          <Text style={s.ctaTxt}>スタート</Text>
        </Pressable>
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
    levelDesc: { fontSize: ty.small, color: c.ink2, marginTop: spacing.sm, lineHeight: 18 },
    levelHint: { fontSize: ty.tiny, color: c.faint, marginTop: 2 },
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
    guide: { marginTop: spacing.lg, backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: spacing.md, gap: spacing.sm },
    guideTitle: { fontSize: ty.small, fontWeight: '800', color: c.ink2 },
    step: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    stepNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: c.blue, color: '#ffffff', fontSize: ty.small, fontWeight: '800', textAlign: 'center', lineHeight: 22, overflow: 'hidden' },
    stepTxt: { flex: 1, fontSize: ty.body, color: c.ink2 },
    cta: { marginTop: spacing.xl, backgroundColor: c.blue, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center' },
    ctaTxt: { color: '#ffffff', fontSize: ty.h2, fontWeight: '800' },
    note: { fontSize: ty.tiny, color: c.faint, textAlign: 'center', marginTop: spacing.sm, lineHeight: 16 },
  });
