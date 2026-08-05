import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ImageBackground, Switch, Animated, Image, TextInput, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppActions } from '../store/store';
import { detectL1 } from '../store/locale';
import { useT } from '../i18n';
import ListeningDownloadGate from '../components/ListeningDownloadGate';
import { sendEvent } from '../telemetry/telemetry';
import { upcomingExams } from '../data/jlptDates';
import { avatarsByGender, DEFAULT_AVATAR } from '../plaza/avatars';
import { COUNTRIES, flagOf, detectCountry } from '../plaza/countries';
import { scheduleDailyReminder } from '../store/notifications';
import type { Level } from '../engine/engine';
import type { TargetExam } from '../store/state';

const OPENING = require('../../assets/onboarding/opening.jpg');
const LEVELS: Level[] = ['N5', 'N4', 'N3'];
const REMINDER_TIME = '20:00'; // オンボ既定。細かい時刻は設定で変更可。

const LEVEL_DESC_KEYS: Record<Level, string> = {
  N5: 'onboarding.desc_n5',
  N4: 'onboarding.desc_n4',
  N3: 'onboarding.desc_n3',
};

// "2026-12-06" → "2026年12月6日"
const jfmt = (d: string) => `${d.slice(0, 4)}年${Number(d.slice(5, 7))}月${Number(d.slice(8, 10))}日`;

export default function OnboardingScreen() {
  const { setSettings } = useAppActions();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const t = useT();

  const today = new Date().toISOString().slice(0, 10);
  const exams = useMemo(() => upcomingExams(today), [today]);

  const [step, setStep] = useState<'greet' | 'setup' | 'profile'>('greet'); // 0=挨拶 / setup=試験 / profile=町のプロフィール
  const [exam, setExam] = useState<TargetExam | null>(null);      // 1段目: 試験選択(JLPT/JFT)
  // 町のプロフィール(ニックネーム/国/性別/アバター)
  const [nickname, setNickname] = useState('');
  const [gender, setGender] = useState<'m' | 'f'>('m');
  const [avatar, setAvatar] = useState<string>(DEFAULT_AVATAR);
  const [country, setCountry] = useState<string>(() => detectCountry());
  const [level, setLevel] = useState<Level>('N4');                // 2段目: JLPTのみ級指定
  const [examDate, setExamDate] = useState<string | null>(exams[0] ?? null); // 受験予定日=既定は直近のJLPT
  const [reminderOn, setReminderOn] = useState(false);            // 毎日のリマインド(任意)
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);                      // オープニングは2秒固定→タップ受付
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const id = setTimeout(() => {
      setReady(true);
      Animated.timing(fade, { toValue: 1, duration: 450, useNativeDriver: true }).start();
    }, 2000);
    return () => clearTimeout(id);
  }, [fade]);

  // ── 0. オープニング（画像に台詞をレイヤー。桜と重ならないよう上部表示） ──
  if (step === 'greet') {
    const scrimH = Math.round(H * 0.52);
    return (
      <ImageBackground source={OPENING} style={g.full} resizeMode="cover">
        <Svg width={W} height={scrimH} style={g.scrim} pointerEvents="none">
          <Defs>
            <LinearGradient id="sc" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#160f08" stopOpacity={0.66} />
              <Stop offset="0.34" stopColor="#160f08" stopOpacity={0.46} />
              <Stop offset="0.72" stopColor="#160f08" stopOpacity={0.1} />
              <Stop offset="1" stopColor="#160f08" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={W} height={scrimH} fill="url(#sc)" />
        </Svg>
        <Pressable style={g.full} onPress={ready ? () => setStep('setup') : undefined}>
          <View style={[g.copy, { paddingTop: insets.top + 44 }]}>
            <Text style={g.l1}>{t('onboarding.greet1')}</Text>
            <Text style={g.l2}>{t('onboarding.greet2')}</Text>
          </View>
          {ready && (
            <Animated.Text style={[g.tap, { bottom: insets.bottom + 34, opacity: fade }]}>{t('onboarding.tap_start')}</Animated.Text>
          )}
        </Pressable>
      </ImageBackground>
    );
  }

  // ── 選択完了→そのレベルの聴解音声を一括DL(スキップ可)。完了/スキップでオンボード完了。 ──
  if (pending) {
    const lv: Level = exam === 'jft' ? 'N4' : level;
    return (
      <ListeningDownloadGate
        level={lv}
        allowSkip
        onComplete={() => {
          const rem = reminderOn ? REMINDER_TIME : null;
          sendEvent('onboarding_complete', { exam: exam ?? 'jlpt', level: lv });
          setSettings({
            targetExam: exam ?? 'jlpt',
            level: lv,
            l1: detectL1(),
            examDate: exam === 'jlpt' ? examDate : null,
            reminder: rem,
            nickname: nickname.trim() || undefined,
            country,
            gender,
            avatar,
            onboarded: true,
          });
          if (rem) void scheduleDailyReminder(rem);
        }}
      />
    );
  }

  // ── プロフィール（町/広場: ニックネーム・国・性別・アバター）。試験設定の後、DLの前 ──
  if (step === 'profile') {
    const avs = avatarsByGender(gender);
    const canGo = nickname.trim().length >= 1;
    return (
      <SafeAreaView style={s.c}>
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          <Text style={s.title}>{t('onboarding.profile_title')}</Text>
          <Text style={s.levelDesc}>{t('onboarding.profile_sub')}</Text>

          <Text style={s.label}>{t('onboarding.nickname_label')}</Text>
          <TextInput
            value={nickname}
            onChangeText={setNickname}
            placeholder={t('onboarding.nickname_ph')}
            placeholderTextColor={c.faint}
            maxLength={12}
            style={s.input}
          />

          <Text style={s.label}>{t('onboarding.gender_label')}</Text>
          <View style={s.row}>
            {(['m', 'f'] as const).map((g) => (
              <Pressable key={g} onPress={() => { setGender(g); setAvatar(avatarsByGender(g)[0]?.code ?? DEFAULT_AVATAR); }} style={[s.chip, gender === g && s.chipOn]}>
                <Text style={[s.chipTxt, gender === g && s.chipTxtOn]}>{t(g === 'm' ? 'onboarding.gender_m' : 'onboarding.gender_f')}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={s.label}>{t('onboarding.avatar_label')}</Text>
          {gender === 'f' && <Text style={s.hintTxt}>{t('onboarding.female_soon')}</Text>}
          <View style={s.avGrid}>
            {avs.map((a) => (
              <Pressable key={a.code} onPress={() => setAvatar(a.code)} style={[s.avCell, avatar === a.code && s.avCellOn]}>
                {a.image != null
                  ? <Image source={a.image} style={s.avImg} resizeMode="contain" />
                  : <Text style={s.avEmoji}>{a.emoji}</Text>}
              </Pressable>
            ))}
          </View>

          <Text style={s.label}>{t('onboarding.country_label')}</Text>
          <View style={s.flagWrap}>
            {COUNTRIES.map((co) => (
              <Pressable key={co.code} onPress={() => setCountry(co.code)} style={[s.flagChip, country === co.code && s.chipOn]}>
                <Text style={s.flagEmoji}>{co.code === 'XX' ? '🏳️' : flagOf(co.code)}</Text>
                <Text style={[s.flagTxt, country === co.code && s.chipTxtOn]}>{co.name}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable style={[s.cta, !canGo && s.ctaOff]} disabled={!canGo} onPress={() => setPending(true)}>
            <Text style={[s.ctaTxt, !canGo && s.ctaOffTxt]}>{t('onboarding.start')}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── 1〜3. AIコーチの設定（アプリと同じテーマ＝ライト/ダーク） ──
  return (
    <SafeAreaView style={s.c}>
      <ScrollView contentContainerStyle={s.body}>
        <View style={s.coachBadge}>
          <View style={s.coachDot}><Text style={s.coachDotTxt}>◇</Text></View>
          <Text style={s.coachLbl}>AI COACH</Text>
        </View>
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

        {/* 2a. JLPT=目標の級＋受験予定日 */}
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

            <View style={s.labelRow}>
              <Text style={s.label}>{t('profile.examDate')}</Text>
              <Text style={s.opt}>{t('onboarding.optional')}</Text>
            </View>
            <View style={s.dateWrap}>
              {exams.map((d) => (
                <Pressable key={d} onPress={() => setExamDate(examDate === d ? null : d)} style={[s.dateChip, examDate === d && s.chipOn]}>
                  <Text style={[s.dateTxt, examDate === d && s.chipTxtOn]}>{jfmt(d)}</Text>
                </Pressable>
              ))}
              <Pressable onPress={() => setExamDate(null)} style={[s.dateChip, examDate === null && s.chipOn]}>
                <Text style={[s.dateTxt, examDate === null && s.chipTxtOn]}>{t('profile.examUndecided')}</Text>
              </Pressable>
            </View>
          </>
        )}
        {/* 2b. JFT=単一試験(級選択なし)の注記 */}
        {exam === 'jft' && <Text style={s.levelDesc}>{t('profile.jft_note')}</Text>}

        {/* 3. 毎日のリマインド(任意) */}
        {exam && (
          <>
            <View style={s.labelRow}>
              <Text style={s.label}>{t('profile.reminder')}</Text>
              <Text style={s.opt}>{t('onboarding.optional')}</Text>
            </View>
            <View style={s.remRow}>
              <Text style={s.remTxt}>{reminderOn ? t('notif.reminder_on', { t: REMINDER_TIME }) : t('notif.reminder_off')}</Text>
              <Switch value={reminderOn} onValueChange={setReminderOn} trackColor={{ true: c.blue }} />
            </View>
          </>
        )}

        <Pressable style={[s.cta, !exam && s.ctaOff]} disabled={!exam} onPress={() => setStep('profile')}>
          <Text style={[s.ctaTxt, !exam && s.ctaOffTxt]}>{t('onboarding.next')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

// オープニング（画像上の白文字。テーマ非依存＝常に視認性優先の白＋影） ──
const g = StyleSheet.create({
  full: { flex: 1, width: '100%', height: '100%' },
  scrim: { position: 'absolute', top: 0, left: 0 },
  copy: { paddingHorizontal: 26, alignItems: 'center' },
  l1: {
    fontSize: 32, fontWeight: '700', color: '#fff', textAlign: 'center', letterSpacing: 0.5, lineHeight: 46,
    textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 12,
  },
  l2: {
    fontSize: 26, fontWeight: '600', color: '#fff', textAlign: 'center', letterSpacing: 0.3, lineHeight: 42, marginTop: 14,
    textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 12,
  },
  tap: { position: 'absolute', left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.9)', fontSize: 15, letterSpacing: 3 },
});

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    c: { flex: 1, backgroundColor: c.bg },
    body: { padding: spacing.lg, gap: spacing.sm },
    coachBadge: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    coachDot: { width: 32, height: 32, borderRadius: 9, backgroundColor: c.blue, alignItems: 'center', justifyContent: 'center' },
    coachDotTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
    coachLbl: { fontSize: ty.small, fontWeight: '700', letterSpacing: 2, color: c.mute },
    title: { fontSize: ty.h1, fontWeight: '800', color: c.ink, marginTop: spacing.xs ?? 4 },
    label: { fontSize: ty.small, fontWeight: '700', color: c.ink2, marginTop: spacing.lg },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.lg },
    opt: { fontSize: ty.tiny, color: c.faint, borderWidth: 1, borderColor: c.line, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden' },
    levelDesc: { fontSize: ty.small, color: c.ink2, marginTop: spacing.sm, lineHeight: 18 },
    // 試験選択カード
    examRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    examCard: { flex: 1, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, padding: spacing.md, gap: 4 },
    examCardOn: { borderColor: c.blue, borderWidth: 2, backgroundColor: c.blueLight },
    examTitle: { fontSize: ty.h2, fontWeight: '800', color: c.ink },
    examTitleOn: { color: c.blueDark },
    examDesc: { fontSize: ty.tiny, color: c.mute, lineHeight: 15 },
    examDescOn: { color: c.blueDark },
    row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    chip: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface },
    chipOn: { borderColor: c.blue, backgroundColor: c.blueLight },
    chipTxt: { fontSize: ty.body, color: c.ink2, fontWeight: '600' },
    chipTxtOn: { color: c.blueDark, fontWeight: '800' },
    // 受験予定日
    dateWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
    dateChip: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface },
    dateTxt: { fontSize: ty.small, color: c.ink2, fontWeight: '600' },
    // リマインド
    remRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: radius.lg, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, marginTop: spacing.sm },
    remTxt: { fontSize: ty.small, color: c.ink2, flex: 1 },
    // プロフィール
    input: { marginTop: spacing.sm, borderWidth: 1, borderColor: c.line, borderRadius: radius.lg, backgroundColor: c.surface, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: ty.body, color: c.ink },
    hintTxt: { fontSize: ty.tiny, color: c.mute, marginTop: spacing.xs ?? 4 },
    avGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
    avCell: { width: 62, height: 62, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' },
    avCellOn: { borderColor: c.blue, borderWidth: 2, backgroundColor: c.blueLight },
    avImg: { width: 48, height: 48 },
    avEmoji: { fontSize: 30 },
    flagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
    flagChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 10 },
    flagEmoji: { fontSize: 16 },
    flagTxt: { fontSize: ty.small, color: c.ink2, fontWeight: '600' },
    cta: { marginTop: spacing.xl, backgroundColor: c.blue, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center' },
    ctaOff: { backgroundColor: c.bgSoft },
    ctaTxt: { color: '#ffffff', fontSize: ty.h2, fontWeight: '800' },
    ctaOffTxt: { color: c.faint },
  });
