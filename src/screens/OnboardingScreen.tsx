import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppActions } from '../store/store';
import { detectL1 } from '../store/locale';
import { useT } from '../i18n';
import ListeningDownloadGate from '../components/ListeningDownloadGate';
import { sendEvent } from '../telemetry/telemetry';
import type { Level } from '../engine/engine';
import type { TargetExam } from '../store/state';

const LEVELS: Level[] = ['N5', 'N4', 'N3'];

const LEVEL_DESC_KEYS: Record<Level, string> = {
  N5: 'onboarding.desc_n5',
  N4: 'onboarding.desc_n4',
  N3: 'onboarding.desc_n3',
};

export default function OnboardingScreen() {
  const { setSettings } = useAppActions();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const [exam, setExam] = useState<TargetExam | null>(null); // 1段目: 試験選択(JLPT/JFT)
  const [level, setLevel] = useState<Level>('N4');            // 2段目: JLPTのみ級指定
  const [pending, setPending] = useState(false);
  const t = useT();

  // 選択完了→そのレベルの聴解音声を一括DL(スキップ可)。完了/スキップでオンボード完了。JFTは知識ベースN4で開始。
  if (pending) {
    const lv: Level = exam === 'jft' ? 'N4' : level;
    return (
      <ListeningDownloadGate
        level={lv}
        allowSkip
        onComplete={() => {
          sendEvent('onboarding_complete', { exam: exam ?? 'jlpt', level: lv });
          setSettings({ targetExam: exam ?? 'jlpt', level: lv, l1: detectL1(), onboarded: true });
        }}
      />
    );
  }

  return (
    <SafeAreaView style={s.c}>
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.brand}>{t('onboarding.brand')}</Text>
        <Text style={s.title}>{t('onboarding.title')}</Text>

        {/* 1. 受ける試験を選ぶ(JLPT / JFT-Basic) */}
        <Text style={s.label}>{t('onboarding.exam_label')}</Text>
        <View style={s.examRow}>
          {(['jlpt', 'jft'] as const).map((ex) => (
            <Pressable key={ex} onPress={() => setExam(ex)} style={[s.examCard, exam === ex && s.examCardOn]}>
              <Text style={[s.examTitle, exam === ex && s.examTitleOn]}>{t(ex === 'jft' ? 'profile.exam_jft' : 'profile.exam_jlpt')}</Text>
              <Text style={[s.examDesc, exam === ex && s.examDescOn]}>{t(ex === 'jft' ? 'onboarding.exam_jft_desc' : 'onboarding.exam_jlpt_desc')}</Text>
            </Pressable>
          ))}
        </View>

        {/* 2a. JLPT=目標の級を選ぶ */}
        {exam === 'jlpt' && (
          <>
            <Text style={s.label}>{t('onboarding.level_label')}</Text>
            <View style={s.row}>
              {LEVELS.map((lv) => (
                <Pressable key={lv} onPress={() => setLevel(lv)} style={[s.chip, level === lv && s.chipOn]}>
                  <Text style={[s.chipTxt, level === lv && s.chipTxtOn]}>{lv}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={s.levelDesc}>{t(LEVEL_DESC_KEYS[level])}</Text>
            <Text style={s.levelHint}>{t('onboarding.level_hint')}</Text>
          </>
        )}
        {/* 2b. JFT=単一試験(級選択なし)の注記 */}
        {exam === 'jft' && <Text style={s.levelDesc}>{t('profile.jft_note')}</Text>}

        <Pressable style={[s.cta, !exam && s.ctaOff]} disabled={!exam} onPress={() => setPending(true)}>
          <Text style={[s.ctaTxt, !exam && s.ctaOffTxt]}>{t('onboarding.start')}</Text>
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
    label: { fontSize: ty.small, fontWeight: '700', color: c.ink2, marginTop: spacing.lg },
    levelDesc: { fontSize: ty.small, color: c.ink2, marginTop: spacing.sm, lineHeight: 18 },
    levelHint: { fontSize: ty.tiny, color: c.faint, marginTop: 2 },
    // 試験選択カード
    examRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    examCard: {
      flex: 1,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.line,
      backgroundColor: c.surface,
      padding: spacing.md,
      gap: 4,
    },
    examCardOn: { borderColor: c.blue, borderWidth: 2, backgroundColor: c.blueLight },
    examTitle: { fontSize: ty.h2, fontWeight: '800', color: c.ink },
    examTitleOn: { color: c.blueDark },
    examDesc: { fontSize: ty.tiny, color: c.mute, lineHeight: 15 },
    examDescOn: { color: c.blueDark },
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
    ctaOff: { backgroundColor: c.bgSoft },
    ctaTxt: { color: '#ffffff', fontSize: ty.h2, fontWeight: '800' },
    ctaOffTxt: { color: c.faint },
    note: { fontSize: ty.tiny, color: c.faint, textAlign: 'center', marginTop: spacing.sm, lineHeight: 16 },
  });
