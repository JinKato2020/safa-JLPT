import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppActions } from '../store/store';
import { detectL1 } from '../store/locale';
import { useT } from '../i18n';
import ListeningDownloadGate from '../components/ListeningDownloadGate';
import { sendEvent } from '../telemetry/telemetry';
import type { Level } from '../engine/engine';
import type { TargetExam, Wish, WishKind } from '../store/state';
import { makeWish } from '../story/wish';

const LEVELS: Level[] = ['N5', 'N4', 'N3'];

const LEVEL_DESC_KEYS: Record<Level, string> = {
  N5: 'onboarding.desc_n5',
  N4: 'onboarding.desc_n4',
  N3: 'onboarding.desc_n3',
};

// 願い(物語の軸)の選択肢。custom/later はカード下部で別扱い。i18nキー=wish.opt_<kind>。
const WISH_OPTS: WishKind[] = ['work_live', 'study', 'talk', 'family', 'like', 'self'];

export default function OnboardingScreen() {
  const { setSettings } = useAppActions();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const [exam, setExam] = useState<TargetExam | null>(null); // 1段目: 試験選択(JLPT/JFT)
  const [level, setLevel] = useState<Level>('N4');            // 2段目: JLPTのみ級指定
  const [pending, setPending] = useState(false);
  const [wishStep, setWishStep] = useState(false);          // 3段目: 願い(なぜ学ぶか)
  const [wish, setWish] = useState<Wish | null>(null);
  const [customOpen, setCustomOpen] = useState(false);      // その他=自由記述の展開
  const [customText, setCustomText] = useState('');
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
          setSettings({ targetExam: exam ?? 'jlpt', level: lv, l1: detectL1(), onboarded: true, ...(wish ? { wish } : {}) });
        }}
      />
    );
  }

  // 願い(物語の軸): 級選択の後・DLの前に一度だけ聞く。スキップ可・あとで変更可。仕様 §1
  if (wishStep) {
    const proceed = (w: Wish) => { setWish(w); setWishStep(false); setPending(true); };
    return (
      <SafeAreaView style={s.c}>
        <ScrollView contentContainerStyle={s.body}>
          <Text style={s.title}>{t('wish.question')}</Text>
          <Text style={s.wishSub}>{t('wish.sub')}</Text>
          {WISH_OPTS.map((k) => (
            <Pressable key={k} style={s.wishBtn} onPress={() => proceed(makeWish(k, Date.now()))}>
              <Text style={s.wishBtnTxt}>{t(`wish.opt_${k}`)}</Text>
            </Pressable>
          ))}
          {!customOpen ? (
            <Pressable style={s.wishBtn} onPress={() => setCustomOpen(true)}>
              <Text style={s.wishBtnTxt}>{t('wish.opt_custom')}</Text>
            </Pressable>
          ) : (
            <View style={s.wishCustomWrap}>
              <TextInput
                style={s.wishInput}
                placeholder={t('wish.custom_placeholder')}
                placeholderTextColor={c.faint}
                value={customText}
                onChangeText={setCustomText}
                maxLength={40}
                autoFocus
              />
              <Pressable style={s.wishCustomOk} onPress={() => proceed(makeWish('custom', Date.now(), customText))}>
                <Text style={s.wishCustomOkTxt}>{t('wish.custom_ok')}</Text>
              </Pressable>
            </View>
          )}
          <Pressable style={s.wishLater} onPress={() => proceed(makeWish('later', Date.now()))}>
            <Text style={s.wishLaterTxt}>{t('wish.later')}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
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

        <Pressable style={[s.cta, !exam && s.ctaOff]} disabled={!exam} onPress={() => setWishStep(true)}>
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
    // 願いカード
    wishSub: { fontSize: ty.small, color: c.mute, marginTop: spacing.xs, marginBottom: spacing.md },
    wishBtn: { borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, paddingVertical: spacing.md, paddingHorizontal: spacing.md, marginTop: spacing.sm },
    wishBtnTxt: { fontSize: ty.body, fontWeight: '700', color: c.ink },
    wishCustomWrap: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, alignItems: 'center' },
    wishInput: { flex: 1, borderRadius: radius.lg, borderWidth: 1, borderColor: c.blue, backgroundColor: c.surface, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, fontSize: ty.body, color: c.ink },
    wishCustomOk: { backgroundColor: c.blue, borderRadius: radius.lg, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
    wishCustomOkTxt: { color: '#ffffff', fontSize: ty.body, fontWeight: '800' },
    wishLater: { alignSelf: 'center', marginTop: spacing.lg, padding: spacing.sm },
    wishLaterTxt: { fontSize: ty.small, color: c.mute, fontWeight: '600', textDecorationLine: 'underline' },
  });
