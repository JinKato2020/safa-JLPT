import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ImageBackground, Animated, Image, TextInput, Modal, ActivityIndicator, useWindowDimensions, Linking } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppActions } from '../store/store';
import { signIn } from '../auth/authClient';
import { signInWithProvider, signInWithApple, isAppleAvailable } from '../auth/oauth';
import { mapAuthError } from '../auth/authErrors';
import { useT, useUiLang } from '../i18n';
import ListeningDownloadGate from '../components/ListeningDownloadGate';
import { listeningAudioIdsFor } from '../data';
import { LISTENING_CACHEABLE, listeningReady, listeningBytesEstimate } from '../data/listeningAudio';
import { legalUrl } from '../config/legal';
import { sendEvent } from '../telemetry/telemetry';
import { upcomingExams } from '../data/jlptDates';
import { avatarsByGender, DEFAULT_AVATAR } from '../plaza/avatars';
import { PERSONALITIES, MOOD_MESSAGES, traitLabel } from '../plaza/persona';
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

// 聴解音声の「レベル別・一括ダウンロード」1行(オンボード)。DL済みなら「✓ ダウンロード済」、未DLなら[一括ダウンロード]。
// 既定は配信(都度)＝どのレベルもDLしない。オフラインで使いたい級だけここでDLできる(設定画面と同じ挙動)。
function LevelAudioRow({ level, refreshKey, onDownload, s, t }: {
  level: Level; refreshKey: number; onDownload: (lv: Level) => void;
  s: ReturnType<typeof makeStyles>; t: ReturnType<typeof useT>;
}) {
  const ids = useMemo(() => listeningAudioIdsFor(level), [level]);
  const mb = Math.max(1, Math.round(listeningBytesEstimate(ids) / 1048576));
  const [ready, setReady] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    if (!LISTENING_CACHEABLE) { setReady(true); return () => { alive = false; }; }
    listeningReady(ids).then((r) => { if (alive) setReady(r); }).catch(() => { if (alive) setReady(false); });
    return () => { alive = false; };
  }, [ids, refreshKey]);
  return (
    <View style={s.dlRow}>
      <View style={{ flex: 1 }}>
        <Text style={s.dlLevel}>{level}</Text>
        <Text style={s.dlSize}>{mb} MB</Text>
      </View>
      {ready ? (
        <Text style={s.dlDone}>✓ {t('profile.audioDownloaded')}</Text>
      ) : (
        <Pressable style={s.dlBtn} onPress={() => onDownload(level)}>
          <Text style={s.dlBtnTxt}>{t('profile.listeningAudio_download')}</Text>
        </Pressable>
      )}
    </View>
  );
}


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

  const uiLang = useUiLang(); // 規約/プライバシーのリンク言語(端末UI言語)
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
  // 聴解音声=既定は配信(都度=stream)。オフラインで使いたい級だけレベル別に一括DL(設定画面と同じ)。
  const [dlLevel, setDlLevel] = useState<Level | null>(null); // 一括DL中の級(ゲート表示)。null=非表示
  const [dlRefresh, setDlRefresh] = useState(0);              // DL完了で各行の「済」表示を再判定
  const [ready, setReady] = useState(false);                      // オープニングは2秒固定→タップ受付
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const id = setTimeout(() => {
      setReady(true);
      Animated.timing(fade, { toValue: 1, duration: 450, useNativeDriver: true }).start();
    }, 2000);
    return () => clearTimeout(id);
  }, [fade]);

  // ── 既存アカウントの人向けログイン(オンボの最初で復元)。 ──
  // 先にログインすれば、クラウドから学習データが戻り onboarded も復元されて画面が自動でホームへ抜ける。
  // = 無駄なプロフィールを作らせない・「入力→ログインで上書き」の事故を防ぐ。
  const [loginOpen, setLoginOpen] = useState(false);
  const [appleOk, setAppleOk] = useState(false);
  const [lgEmail, setLgEmail] = useState('');
  const [lgPw, setLgPw] = useState('');
  const [lgBusy, setLgBusy] = useState(false);
  const [lgErr, setLgErr] = useState<string | null>(null);
  useEffect(() => { void isAppleAvailable().then(setAppleOk); }, []);
  // 成功時: 復元があればオンボは自動で閉じる。バックアップが無い新規アカウントならモーダルだけ閉じて通常のオンボを続行。
  const doGoogle = async () => {
    setLgErr(null); setLgBusy(true);
    try {
      const r = await signInWithProvider('google');
      if (r.error === 'cancelled') return;
      if (r.error) { setLgErr(r.error.startsWith('account.') ? r.error : 'account.err_oauth'); return; }
      setLoginOpen(false);
    } finally { setLgBusy(false); }
  };
  const doApple = async () => {
    setLgErr(null); setLgBusy(true);
    try {
      const r = await signInWithApple();
      if (r.error === 'cancelled') return;
      if (r.error) { setLgErr(r.error.startsWith('account.') ? r.error : 'account.err_oauth'); return; }
      setLoginOpen(false);
    } finally { setLgBusy(false); }
  };
  const doEmail = async () => {
    setLgErr(null); setLgBusy(true);
    try {
      const r = await signIn(lgEmail.trim(), lgPw);
      if (r.error) { setLgErr(mapAuthError(r.error)); return; }
      setLoginOpen(false);
    } catch { setLgErr('account.err_network'); }
    finally { setLgBusy(false); }
  };
  const canLogin = lgEmail.trim().length > 3 && lgPw.length >= 8 && !lgBusy;

  // ログイン用ボトムシート(挨拶・設定の両画面で共通表示)。
  const loginModal = (
    <Modal visible={loginOpen} transparent animationType="slide" onRequestClose={() => setLoginOpen(false)}>
      <Pressable style={s.pickBackdrop} onPress={() => setLoginOpen(false)} />
      <View style={s.pickSheet}>
        <Text style={s.pickTitle}>{t('onboarding.login_title')}</Text>
        <Text style={s.levelDesc}>{t('onboarding.login_sub')}</Text>
        <Pressable style={[s.googleBtn, lgBusy && { opacity: 0.5 }]} onPress={doGoogle} disabled={lgBusy}>
          <Ionicons name="logo-google" size={20} color="#EA4335" />
          <Text style={s.googleTxt}>{t('account.google')}</Text>
        </Pressable>
        {appleOk ? (
          <Pressable style={[s.appleBtn, lgBusy && { opacity: 0.5 }]} onPress={doApple} disabled={lgBusy}>
            <Ionicons name="logo-apple" size={20} color="#fff" />
            <Text style={s.appleTxt}>{t('account.apple')}</Text>
          </Pressable>
        ) : null}
        <View style={s.divider}>
          <View style={s.divLine} />
          <Text style={s.divTxt}>{t('account.or')}</Text>
          <View style={s.divLine} />
        </View>
        <TextInput
          value={lgEmail}
          onChangeText={setLgEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
          placeholder="you@example.com"
          placeholderTextColor={c.faint}
          style={s.input}
        />
        <TextInput
          value={lgPw}
          onChangeText={setLgPw}
          secureTextEntry
          autoCapitalize="none"
          placeholder={t('account.password')}
          placeholderTextColor={c.faint}
          style={[s.input, { marginTop: spacing.sm }]}
        />
        {lgErr ? <Text style={s.loginErr}>{t(lgErr)}</Text> : null}
        <Pressable style={[s.loginCta, !canLogin && s.ctaOff]} onPress={doEmail} disabled={!canLogin}>
          {lgBusy ? <ActivityIndicator color="#fff" /> : <Text style={s.ctaTxt}>{t('account.cta_login')}</Text>}
        </Pressable>
      </View>
    </Modal>
  );

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
        {/* 既存アカウントの人向け: 先にログイン=クラウドから復元(プロフィール入力を通らず自動でホームへ)。 */}
        {ready && (
          <Animated.View style={[g.loginLinkWrap, { top: insets.top + 14, opacity: fade }]}>
            <Pressable onPress={() => setLoginOpen(true)} hitSlop={8} style={g.loginLink}>
              <Text style={g.loginLinkTxt}>{t('onboarding.login_restore')}</Text>
            </Pressable>
          </Animated.View>
        )}
        {loginModal}
      </ImageBackground>
    );
  }

  // オンボード完了=全設定を保存。聴解音声は既定で配信(都度=stream)。オフライン用の一括DLは上のレベル別行で任意に実施済み。
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
      listeningAudioMode: 'stream', // 聴解音声は既定で配信(都度)。オフライン用DLはレベル別に任意実施(mode非依存でキャッシュ優先再生)
      onboarded: true, // トラッキング許可は既定ON(未設定=許可)。オフは設定画面で。
    });
  };

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

        {/* 既存アカウントの人向け: 入力せずログインで復元。 */}
        <Pressable style={s.loginHint} onPress={() => setLoginOpen(true)} hitSlop={6}>
          <Ionicons name="log-in-outline" size={16} color={c.blue} />
          <Text style={s.loginHintTxt}>{t('onboarding.have_account')} <Text style={s.loginHintLink}>{t('onboarding.login_restore')}</Text></Text>
        </Pressable>

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
              <Text style={[s.dateTxt, examDate === d && s.chipTxtOn]}>{t('onboarding.date_ymd', { y: d.slice(0, 4), m: Number(d.slice(5, 7)), d: Number(d.slice(8, 10)) })}</Text>
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

        <Text style={s.label}>{t('account.k_native')}</Text>
        <Pressable style={s.pickField} onPress={() => setPickerOpen('lang')}>
          <Text style={s.pickFieldTxt}>{(() => { const l = NATIVE_LANGS.find((x) => x.code === nativeLang); return l ? `${nativeLangFlag(l.code)}  ${l.label}` : t('account.choose'); })()}</Text>
          <Text style={s.pickCaret}>▾</Text>
        </Pressable>

        <Text style={s.label}>{t('account.k_personality')}</Text>
        <Pressable style={s.pickField} onPress={() => setPickerOpen('personality')}>
          <Text style={s.pickFieldTxt}>{(() => { const p = PERSONALITIES.find((x) => x.key === personality); return p ? `${p.emoji} ${traitLabel(t, p.key)}` : t('account.choose'); })()}</Text>
          <Text style={s.pickCaret}>▾</Text>
        </Pressable>

        <Text style={s.label}>{t('onboarding.mood_label')}</Text>
        <Pressable style={s.pickField} onPress={() => setPickerOpen('mood')}>
          <Text style={s.pickFieldTxt}>{MOOD_MESSAGES.find((x) => x.key === moodMsg) ? t('persona.mood.' + moodMsg) : t('account.choose')}</Text>
          <Text style={s.pickCaret}>▾</Text>
        </Pressable>

        {/* 4. 聴解音声(この画面の最後)。既定は配信(都度)＝DLしない。オフラインで使うなら選んだ目標級ぶんだけ一括DL(級ごとに容量が違うので目標級のみ表示)。他級は設定画面でDL可。 */}
        <Text style={s.label}>{t('profile.listeningAudio')}</Text>
        <Text style={s.levelDesc}>{t('onboarding.audioHint')}</Text>
        <LevelAudioRow key={level} level={level} refreshKey={dlRefresh} onDownload={setDlLevel} s={s} t={t} />


        {/* 学習リマインド・トラッキング許可は設定画面で入力(オンボでは尋ねない)。 */}
        {/* 完了: 聴解音声は既定で配信(都度)＝そのまま完了。オフラインDLは上のレベル別行で任意に実施。 */}
        {/* 規約同意(UGC前の明示同意): 「スタート」で暗黙同意=Apple許容パターン。規約/プライバシーへのリンク付き。 */}
        <Text style={{ fontSize: ty.small, color: c.mute, textAlign: 'center', marginTop: spacing.sm, lineHeight: 18 }}>{t('onboarding.agree_note')}</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.sm, marginTop: 2, marginBottom: spacing.xs }}>
          <Text style={{ fontSize: ty.small, color: c.blue, textDecorationLine: 'underline' }} onPress={() => Linking.openURL(legalUrl('terms', uiLang))}>{t('paywall.terms')}</Text>
          <Text style={{ fontSize: ty.small, color: c.mute }}>·</Text>
          <Text style={{ fontSize: ty.small, color: c.blue, textDecorationLine: 'underline' }} onPress={() => Linking.openURL(legalUrl('privacy', uiLang))}>{t('paywall.privacy')}</Text>
        </View>
        <Pressable style={[s.cta, !canGo && s.ctaOff]} disabled={!canGo} onPress={finish}>
          <Text style={[s.ctaTxt, !canGo && s.ctaOffTxt]}>{t('onboarding.start')}</Text>
        </Pressable>
      </ScrollView>

      {/* レベル別 聴解音声の一括DLゲート(全画面オーバーレイ)。完了で行の「済」表示を更新。 */}
      {dlLevel ? (
        <View style={StyleSheet.absoluteFill}>
          <ListeningDownloadGate level={dlLevel} allowSkip manual autoStart onComplete={() => { setDlLevel(null); setDlRefresh((x) => x + 1); }} />
        </View>
      ) : null}

      {/* 性格/ムードのリスト選択(タップで開く) */}
      <Modal visible={pickerOpen !== null} transparent animationType="slide" onRequestClose={() => setPickerOpen(null)}>
        <Pressable style={s.pickBackdrop} onPress={() => setPickerOpen(null)} />
        <View style={s.pickSheet}>
          <Text style={s.pickTitle}>{pickerOpen === 'personality' ? t('account.pick_personality') : pickerOpen === 'lang' ? t('account.pick_native') : t('onboarding.pick_mood')}</Text>
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
                      <Text style={[s.pickRowTxt, on && s.pickRowTxtOn]}>{p.emoji} {traitLabel(t, p.key)}</Text>
                      {on && <Text style={s.pickCheck}>✓</Text>}
                    </Pressable>
                  );
                })
              : MOOD_MESSAGES.map((m) => {
                  const on = moodMsg === m.key;
                  return (
                    <Pressable key={m.key} style={[s.pickRow, on && s.pickRowOn]} onPress={() => { setMoodMsg(m.key); setPickerOpen(null); }}>
                      <Text style={[s.pickRowTxt, on && s.pickRowTxtOn]}>{t('persona.mood.' + m.key)}</Text>
                      {on && <Text style={s.pickCheck}>✓</Text>}
                    </Pressable>
                  );
                })}
          </ScrollView>
        </View>
      </Modal>
      {loginModal}
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
  // 既存アカウントのログイン導線(挨拶画面・右上)。背景画像上なので白文字＋半透明の下地で視認性を確保。
  loginLinkWrap: { position: 'absolute', right: 14, alignItems: 'flex-end' },
  loginLink: { backgroundColor: 'rgba(0,0,0,0.32)', borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  loginLinkTxt: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },
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
    // 聴解音声のレベル別 一括DL行(設定画面と同じ体裁)
    dlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, gap: spacing.sm, borderTopWidth: 1, borderTopColor: c.line },
    dlLevel: { fontSize: ty.body, fontWeight: '800', color: c.ink },
    dlSize: { fontSize: ty.tiny, color: c.faint, marginTop: 1 },
    dlBtn: { backgroundColor: c.blue, borderRadius: radius.md, paddingVertical: spacing.xs + 2, paddingHorizontal: spacing.md },
    dlBtnTxt: { color: '#ffffff', fontSize: ty.small, fontWeight: '800' },
    dlDone: { fontSize: ty.small, fontWeight: '700', color: c.green },
    // 設定画面の「アカウントをお持ちの方は ログイン」リンク
    loginHint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm },
    loginHintTxt: { fontSize: ty.small, color: c.ink2, fontWeight: '600' },
    loginHintLink: { color: c.blue, fontWeight: '800', textDecorationLine: 'underline' },
    // ログイン用ボトムシート内のボタン類
    googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1, borderColor: c.line, borderRadius: radius.md, backgroundColor: c.surface, paddingVertical: spacing.md, marginTop: spacing.sm },
    googleTxt: { fontSize: ty.body, fontWeight: '800', color: c.ink },
    appleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radius.md, backgroundColor: '#000', paddingVertical: spacing.md, marginTop: spacing.sm },
    appleTxt: { fontSize: ty.body, fontWeight: '800', color: '#fff' },
    divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.xs },
    divLine: { flex: 1, height: 1, backgroundColor: c.line },
    divTxt: { fontSize: ty.small, color: c.faint },
    loginErr: { fontSize: ty.small, color: c.red, marginTop: spacing.xs },
    loginCta: { marginTop: spacing.md, backgroundColor: c.blue, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  });
