// 学習後の共通テンプレ(全ドリル=試験/単語/辞書タブ共通)。画面は上から:
//  ①イラスト(毎回)＝マンネリ防止で学習ごとに1枚ずつ順送り(afterStudyArt の pickAfterStudyImage)。桜のねぎらい一言を添える。
//  ②貝の取得情報(毎回)=「◯問正解 ＋◯貝」。全問正解=20貝(問題数に依らず。10問ない大問は 20÷問題数/問)。＋今日はじめての学習は30貝ボーナス。
//  ③単語帳の登録チェック＋正誤リスト(毎回)。※復習(私の単語帳)モードでは、記憶した(正解した)単語だけ
//    チェックを外して単語帳から除外できる(外す前に確認ダイアログ)。通常は☑で「私の単語帳」へ追加。
//  ・AIコーチ(成長分析)は最下部に添える。※付与ロジックは②の貝(全問正解=20)を正規化する所だけ触る(表示＋不足分の上乗せ)。
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet, useWindowDimensions, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState, useAppActions } from '../store/store';
import { isInMyList, dayStr } from '../store/state';
import { recordQualifyingDay, isTriggerMet } from '../referral/trigger';
import { reportQualified, getDeviceRef } from '../referral/referralClient';
import { composeVoice } from '../story/voice';
import { pickAfterStudyImage } from '../data/afterStudyArt';
import { homeStatus } from '../home/homeStatus';
import RubyText from './RubyText';
import { useT } from '../i18n';
import { sendEvent, sendFirstSessionOnce } from '../telemetry/telemetry';
import type { StudiedWord, StudiedQuestion } from '../data/studiedWords';

export type { StudiedWord } from '../data/studiedWords';

const FULL_SESSION_SHELLS = 20; // 全問正解=20貝(問題数に依らず正規化)

export default function AfterStudyReward({ words = [], reviewByRef, shellsEarned = 0, scored = 0, accuracy, correct, total, mode, seed, review = false }: {
  words?: StudiedWord[];
  reviewByRef?: Record<string, StudiedQuestion>; // ref(type:id) → 出題時の問題スナップショット(正誤表から問題・選択肢を振り返る)
  shellsEarned?: number;
  scored?: number;      // 計測用(session_complete)。画面には出さない。
  accuracy?: number;    // 正解率%(◯問正解 と 貝 の正規化に使う)
  correct?: number;     // 正解数(◯問正解の表示。無ければ accuracy×total から概算)
  total?: number;       // 出題数(◯問中。無ければ scored)
  mode: string;
  seed?: number;
  review?: boolean;     // 私の単語帳の「復習する」= true。記憶した(正解)語だけ確認の上で外せる。
}) {
  const state = useAppState();
  const { addToMyList, setSettings, awardOnce, addPoints, markStudyDay } = useAppActions();
  const t = useT();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const { width, height } = useWindowDimensions();
  const [fallbackSeed] = useState(() => (Date.now() & 0xffff) | 1);
  const seedV = seed ?? fallbackSeed;

  // 今日はじめての学習=30貝。この学習が今日の最初か(=まだ未付与か)をマウント時に固定。
  const dailyKey = 'dailyFirst-' + dayStr(Date.now());
  const [grantedDaily] = useState(() => !(state.claimedMilestones ?? []).includes(dailyKey));
  // 正誤表で「問題を見る」を開いている行(ref key)。1行ずつ開閉。
  const [openKey, setOpenKey] = useState<string | null>(null);

  // ②貝の正規化: 全問正解=20貝。acc=正解率%なので、この学習で得るべき貝 = round(20×acc/100)。
  //  ・1問あたり=20÷問題数(=acc に内包)。10問ない大問でも全問正解なら20になる。
  const acc = accuracy ?? 0;
  const targetShells = Math.round((FULL_SESSION_SHELLS * acc) / 100);
  const correctN = correct ?? Math.round(((total ?? scored) * acc) / 100);
  // 毎問付与ぶん(shellsEarned)との差だけを上乗せ=最終的にこの学習の貝が targetShells になる(不足時のみ加算)。
  const topUp = Math.max(0, targetShells - shellsEarned);

  // 匿名計測＋ご褒美カウンタ+1(毎回=イラスト順送りの種)＋貝の不足分＋今日はじめてなら30貝を1回だけ。
  useEffect(() => {
    void sendEvent('session_complete', { mode, scored });
    void sendFirstSessionOnce(state);
    setSettings({ afterStudyCount: (state.settings.afterStudyCount ?? 0) + 1 });
    if (topUp > 0) addPoints(topUp, { cap: true }); // 全問正解=20貝へ正規化(不足分だけ上乗せ)
    if (grantedDaily) awardOnce(dailyKey, 30);

    // 紹介の継続トリガー: 1セット(約60問=distinct scored)以上完了した日だけを適格学習日に記録(水増し防止)。
    const now = Date.now();
    const qualifying = scored >= 60;
    markStudyDay(qualifying);
    // 新規(=コード入力済み)の人だけ、「今回で成立した」瞬間に1回だけサーバーへ報告(冪等・失敗は握る)。
    const code = state.referral?.enteredCode;
    if (code) {
      const before = state.referral?.qualifyingDays ?? [];
      const after = qualifying ? recordQualifyingDay(before, dayStr(now)) : before;
      const installAt = state.installedAt ?? now;
      if (!isTriggerMet(installAt, before, now) && isTriggerMet(installAt, after, now)) {
        void (async () => {
          const ref = await getDeviceRef();
          await reportQualified(code, ref, after, installAt); // 成立でサーバーが両者のpro_untilを延長→次回同期で反映
        })();
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ①イラスト(毎回)=学習ごとに1枚ずつ順送り(afterStudyCount が種)。マンネリ防止(気分転換)。
  const img = useMemo(() => pickAfterStudyImage(state.settings.afterStudyCount ?? 0, Date.now()), []); // eslint-disable-line react-hooks/exhaustive-deps
  const dims = img ? Image.resolveAssetSource(img) : null;
  const aspect = dims && dims.width && dims.height ? dims.width / dims.height : 3 / 2;
  const frameW = width - spacing.lg * 2;
  const frameH = Math.min(frameW / aspect, Math.round(height * 0.46));

  // ①桜のねぎらい(session_end)。願い非依存・短い一言。台詞はstory/voice.tsが正本。
  const line = useMemo(
    () => composeVoice({ occasion: { kind: 'session_end' }, variant: 'full', now: Date.now(), seed: seedV }).text,
    [seedV],
  );

  // ③AIコーチ=成長データ中心の励まし＋弱点の冷静分析。到達度%＋一番伸びてる分野＋一番の課題。
  const coach = useMemo(() => {
    const st = homeStatus(state, Date.now());
    const withData = st.subjects.filter((x) => x.pct > 0);
    const strong = withData.length ? withData.reduce((a, b) => (b.pct > a.pct ? b : a)) : null;
    const weak = st.subjects.reduce((a, b) => (b.pct < a.pct ? b : a));
    return { reach: Math.round(st.passPct), strong, weak, hasData: withData.length > 0 };
  }, [state]);

  return (
    <View style={s.wrap}>
      {/* ① イラスト(毎回・順送り)＋桜のねぎらい */}
      {img && (
        <View style={[s.imgFrame, { width: frameW, height: frameH }]}>
          <Image source={img} style={s.img} resizeMode="cover" />
        </View>
      )}
      {!!line && (
        <View style={s.rewardBlock}>
          <Text style={s.voice}>{line}</Text>
        </View>
      )}

      {/* ② 獲得した貝(毎回)。獲得桜貝を主役に大きく→正解内訳→(今日はじめてなら)ボーナス＋合計。 */}
      <View style={s.shellCard}>
        <Text style={s.shellHeroIco}>🐚</Text>
        <View style={s.shellHeroRow}>
          <Text style={s.shellPlus}>＋</Text>
          <Text style={s.shellHeroN}>{targetShells}</Text>
          <Text style={s.shellHeroUnit}>桜貝</Text>
        </View>
        <Text style={s.shellSub}>
          {total != null ? `${correctN} / ${total}問 正解` : `${correctN}問 正解`}
          {acc > 0 ? `（${acc}%）` : ''}
        </Text>
        {grantedDaily ? (
          <View style={s.shellBreak}>
            <View style={s.shellBonusRow}>
              <Text style={s.shellBonusLbl}>今日はじめてのボーナス</Text>
              <Text style={s.shellBonusVal}>＋30</Text>
            </View>
            <View style={s.shellTotalRow}>
              <Text style={s.shellTotalLbl}>合計</Text>
              <Text style={s.shellTotalVal}>＋{targetShells + 30} 桜貝</Text>
            </View>
          </View>
        ) : (
          <Text style={s.shellNote}>全問正解で20桜貝</Text>
        )}
      </View>

      {/* 友だち紹介カード=達成直後に「誘いたくなる瞬間」で出す。2人とも1週間Pro。 */}
      <Pressable style={s.inviteCard} onPress={() => nav.navigate('Referral')}>
        <View style={s.inviteTextWrap}>
          <Text style={s.inviteTitle}>{t('referral.invite_title')}</Text>
          <Text style={s.inviteBody}>{t('referral.invite_body')}</Text>
        </View>
        <View style={s.inviteBtn}>
          <Ionicons name="gift-outline" size={16} color="#fff" />
          <Text style={s.inviteBtnTxt}>{t('referral.invite_cta')}</Text>
        </View>
      </Pressable>

      {/* ③ 単語ごとの登録チェック＋正誤(毎回)。復習モードは記憶した(正解)語だけ確認の上で外せる。 */}
      {words.length > 0 ? (
        <View style={s.listCard}>
          <View style={s.listHead}>
            <Text style={s.listH}>{review ? '覚えた単語は単語帳から外せます' : '単語帳に入れる'}</Text>
            {reviewByRef && Object.keys(reviewByRef).length > 0 ? <Text style={s.listHint}>▽ 問題を確認</Text> : null}
          </View>
          {words.map((w) => {
            const saved = isInMyList(state.myList ?? [], w.ref);
            const memorized = review && w.correct === true; // 復習で正解=記憶したと判定
            const rkey = w.ref.type + ':' + w.ref.id;
            const rq = reviewByRef?.[rkey];
            const open = openKey === rkey;
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
              <View key={w.ref.type + w.ref.id}>
                <Pressable style={s.wrow} onPress={onRow} hitSlop={4} disabled={review && !memorized}>
                  <Ionicons name={saved ? 'checkbox' : 'square-outline'} size={22} color={!saved ? c.mute : review && !memorized ? c.mute : c.blue} />
                  <View style={s.wtextWrap}>
                    <RubyText text={w.word} style={s.wword} rubyStyle={s.wruby} />
                    {!!w.meaning && <Text style={s.wmean} numberOfLines={1}>{w.meaning}</Text>}
                  </View>
                  {w.correct != null && (
                    <Ionicons name={w.correct ? 'checkmark-circle' : 'close-circle'} size={18} color={w.correct ? c.green : c.red} />
                  )}
                  {/* 出題時の問題スナップショットがあれば「問題を見る」トグル(独立の押下先＝行の登録操作とは別) */}
                  {rq ? (
                    <Pressable onPress={() => setOpenKey(open ? null : rkey)} hitSlop={8} style={s.wexpand} accessibilityLabel="問題と選択肢を見る">
                      <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={c.blue} />
                    </Pressable>
                  ) : null}
                </Pressable>
                {open && rq ? <ReviewPanel q={rq} s={s} c={c} /> : null}
              </View>
            );
          })}
        </View>
      ) : null}

      {/* AIコーチ=成長データ中心の励まし＋弱点分析(毎回・最下部) */}
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
    </View>
  );
}

type Styles = ReturnType<typeof makeStyles>;

// 正誤表の行を開いた時に出す「出題時そのままの問題文＋選択肢(正解を✓で明示)」。
function ReviewPanel({ q, s, c }: { q: StudiedQuestion; s: Styles; c: ThemeColors }) {
  const hasFuri = (x: string) => /[（(][^）)]*[）)]/.test(x);
  return (
    <View style={s.reviewPanel}>
      {/* 問題文(ふりがな/下線付き文/素の提示文のいずれか) */}
      {q.furi ? (
        <RubyText text={q.furi} target={q.furiTarget} style={s.reviewStem} hitStyle={s.reviewHit} rubyStyle={s.reviewRuby} noRubyOnHit={q.noTargetRuby} />
      ) : q.example && q.example.length ? (
        <Text style={s.reviewStem}>{q.example.map((sg, i) => <Text key={i} style={sg.hit ? s.reviewHit : undefined}>{sg.text}</Text>)}</Text>
      ) : q.prompt ? (
        hasFuri(q.prompt)
          ? <RubyText text={q.prompt} style={s.reviewStem} rubyStyle={s.reviewRuby} />
          : <Text style={s.reviewStem}>{q.prompt}</Text>
      ) : null}
      {!!q.question ? <Text style={s.reviewQ}>{q.question}</Text> : null}
      <View style={s.reviewChoices}>
        {q.choices.map((ch, i) => {
          const ok = i === q.answerIndex;
          return (
            <View key={i} style={[s.reviewChoice, ok && s.reviewChoiceOk]}>
              <View style={[s.reviewBadge, ok && s.reviewBadgeOk]}>
                <Text style={[s.reviewBadgeT, ok && s.reviewBadgeTOk]}>{ok ? '✓' : String(i + 1)}</Text>
              </View>
              {hasFuri(ch) ? (
                <View style={{ flex: 1 }}><RubyText text={ch} style={s.reviewChoiceT} rubyStyle={s.reviewRuby} /></View>
              ) : (
                <Text style={[s.reviewChoiceT, ok && s.reviewChoiceTOk]}>{ch}</Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    wrap: { width: '100%', gap: spacing.md, alignItems: 'center' },
    imgFrame: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: c.bgSoft, borderWidth: 1, borderColor: c.line },
    img: { width: '100%', height: '100%' },
    rewardBlock: { width: '100%', alignItems: 'center', gap: spacing.xs },
    // 貝カード=毎回表示。獲得桜貝を主役(大)に→正解内訳→(今日はじめてなら)ボーナス＋合計。
    shellCard: { width: '100%', alignItems: 'center', gap: 3, backgroundColor: c.bgSoft, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, paddingVertical: spacing.md, paddingHorizontal: spacing.md },
    shellHeroIco: { fontSize: 30, lineHeight: 34 },
    shellHeroRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
    shellPlus: { fontSize: ty.h2, fontWeight: '900', color: c.blue, marginBottom: 5 },
    shellHeroN: { fontSize: 44, lineHeight: 48, fontWeight: '900', color: c.blue, fontVariant: ['tabular-nums'] },
    shellHeroUnit: { fontSize: ty.body, fontWeight: '800', color: c.blue, marginBottom: 6, marginLeft: 2 },
    shellSub: { fontSize: ty.small, color: c.ink2, fontWeight: '800' },
    shellNote: { fontSize: ty.tiny, color: c.mute, fontWeight: '700', marginTop: 2 },
    shellBreak: { width: '100%', borderTopWidth: 1, borderTopColor: c.line, marginTop: spacing.xs, paddingTop: spacing.sm, gap: 5 },
    shellBonusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    shellBonusLbl: { fontSize: ty.small, color: c.ink2, fontWeight: '700' },
    shellBonusVal: { fontSize: ty.small, color: c.blue, fontWeight: '900', fontVariant: ['tabular-nums'] },
    shellTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    shellTotalLbl: { fontSize: ty.small, color: c.ink, fontWeight: '900' },
    shellTotalVal: { fontSize: ty.body, color: c.blue, fontWeight: '900', fontVariant: ['tabular-nums'] },
    voice: { fontSize: ty.body, fontWeight: '700', color: c.ink, lineHeight: 24, textAlign: 'center', paddingHorizontal: spacing.md },
    // 友だち紹介カード=達成直後の勧誘。桜(青)を効かせて誘いたくなる見た目に。
    inviteCard: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: c.blueLight, borderRadius: radius.lg, borderWidth: 1, borderColor: c.blue, padding: spacing.md },
    inviteTextWrap: { flex: 1, gap: 2 },
    inviteTitle: { fontSize: ty.small, fontWeight: '900', color: c.blueDark, lineHeight: 20 },
    inviteBody: { fontSize: ty.tiny, color: c.ink2, lineHeight: 16, fontWeight: '600' },
    inviteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.blue, borderRadius: radius.pill, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
    inviteBtnTxt: { fontSize: ty.small, fontWeight: '800', color: '#fff' },
    listCard: { width: '100%', backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: spacing.md, gap: 2 },
    listHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: spacing.xs },
    listH: { fontSize: ty.small, fontWeight: '800', color: c.ink2 },
    wrow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 7 },
    wtextWrap: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
    wword: { fontSize: ty.body, fontWeight: '800', color: c.ink },
    wruby: { color: c.mute },
    wmean: { flex: 1, fontSize: ty.small, color: c.mute },
    wexpand: { padding: 4, marginLeft: 2 },
    listHint: { fontSize: ty.tiny, color: c.blue, fontWeight: '800' },
    // 正誤表の展開パネル(問題文＋選択肢・正解を✓/緑で明示)
    reviewPanel: { backgroundColor: c.bgSoft, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, padding: spacing.sm, marginTop: 4, marginBottom: spacing.xs, gap: spacing.xs },
    reviewStem: { fontSize: ty.body, color: c.ink, fontWeight: '700', lineHeight: 24 },
    reviewRuby: { fontSize: 9, lineHeight: 11, color: c.mute, textAlign: 'center' },
    reviewHit: { color: c.ink, fontWeight: '800', textDecorationLine: 'underline' },
    reviewQ: { fontSize: ty.small, color: c.mute, fontWeight: '600' },
    reviewChoices: { gap: 5, marginTop: 2 },
    reviewChoice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: c.surface, borderRadius: 8, borderWidth: 1, borderColor: c.line, paddingVertical: 7, paddingHorizontal: 9 },
    reviewChoiceOk: { borderColor: c.green, backgroundColor: c.okBg },
    reviewBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: c.bgSoft, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
    reviewBadgeOk: { backgroundColor: c.green, borderColor: c.green },
    reviewBadgeT: { fontSize: 11, fontWeight: '800', color: c.mute },
    reviewBadgeTOk: { color: '#fff' },
    reviewChoiceT: { flex: 1, fontSize: ty.small, color: c.ink2, fontWeight: '600' },
    reviewChoiceTOk: { color: c.green, fontWeight: '800' },
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
