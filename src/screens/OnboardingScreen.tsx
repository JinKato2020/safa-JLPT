import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ImageBackground, Animated, Image, TextInput, Modal, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppActions } from '../store/store';
import { useT } from '../i18n';
import ListeningDownloadGate from '../components/ListeningDownloadGate';
import { sendEvent } from '../telemetry/telemetry';
import { upcomingExams } from '../data/jlptDates';
import { avatarsByGender, DEFAULT_AVATAR } from '../plaza/avatars';
import { PERSONALITIES, MOOD_MESSAGES } from '../plaza/persona';
import { NATIVE_LANGS, nativeLangFlag, nativeLangCC, detectNativeLang } from '../plaza/countries';
import type { Level } from '../engine/engine';
import type { TargetExam } from '../store/state';

const OPENING = require('../../assets/onboarding/opening.jpg');
const LEVELS: Level[] = ['N5', 'N4', 'N3'];
// 学習リマインドはオンボでは尋ねない(設定画面で入力)。

const LEVEL_DESC_KEYS: Record<Level, string> = {
  N5: 'onboarding.desc_n5',
  N4: 'onboarding.desc_n4',
  N3: 'onboarding.desc_n3',
};

// 現状 実装済みは JLPT のみ(JFTは未対応)。試験選択は廃止し、常に JLPT のレベル選択から始める。
const EXAM: TargetExam = 'jlpt';

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
  // 母語プルダウン: デバイスの言語を先頭に並べ、既定で選ぶ。
  const langList = useMemo(() => {
    const d = detectNativeLang();
    const top = NATIVE_LANGS.find((l) => l.code === d);
    return top ? [top, ...NATIVE_LANGS.filter((l) => l.code !== d)] : NATIVE_LANGS;
  }, []);

  const [step, setStep] = useState<'greet' | 'setup'>('greet'); // 0=挨拶 / setup=試験＋町のプロフィールを1画面で入力
  // 町のプロフィール(ニックネーム/母語/性別/アバター/性格/気分)
  const [nickname, setNickname] = useState('');
  const [gender, setGender] = useState<'m' | 'f'>('m');
  const [avatar, setAvatar] = useState<string>(DEFAULT_AVATAR);
  const [nativeLang, setNativeLang] = useState<string>(() => detectNativeLang()); // 母語=デバイスの言語が既定
  const [personality, setPersonality] = useState<string>(PERSONALITIES[0].key); // 性格(20種)
  const [moodMsg, setMoodMsg] = useState<string>(MOOD_MESSAGES[0].key);          // 気分(20種)
  const [pickerOpen, setPickerOpen] = useState<null | 'personality' | 'mood' | 'lang'>(null); // タップで開くリスト選択
  const [level, setLevel] = useState<Level>('N4');                // JLPTの目標級
  const [examDate, setExamDate] = useState<string | null>(exams[0] ?? null); // 受験予定日=既定は直近のJLPT
  const [audioMode, setAudioMode] = useState<'download' | 'stream'>('download'); // 聴解音声=一括DL / 都度DL(この画面の最後で選択)
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

  // オンボード完了=全設定を保存(聴解音声の取得方式を含む)。都度DLなら即完了 / 一括DLはゲートでDL後に呼ぶ。
  const finish = () => {
    sendEvent('onboarding_complete', { exam: EXAM, level });
    setSettings({
      targetExam: EXAM,
      level,
      l1: nativeLang, // 母語=翻訳言語(デバイス言語が既定)
      examDate,
      reminder: null, // リマインドは設定画面で入力(オンボでは尋ねない)
      nickname: nickname.trim() || undefined,
      country: nativeLangCC(nativeLang), // アバターの国旗は母語の国旗(英語=アメリカ)
      gender,
      avatar,
      personality,
      moodMsg,
      listeningAudioMode: audioMode, // 聴解音声の取得方式(この画面の最後で選択)
      onboarded: true, // トラッキング許可は既定ON(未設定=許可)。オフは設定画面で。
    });
  };

  // ── 一括DLを選んだ場合のみ、そのレベルの聴解音声をDL(方式は選択済み=確認を出さず即DL・失敗時のみスキップ可)。完了でオンボ確定。 ──
  if (pending) {
    return <ListeningDownloadGate level={level} allowSkip autoStart onComplete={finish} />;
  }

  // ── 1画面で全設定（試験＝JLPTのレベル/受験日 ＋ 町のプロフィール ＋ リマインド ＋ トラッキング許可） ──
  const avs = avatarsByGender(gender);
  const canGo = nickname.trim().length >= 1;
  return (
    <SafeAreaView style={s.c}>
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <View style={s.coachBadge}>
          <View style={s.coachDot}><Text style={s.coachDotTxt}>◇</Text></View>
          <Text style={s.coachLbl}>AI COACH</Text>
        </View>
        <Text style={s.title}>{t('onboarding.title')}</Text>

        {/* 1. 目標の級(JLPT)。JFTは未対応=試験選択は廃止。 */}
        <Text style={s.label}>{t('onboarding.level_label')}</Text>
        <View style={s.row}>
          {LEVELS.map((lv) => (
            <Pressable key={lv} onPress={() => setLevel(lv)} style={[s.chip, level === lv && s.chipOn]}>
              <Text style={[s.chipTxt, level === lv && s.chipTxtOn]}>{lv}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.levelDesc}>{t(LEVEL_DESC_KEYS[level])}</Text>

        {/* 2. 受験予定日(任意) */}
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

        {/* 3. 町でのあなた(プロフィール) */}
        <Text style={s.sectionTitle}>{t('onboarding.profile_title')}</Text>
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
          {(['m', 'f'] as const).map((gd) => (
            <Pressable key={gd} onPress={() => { setGender(gd); setAvatar(avatarsByGender(gd)[0]?.code ?? DEFAULT_AVATAR); }} style={[s.chip, gender === gd && s.chipOn]}>
              <Text style={[s.chipTxt, gender === gd && s.chipTxtOn]}>{t(gd === 'm' ? 'onboarding.gender_m' : 'onboarding.gender_f')}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.label}>{t('onboarding.avatar_label')}</Text>
        <View style={s.avGrid}>
          {avs.map((a) => (
            <Pressable key={a.code} onPress={() => setAvatar(a.code)} style={[s.avCell, avatar === a.code && s.avCellOn]}>
              {a.image != null
                ? <Image source={a.image} style={s.avImg} resizeMode="contain" />
                : <Text style={s.avEmoji}>{a.emoji}</Text>}
            </Pressable>
          ))}
        </View>

        <Text style={s.label}>母語</Text>
        <Pressable style={s.pickField} onPress={() => setPickerOpen('lang')}>
          <Text style={s.pickFieldTxt}>{(() => { const l = NATIVE_LANGS.find((x) => x.code === nativeLang); return l ? `${nativeLangFlag(l.code)}  ${l.label}` : '選ぶ'; })()}</Text>
          <Text style={s.pickCaret}>▾</Text>
        </Pressable>

        <Text style={s.label}>性格</Text>
        <Pressable style={s.pickField} onPress={() => setPickerOpen('personality')}>
          <Text style={s.pickFieldTxt}>{(() => { const p = PERSONALITIES.find((x) => x.key === personality); return p ? `${p.emoji} ${p.label}` : '選ぶ'; })()}</Text>
          <Text style={s.pickCaret}>▾</Text>
        </Pressable>

        <Text style={s.label}>気分</Text>
        <Pressable style={s.pickField} onPress={() => setPickerOpen('mood')}>
          <Text style={s.pickFieldTxt}>{MOOD_MESSAGES.find((x) => x.key === moodMsg)?.text ?? '選ぶ'}</Text>
          <Text style={s.pickCaret}>▾</Text>
        </Pressable>

        {/* 4. 聴解音声の取得方式(この画面の最後で選択・別画面にしない)。一括DL=オフライン / 都度DL=容量節約。 */}
        <Text style={s.label}>{t('profile.listeningAudio')}</Text>
        <View style={s.row}>
          {(['download', 'stream'] as const).map((m) => (
            <Pressable key={m} onPress={() => setAudioMode(m)} style={[s.chip, audioMode === m && s.chipOn]}>
              <Text style={[s.chipTxt, audioMode === m && s.chipTxtOn]}>{t(m === 'download' ? 'profile.listeningAudio_download' : 'profile.listeningAudio_stream')}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.levelDesc}>{t(audioMode === 'stream' ? 'profile.listeningAudioHint_stream' : 'profile.listeningAudioHint_download')}</Text>

        {/* 学習リマインド・トラッキング許可は設定画面で入力(オンボでは尋ねない)。 */}
        {/* 完了: 都度DL=そのまま完了 / 一括DL=次にゲートで音声をDLしてから完了。 */}
        <Pressable style={[s.cta, !canGo && s.ctaOff]} disabled={!canGo} onPress={() => { if (audioMode === 'stream') finish(); else setPending(true); }}>
          <Text style={[s.ctaTxt, !canGo && s.ctaOffTxt]}>{t('onboarding.start')}</Text>
        </Pressable>
      </ScrollView>

      {/* 性格/ムードのリスト選択(タップで開く) */}
      <Modal visible={pickerOpen !== null} transparent animationType="slide" onRequestClose={() => setPickerOpen(null)}>
        <Pressable style={s.pickBackdrop} onPress={() => setPickerOpen(null)} />
        <View style={s.pickSheet}>
          <Text style={s.pickTitle}>{pickerOpen === 'personality' ? '性格を選ぶ' : pickerOpen === 'lang' ? '母語を選ぶ' : '気分を選ぶ'}</Text>
          <ScrollView style={{ maxHeight: Math.round(H * 0.5) }} contentContainerStyle={{ paddingBottom: 8 }}>
            {pickerOpen === 'lang'
              ? langList.map((l) => {
                  const on = nativeLang === l.code;
                  return (
                    <Pressable key={l.code} style={[s.pickRow, on && s.pickRowOn]} onPress={() => { setNativeLang(l.code); setPickerOpen(null); }}>
                      <Text style={[s.pickRowTxt, on && s.pickRowTxtOn]}>{nativeLangFlag(l.code)}  {l.label}</Text>
                      {on && <Text style={s.pickCheck}>✓</Text>}
                    </Pressable>
                  );
                })
              : pickerOpen === 'personality'
              ? PERSONALITIES.map((p) => {
                  const on = personality === p.key;
                  return (
                    <Pressable key={p.key} style={[s.pickRow, on && s.pickRowOn]} onPress={() => { setPersonality(p.key); setPickerOpen(null); }}>
                      <Text style={[s.pickRowTxt, on && s.pickRowTxtOn]}>{p.emoji} {p.label}</Text>
                      {on && <Text style={s.pickCheck}>✓</Text>}
                    </Pressable>
                  );
                })
              : MOOD_MESSAGES.map((m) => {
                  const on = moodMsg === m.key;
                  return (
                    <Pressable key={m.key} style={[s.pickRow, on && s.pickRowOn]} onPress={() => { setMoodMsg(m.key); setPickerOpen(null); }}>
                      <Text style={[s.pickRowTxt, on && s.pickRowTxtOn]}>{m.text}</Text>
                      {on && <Text style={s.pickCheck}>✓</Text>}
                    </Pressable>
                  );
                })}
          </ScrollView>
        </View>
      </Modal>
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
    sectionTitle: { fontSize: ty.h2, fontWeight: '800', color: c.ink, marginTop: spacing.xl },
    label: { fontSize: ty.small, fontWeight: '700', color: c.ink2, marginTop: spacing.lg },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.lg },
    opt: { fontSize: ty.tiny, color: c.faint, borderWidth: 1, borderColor: c.line, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden' },
    levelDesc: { fontSize: ty.small, color: c.ink2, marginTop: spacing.sm, lineHeight: 18 },
    row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    chip: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface },
    chipOn: { borderColor: c.blue, backgroundColor: c.blueLight },
    chipTxt: { fontSize: ty.body, color: c.ink2, fontWeight: '600' },
    chipTxtOn: { color: c.blueDark, fontWeight: '800' },
    // 受験予定日
    dateWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
    dateChip: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface },
    dateTxt: { fontSize: ty.small, color: c.ink2, fontWeight: '600' },
    // プロフィール
    input: { marginTop: spacing.sm, borderWidth: 1, borderColor: c.line, borderRadius: radius.lg, backgroundColor: c.surface, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: ty.body, color: c.ink },
    hintTxt: { fontSize: ty.tiny, color: c.mute, marginTop: spacing.xs ?? 4 },
    avGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
    avCell: { width: 100, height: 108, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' },
    avCellOn: { borderColor: c.blue, borderWidth: 2, backgroundColor: c.blueLight },
    avImg: { width: 96, height: 96 },
    pickField: { marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, borderRadius: radius.lg, paddingVertical: 12, paddingHorizontal: 14 },
    pickFieldTxt: { fontSize: ty.body, color: c.ink, fontWeight: '700' },
    pickCaret: { fontSize: 14, color: c.mute, fontWeight: '900' },
    pickBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
    pickSheet: { backgroundColor: c.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 24 },
    pickTitle: { fontSize: ty.body, fontWeight: '900', color: c.ink, marginBottom: 10, textAlign: 'center' },
    pickRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 14, borderRadius: radius.lg, marginBottom: 4 },
    pickRowOn: { backgroundColor: c.blueLight },
    pickRowTxt: { fontSize: ty.body, color: c.ink, fontWeight: '700' },
    pickRowTxtOn: { color: c.blue, fontWeight: '900' },
    pickCheck: { fontSize: 16, color: c.blue, fontWeight: '900' },
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
