// 学習後の共通テンプレ(全ドリル=試験/単語/辞書タブ共通)。画面は上から:
//  ①ご褒美イラスト＋桜のねぎらい(約10回に1度・通常の学習では非表示)。
//  ②貝の取得情報(毎回)=正解に基づく獲得数＋ボーナス内訳。
//  ③単語帳の登録チェック＋正誤リスト(毎回)。※復習(私の単語帳)モードでは、記憶した(正解した)単語だけ
//    チェックを外して単語帳から除外できる(外す前に確認ダイアログ)。通常は☑で「私の単語帳」へ追加。
//  ・AIコーチ(成長分析)はご褒美時のみ最下部に添える。※付与ロジックには触れない(表示のみ)。
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet, useWindowDimensions, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState, useAppActions } from '../store/store';
import { isInMyList, dayStr } from '../store/state';
import { composeVoice } from '../story/voice';
import { pickAfterStudyImage } from '../data/afterStudyArt';
import { homeStatus } from '../home/homeStatus';
import RubyText from './RubyText';
import { useT } from '../i18n';
import { sendEvent, sendFirstSessionOnce } from '../telemetry/telemetry';
import type { StudiedWord } from '../data/studiedWords';

export type { StudiedWord } from '../data/studiedWords';

const REWARD_EVERY = 10; // 約10学習に1度、ご褒美(②③)を出す

export default function AfterStudyReward({ words = [], shellsEarned = 0, scored = 0, accuracy, mode, seed, review = false }: {
  words?: StudiedWord[];
  shellsEarned?: number;
  scored?: number;      // 計測用(session_complete)。画面には出さない。
  accuracy?: number;    // 正解率%(単語帳の見出し右に表示)
  mode: string;
  seed?: number;
  review?: boolean;     // 私の単語帳の「復習する」= true。記憶した(正解)語だけ確認の上で外せる。
}) {
  const state = useAppState();
  const { addToMyList, setSettings, awardOnce } = useAppActions();
  const t = useT();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const { width, height } = useWindowDimensions();
  const [fallbackSeed] = useState(() => (Date.now() & 0xffff) | 1);
  const seedV = seed ?? fallbackSeed;

  // ご褒美(②③)は約10回に1度。開発用トグル(devRewardHalf)がONの時だけ2回に1回に上げる(表示頻度の確認用)。
  // 表示可否はマウント時に固定(この後カウンタを+1しても画面は変わらない)。
  const rewardEvery = state.settings.devRewardHalf ? 2 : REWARD_EVERY;
  const [showReward] = useState(() => ((state.settings.afterStudyCount ?? 0) % rewardEvery) === 0);

  // 毎日はじめての学習=30貝。この学習が今日の最初か(=まだ未付与か)をマウント時に固定。
  // 付与前に判定して「今回この画面で30貝を出すか」を決める。付与自体は下のeffectで1回だけ。
  const dailyKey = 'dailyFirst-' + dayStr(Date.now());
  const [grantedDaily] = useState(() => !(state.claimedMilestones ?? []).includes(dailyKey));

  // 匿名計測＋ご褒美カウンタ+1(毎回)＋今日はじめての学習なら30貝を加算(1回だけ)。
  useEffect(() => {
    void sendEvent('session_complete', { mode, scored });
    void sendFirstSessionOnce(state);
    setSettings({ afterStudyCount: (state.settings.afterStudyCount ?? 0) + 1 });
    if (grantedDaily) awardOnce(dailyKey, 30); // 合計(=+shellsEarned)に反映され、下で内訳も表示
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
      {/* ① ご褒美イラスト＋桜のねぎらい(約10回に1度・通常の学習では非表示) */}
      {showReward && img && (
        <View style={[s.imgFrame, { width: frameW, height: frameH }]}>
          <Image source={img} style={s.img} resizeMode="cover" />
        </View>
      )}
      {showReward && !!line && (
        <View style={s.rewardBlock}>
          <Text style={s.voice}>{line}</Text>
        </View>
      )}

      {/* ② 獲得した貝(毎回)。合計=1問正解×2貝(＋今日はじめての学習なら30貝)。 */}
      <View style={s.shellCard}>
        <View style={s.shellRow}>
          <Text style={s.shellIco}>🐚</Text>
          <Text style={s.shellN}>+{shellsEarned}</Text>
          <Text style={s.shellL}>貝</Text>
        </View>
        <Text style={s.shellNote}>1問正解 = 2貝</Text>
        {grantedDaily && <Text style={s.shellBonus}>＋ 毎日はじめての学習ボーナス 30貝</Text>}
      </View>

      {/* ③ 単語ごとの登録チェック＋正誤(毎回)。復習モードは記憶した(正解)語だけ確認の上で外せる。 */}
      {words.length > 0 ? (
        <View style={s.listCard}>
          <View style={s.listHead}>
            <Text style={s.listH}>{review ? '覚えた単語は単語帳から外せます' : '単語帳に入れる'}</Text>
            {!!acc && <Text style={s.listAcc}>{acc}</Text>}
          </View>
          {words.map((w) => {
            const saved = isInMyList(state.myList ?? [], w.ref);
            const memorized = review && w.correct === true; // 復習で正解=記憶したと判定
            const onRow = () => {
              if (review) {
                if (memorized) {
                  Alert.alert('覚えましたか？', 'この単語を「私の単語帳」から外しますか？', [
                    { text: 'まだ残す', style: 'cancel' },
                    { text: '外す', style: 'destructive', onPress: () => addToMyList(w.ref) }, // toggleで外れる
                  ]);
                }
                // 復習でまだ(未正解)の語は外せない=何もしない
              } else {
                addToMyList(w.ref); // 通常: ☑トグルで私の単語帳へ
              }
            };
            return (
              <Pressable key={w.ref.type + w.ref.id} style={s.wrow} onPress={onRow} hitSlop={4} disabled={review && !memorized}>
                <Ionicons name={saved ? 'checkbox' : 'square-outline'} size={22} color={!saved ? c.mute : review && !memorized ? c.mute : c.blue} />
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

      {/* AIコーチ=成長データ中心の励まし＋弱点分析(ご褒美時のみ・最下部) */}
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
    // 貝カード=毎回表示。獲得数＋「何の貝か」の説明を添える。
    shellCard: { width: '100%', alignItems: 'center', gap: 2, backgroundColor: c.bgSoft, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, paddingVertical: spacing.sm },
    shellNote: { fontSize: ty.tiny, color: c.mute, fontWeight: '700' },
    shellBonus: { fontSize: ty.tiny, color: c.blue, fontWeight: '800' },
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
