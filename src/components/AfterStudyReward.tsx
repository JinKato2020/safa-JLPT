// 学習後(全ドリル共通)のごほうび画面。単語タブ/試験タブで同じUI。トップに画像→貝→ねぎらい→単語帳。
//  ①上部に大きめのランダム画像(afterStudyArt・季節連動) ②貝の獲得数🐚(ホーム上部と同じ巻貝)＋桜のねぎらい(voice session_end)
//  ③この回の学習語を☑で「私の単語帳」へまとめて登録(正解/不正解も参考表示・読解/聴解等は語が無ければ非表示)＋見出し右に正解率。
//  ※🎉やセッション完了/得点テキスト・伸び(採点/信頼幅/連続)カードは廃止(ユーザー指定)。付与ロジックには触れない(表示のみ)。
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState, useAppActions } from '../store/store';
import { isInMyList } from '../store/state';
import { composeVoice } from '../story/voice';
import { pickAfterStudyImage } from '../data/afterStudyArt';
import RubyText from './RubyText';
import { sendEvent, sendFirstSessionOnce } from '../telemetry/telemetry';
import type { StudiedWord } from '../data/studiedWords';

export type { StudiedWord } from '../data/studiedWords';

export default function AfterStudyReward({ words = [], shellsEarned = 0, scored = 0, accuracy, mode, seed }: {
  words?: StudiedWord[];
  shellsEarned?: number;
  scored?: number;      // 計測用(session_complete)。画面には出さない。
  accuracy?: number;    // 正解率%(単語帳の見出し右に表示)
  mode: string;
  seed?: number;
}) {
  const state = useAppState();
  const { addToMyList } = useAppActions();
  const c = useColors();
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

  // 匿名計測: 学習完了を1回だけ担保。
  useEffect(() => {
    void sendEvent('session_complete', { mode, scored });
    void sendFirstSessionOnce(state);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const acc = accuracy != null ? `正解率 ${Math.round(accuracy)}%` : null;

  return (
    <View style={s.wrap}>
      {img && (
        <View style={[s.imgFrame, { width: frameW, height: frameH }]}>
          <Image source={img} style={s.img} resizeMode="cover" />
        </View>
      )}

      {/* 貝の獲得数(ホーム上部と同じ🐚)＋ねぎらい */}
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

      {/* この回の学習語をまとめて「私の単語帳」へ(☑＋正解/不正解)。見出し右に正解率。 */}
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
    listAcc: { fontSize: ty.small, fontWeight: '800', color: c.blue, fontVariant: ['tabular-nums'] }, // 同フォントサイズ
    accSolo: { fontSize: ty.small, fontWeight: '800', color: c.blue },
    // 1行=☑＋単語(＋意味)＋正誤マーク。コンパクトに。
    wrow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 7 },
    wtextWrap: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
    wword: { fontSize: ty.body, fontWeight: '800', color: c.ink },
    wruby: { color: c.mute },
    wmean: { flex: 1, fontSize: ty.small, color: c.mute },
  });
