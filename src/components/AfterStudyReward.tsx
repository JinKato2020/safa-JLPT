// 学習後(全ドリル共通)の画面。順=①単語帳登録(毎回) → ②ご褒美イラスト＋励まし(約10回に1度) → ③AIコーチ(同ご褒美時)。
//  ①単語登録=この回の学習語を☑で「私の単語帳」へ(毎回)。見出し右に正解率。
//  ②ご褒美=季節連動の大きめ画像＋貝🐚＋桜のねぎらい(voice session_end)。癒し・励まし(AIコーチ風でない)。
//  ③AIコーチ=成長データ中心の励まし＋「何が欠けているか」を冷静に分析(homeStatus)。桜とは見た目を分ける。
//  ※②③は afterStudyCount で約10回に1度だけ表示(初回は出す)。付与ロジックには触れない(表示のみ)。
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState, useAppActions } from '../store/store';
import { isInMyList } from '../store/state';
import { composeVoice } from '../story/voice';
import { pickAfterStudyImage } from '../data/afterStudyArt';
import { homeStatus } from '../home/homeStatus';
import RubyText from './RubyText';
import { useT } from '../i18n';
import { sendEvent, sendFirstSessionOnce } from '../telemetry/telemetry';
import type { StudiedWord } from '../data/studiedWords';

export type { StudiedWord } from '../data/studiedWords';

const REWARD_EVERY = 10; // 約10学習に1度、ご褒美(②③)を出す

export default function AfterStudyReward({ words = [], shellsEarned = 0, scored = 0, accuracy, mode, seed }: {
  words?: StudiedWord[];
  shellsEarned?: number;
  scored?: number;      // 計測用(session_complete)。画面には出さない。
  accuracy?: number;    // 正解率%(単語帳の見出し右に表示)
  mode: string;
  seed?: number;
}) {
  const state = useAppState();
  const { addToMyList, setSettings } = useAppActions();
  const t = useT();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const { width, height } = useWindowDimensions();
  const [fallbackSeed] = useState(() => (Date.now() & 0xffff) | 1);
  const seedV = seed ?? fallbackSeed;

  // ご褒美(②③)は約10回に1度。表示可否はマウント時に固定(この後カウンタを+1しても画面は変わらない)。
  const [showReward] = useState(() => ((state.settings.afterStudyCount ?? 0) % REWARD_EVERY) === 0);

  // 匿名計測＋ご褒美カウンタ+1(毎回)。
  useEffect(() => {
    void sendEvent('session_complete', { mode, scored });
    void sendFirstSessionOnce(state);
    setSettings({ afterStudyCount: (state.settings.afterStudyCount ?? 0) + 1 });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ②ご褒美画像=大きめ(全幅・最大で画面高の46%)。縦横比は画像に合わせ、切れないよう高さを上限で抑える。
  const img = useMemo(() => (showReward ? pickAfterStudyImage(seedV, Date.now()) : null), [seedV, showReward]);
  const dims = img ? Image.resolveAssetSource(img) : null;
  const aspect = dims && dims.width && dims.height ? dims.width / dims.height : 3 / 2;
  const frameW = width - spacing.lg * 2;
  const frameH = Math.min(frameW / aspect, Math.round(height * 0.46));

  // ②桜のねぎらい(session_end)。願い非依存・短い一言。台詞はstory/voice.tsが正本。
  const line = useMemo(
    () => (showReward ? composeVoice({ occasion: { kind: 'session_end' }, variant: 'full', now: Date.now(), seed: seedV }).text : ''),
    [seedV, showReward],
  );

  // ③AIコーチ=成長データ中心の励まし＋弱点の冷静分析。到達度%＋一番伸びてる分野＋一番の課題。
  const coach = useMemo(() => {
    const st = homeStatus(state, Date.now());
    const withData = st.subjects.filter((x) => x.pct > 0);
    const strong = withData.length ? withData.reduce((a, b) => (b.pct > a.pct ? b : a)) : null;
    const weak = st.subjects.reduce((a, b) => (b.pct < a.pct ? b : a));
    return { reach: Math.round(st.passPct), strong, weak, hasData: withData.length > 0 };
  }, [state]);

  const acc = accuracy != null ? `正解率 ${Math.round(accuracy)}%` : null;

  return (
    <View style={s.wrap}>
      {/* ① この回の学習語をまとめて「私の単語帳」へ(毎回)。見出し右に正解率。 */}
      {words.length > 0 ? (
        <View style={s.listCard}>
          <View style={s.listHead}>
            <Text style={s.listH}>単語帳に入れる</Text>
            {!!acc && <Text style={s.listAcc}>{acc}</Text>}
          </View>
          {words.map((w) => {
            const saved = isInMyList(state.myList ?? [], w.ref);
            return (
              <Pressable key={w.ref.type + w.ref.id} style={s.wrow} onPress={() => addToMyList(w.ref)} hitSlop={4}>
                <Ionicons name={saved ? 'checkbox' : 'square-outline'} size={22} color={saved ? c.blue : c.mute} />
                <View style={s.wtextWrap}>
                  <RubyText text={w.word} style={s.wword} rubyStyle={s.wruby} />
                  {!!w.meaning && <Text style={s.wmean} numberOfLines={1}>{w.meaning}</Text>}
                </View>
                {w.correct != null && (
                  <Ionicons name={w.correct ? 'checkmark-circle' : 'close-circle'} size={18} color={w.correct ? c.green : c.red} />
                )}
              </Pressable>
            );
          })}
        </View>
      ) : !!acc ? (
        <Text style={s.accSolo}>{acc}</Text>
      ) : null}

      {/* ② ご褒美イラスト＋貝＋桜のねぎらい(約10回に1度・登録の後) */}
      {showReward && img && (
        <View style={[s.imgFrame, { width: frameW, height: frameH }]}>
          <Image source={img} style={s.img} resizeMode="cover" />
        </View>
      )}
      {showReward && (
        <View style={s.rewardBlock}>
          {shellsEarned > 0 && (
            <View style={s.shellRow}>
              <Text style={s.shellIco}>🐚</Text>
              <Text style={s.shellN}>+{shellsEarned}</Text>
              <Text style={s.shellL}>貝</Text>
            </View>
          )}
          {!!line && <Text style={s.voice}>{line}</Text>}
        </View>
      )}

      {/* ③ AIコーチ=成長データ中心の励まし＋弱点の冷静分析(桜とは別の無機質な枠) */}
      {showReward && (
        <View style={s.coachCard}>
          <View style={s.coachHead}>
            <View style={s.coachDot}><Text style={s.coachDotTxt}>◇</Text></View>
            <Text style={s.coachTitle}>{t('afterstudy.coach')}</Text>
          </View>
          {coach.hasData ? (
            <View style={s.coachLines}>
              <Text style={s.coachLine}>{t('afterstudy.coach_reach', { p: coach.reach, r: 100 - coach.reach })}</Text>
              {coach.strong && coach.strong.pct >= 40 && (
                <Text style={s.coachLine}>{t('afterstudy.coach_strong', { s: t(coach.strong.labelKey), p: coach.strong.pct })}</Text>
              )}
              <Text style={s.coachGap}>{t('afterstudy.coach_gap', { s: t(coach.weak.labelKey), p: coach.weak.pct })}</Text>
            </View>
          ) : (
            <Text style={s.coachLine}>{t('afterstudy.coach_early')}</Text>
          )}
        </View>
      )}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    wrap: { width: '100%', gap: spacing.md, alignItems: 'center' },
    imgFrame: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: c.bgSoft, borderWidth: 1, borderColor: c.line },
    img: { width: '100%', height: '100%' },
    rewardBlock: { width: '100%', alignItems: 'center', gap: spacing.xs },
    shellRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
    shellIco: { fontSize: ty.h2 },
    shellN: { fontSize: ty.h1, fontWeight: '900', color: c.blue, fontVariant: ['tabular-nums'] },
    shellL: { fontSize: ty.small, fontWeight: '800', color: c.mute },
    voice: { fontSize: ty.body, fontWeight: '700', color: c.ink, lineHeight: 24, textAlign: 'center', paddingHorizontal: spacing.md },
    listCard: { width: '100%', backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: spacing.md, gap: 2 },
    listHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: spacing.xs },
    listH: { fontSize: ty.small, fontWeight: '800', color: c.ink2 },
    listAcc: { fontSize: ty.small, fontWeight: '800', color: c.blue, fontVariant: ['tabular-nums'] },
    accSolo: { fontSize: ty.small, fontWeight: '800', color: c.blue },
    wrow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 7 },
    wtextWrap: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
    wword: { fontSize: ty.body, fontWeight: '800', color: c.ink },
    wruby: { color: c.mute },
    wmean: { flex: 1, fontSize: ty.small, color: c.mute },
    // ③AIコーチ枠=無機質(桜の温かさと視覚的に分ける)。左に細い青帯＋◇バッジ。淡々。
    coachCard: { width: '100%', backgroundColor: c.bgSoft, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, borderLeftWidth: 3, borderLeftColor: c.blue, padding: spacing.md, gap: spacing.xs },
    coachHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
    coachDot: { width: 24, height: 24, borderRadius: 7, backgroundColor: c.blue, alignItems: 'center', justifyContent: 'center' },
    coachDotTxt: { color: '#fff', fontSize: 13, fontWeight: '900' },
    coachTitle: { fontSize: ty.small, fontWeight: '800', letterSpacing: 1, color: c.mute },
    coachLines: { gap: 3 },
    coachLine: { fontSize: ty.small, color: c.ink2, lineHeight: 20, fontWeight: '600' },
    coachGap: { fontSize: ty.small, color: c.ink, lineHeight: 20, fontWeight: '700' },
  });
