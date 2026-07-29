// 学習後(全ドリル共通)のごほうび画面。単語タブ/試験タブで同じUI:
//  ①上部に大きめのランダム画像(afterStudyArt・季節連動) ②桜貝の獲得数🌸＋桜のねぎらい(voiceのsession_end)
//  ③この回の学習語を☑で「私の単語帳」へまとめて登録(毎問登録をやめ、最後にまとめて。読解/聴解等は語が無ければ非表示)
//  ④誠実な伸び(採点した語↑/信頼幅/🔥streak)を任意表示(SessionSummaryの役割を吸収)。
//  付与ロジックには触れない(貝は学習中に付与済=ここは表示のみ)。台詞正本=story/voice.ts。
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState, useAppActions } from '../store/store';
import { isInMyList } from '../store/state';
import { composeVoice } from '../story/voice';
import { pickAfterStudyImage } from '../data/afterStudyArt';
import RubyText from './RubyText';
import { useT } from '../i18n';
import { sendEvent, sendFirstSessionOnce } from '../telemetry/telemetry';
import { metricsWishKey } from '../story/metrics';
import type { StudiedWord } from '../data/studiedWords';

export type { StudiedWord } from '../data/studiedWords';

export default function AfterStudyReward({
  words = [], shellsEarned = 0, scored = 0, mode, seed, streak, bandBefore, bandAfter,
}: {
  words?: StudiedWord[];
  shellsEarned?: number;
  scored?: number;
  mode: string;
  seed?: number;
  streak?: number;      // 指定時のみ「伸び」行を出す(SessionSummary相当)
  bandBefore?: number;  // 信頼幅(採点前)
  bandAfter?: number;   // 信頼幅(採点後)
}) {
  const state = useAppState();
  const { addToMyList } = useAppActions();
  const c = useColors();
  const t = useT();
  const s = useMemo(() => makeStyles(c), [c]);
  const { width, height } = useWindowDimensions();
  const [fallbackSeed] = useState(() => (Date.now() & 0xffff) | 1);
  const seedV = seed ?? fallbackSeed;

  // ランダム画像=大きめ(全幅・最大で画面高の46%)。縦横比は画像に合わせ、切れないよう高さを上限で抑える。
  const img = useMemo(() => pickAfterStudyImage(seedV, Date.now()), [seedV]); // 今の季節の絵を優先
  const dims = img ? Image.resolveAssetSource(img) : null;
  const aspect = dims && dims.width && dims.height ? dims.width / dims.height : 3 / 2;
  const frameW = width - spacing.lg * 2;
  const frameH = Math.min(frameW / aspect, Math.round(height * 0.46));

  // 桜のねぎらい(session_end)。願い非依存・短い一言。台詞はstory/voice.tsが正本。
  const line = useMemo(
    () => composeVoice({ occasion: { kind: 'session_end' }, variant: 'full', now: Date.now(), seed: seedV }).text,
    [seedV],
  );

  // 匿名計測: 学習完了を1回だけ(SessionSummaryの代わりにここで担保)。願い別リテンション用にwishKey添付。
  useEffect(() => {
    void sendEvent('session_complete', { mode, scored, wishKey: metricsWishKey(state) });
    void sendFirstSessionOnce(state);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const showGrowth = streak != null;
  const narrowed = bandBefore != null && bandAfter != null && bandBefore > bandAfter;

  return (
    <View style={s.wrap}>
      {img && (
        <View style={[s.imgFrame, { width: frameW, height: frameH }]}>
          <Image source={img} style={s.img} resizeMode="cover" />
        </View>
      )}

      {/* 桜貝の獲得数＋ねぎらい */}
      <View style={s.rewardBlock}>
        {shellsEarned > 0 && (
          <View style={s.shellRow}>
            <Text style={s.shellIco}>🌸</Text>
            <Text style={s.shellN}>+{shellsEarned}</Text>
            <Text style={s.shellL}>桜貝</Text>
          </View>
        )}
        {!!line && <Text style={s.voice}>{line}</Text>}
      </View>

      {/* 誠実な伸び(任意)。SessionSummaryを吸収=採点した語/信頼幅/streak。 */}
      {showGrowth && (
        <View style={s.growth}>
          <Row s={s} label={t('sessionsummary.scored')} value={`+${scored}`} good={scored > 0} />
          {bandAfter != null && (
            <Row s={s} label={t('sessionsummary.confidence')} value={narrowed ? `±${bandBefore} → ±${bandAfter}` : `±${bandAfter}`} good={narrowed} />
          )}
          <Row s={s} label={t('sessionsummary.streak')} value={`🔥 ${streak}`} good={false} />
        </View>
      )}

      {/* この回の学習語をまとめて「私の単語帳」へ(☑)。読解/聴解など語が無ければ非表示。 */}
      {words.length > 0 && (
        <View style={s.listCard}>
          <Text style={s.listH}>単語帳に入れる</Text>
          {words.map((w) => {
            const saved = isInMyList(state.myList ?? [], w.ref);
            return (
              <Pressable key={w.ref.type + w.ref.id} style={s.wrow} onPress={() => addToMyList(w.ref)} hitSlop={4}>
                <Ionicons name={saved ? 'checkbox' : 'square-outline'} size={22} color={saved ? c.blue : c.mute} />
                <View style={s.wtextWrap}>
                  <RubyText text={w.word} style={s.wword} rubyStyle={s.wruby} />
                  {!!w.meaning && <Text style={s.wmean} numberOfLines={1}>{w.meaning}</Text>}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

function Row({ s, label, value, good }: { s: ReturnType<typeof makeStyles>; label: string; value: string; good: boolean }) {
  return (
    <View style={s.grow_row}>
      <Text style={s.grow_label}>{label}</Text>
      <Text style={[s.grow_value, good && s.grow_valueGood]}>{value}</Text>
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
    growth: { width: '100%', backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: spacing.md, gap: spacing.sm },
    grow_row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    grow_label: { fontSize: ty.small, color: c.mute },
    grow_value: { fontSize: ty.body, fontWeight: '800', color: c.ink2 },
    grow_valueGood: { color: c.green },
    listCard: { width: '100%', backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: spacing.md, gap: 2 },
    listH: { fontSize: ty.small, fontWeight: '800', color: c.ink2, marginBottom: spacing.xs },
    // 1行=☑＋単語(＋意味)。コンパクトに。
    wrow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 7 },
    wtextWrap: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
    wword: { fontSize: ty.body, fontWeight: '800', color: c.ink },
    wruby: { color: c.mute },
    wmean: { flex: 1, fontSize: ty.small, color: c.mute },
  });
