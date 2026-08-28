// 単語タブの1区分カード(漢字/語彙/文法)をインライン表示する自己完結コンポーネント。
// カバー率バッジ＋バー＋辞書リスト/各ドリル/聞き取り/書き取り 入口。タブ画面の背景の下に差し込む。
import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { spacing, radius, type as ty, shadow, useColors, type ThemeColors } from '../theme';
import { useAppState } from '../store/store';
import { coverageBars } from '../store/selectors';
import { UNLOCK_NEED, overallCoveragePct } from '../store/unlocks';
import Badge from './Badge';
import BadgeCollection from './BadgeCollection';
import { badgeTierIndex } from '../data/badges';
import type { RootStackParamList, WordsStackParamList, Kubun } from '../navigation/types';
import { useT } from '../i18n';

type Nav = NativeStackNavigationProp<WordsStackParamList & RootStackParamList>;
const META: Record<Kubun, { emoji: string; labelKey: string; listKey: string }> = {
  kanji: { emoji: '漢', labelKey: 'cards.kanji', listKey: 'cards.kanji_list' },
  vocab: { emoji: '語', labelKey: 'cards.vocab', listKey: 'cards.vocab_list' },
  grammar: { emoji: '文', labelKey: 'cards.grammar', listKey: 'cards.grammar_list' },
};

export default function KubunCard({ kubun }: { kubun: Kubun }) {
  const nav = useNavigation<Nav>();
  const state = useAppState();
  const c = useColors();
  const t = useT();
  const s = useMemo(() => makeStyles(c), [c]);
  const now = Date.now();
  const badgeSet = state.settings.badgeSet ?? 'gorgeous';
  const cov = useMemo(() => coverageBars(state, now), [state]); // eslint-disable-line react-hooks/exhaustive-deps
  const b = cov.find((x) => x.key === kubun) ?? { learned: 0, total: 0 };
  const pct = b.total > 0 ? Math.round((100 * b.learned) / b.total) : 0;
  const [collPct, setCollPct] = useState<number | null>(null);
  const m = META[kubun];

  // 段階解禁: 【全体カバー率】(3辞書合計)がしきい値に達すると学習モードが解禁(演出=UnlockCelebrationと同基準)。
  // カード内のpct/バッジ/バーは分野別カバー率の表示のまま。解禁ゲートだけ overallPct を使う。
  const overallPct = useMemo(() => overallCoveragePct(state, now), [state]); // eslint-disable-line react-hooks/exhaustive-deps
  const dev = state.settings.devUnlockAll === true; // 全解禁は専用トグルのみ(ポイント無限では解禁しない)
  const gated = (labelKey: string, onPress: () => void, need = 0) => {
    const ok = need === 0 || dev || overallPct >= need;
    return (
      <Pressable key={labelKey} disabled={!ok} style={({ pressed }) => [s.linkBtn, ok && pressed && s.pressed, !ok && s.linkLocked]} onPress={ok ? onPress : undefined}>
        <Text style={[s.linkTxt, !ok && s.linkTxtLocked]}>{t(labelKey)}</Text>
        {ok ? <Text style={s.chevron}>›</Text> : <Text style={s.lockHint}>🔒 {t('unlock.needpct', { pct: String(need) })}</Text>}
      </Pressable>
    );
  };

  // 入口ボタンを「解禁しきい値(need)の昇順=アンロック順」で上から並べる(同値は追加順を維持)。
  //  漢字: 漢字リスト(0)→聞き取り(5)→漢字書き取り(10) / 語彙: 語彙リスト(0)→聞き取り(5)→語彙パズル(15)
  //  文法: 文法リスト(0)→意味を選ぶ(0)→文法パズル(20)。カタカナ/ひらがな(N5・0)はリストと同じ0で上位。
  const entries: { need: number; el: React.ReactNode }[] = [];
  const add = (labelKey: string, onPress: () => void, need = 0) => entries.push({ need, el: gated(labelKey, onPress, need) });

  add(m.listKey, () => nav.navigate('WordList', { view: kubun, mode: 'study' }), 0); // 辞書リストは常時解禁(土台)
  if (kubun === 'grammar') {
    add('cards.gmeaning', () => nav.navigate('WordDrill', { kind: 'gMeaning' }), 0);          // 意味を選ぶ(認識)=初期解禁
    add('cards.gorder', () => nav.navigate('WordDrill', { kind: 'gBuild' }), UNLOCK_NEED.gbuild); // 文法パズル(産出)=文法20%
  }
  if (kubun === 'vocab') {
    add('cards.vmeaning', () => nav.navigate('WordDrill', { kind: 'vMeaning' }), 0);                    // 語彙の意味(認識)=初期解禁・文脈なし4択
    add('cards.produce', () => nav.navigate('WordDrill', { kind: 'vProduce' }), UNLOCK_NEED.vproduce); // 語彙パズル(産出)=語彙15%
    add('cards.listening', () => nav.navigate('ListeningQuiz', { kind: 'vocab' }), UNLOCK_NEED.listen); // 聞き取り=語彙5%
  }
  if (kubun === 'kanji') {
    // 漢字の面=4面(読み/意味/聞き取り/形)。認識テストは意味/読みを別ボタンに分離(ユーザー方針2026-08-26)。
    // 表示順(ユーザー方針2026-08-26): リスト→書き取り(練習)→ドリルを難易度の易しい順(意味→読み→形→聞き取り)。
    // 書き取りは「練習」＝面に非計上(手書き産出の練習ツール)。★/SRSはKakitori側で従来どおり記録。
    add('cards.kakitori_entry', () => nav.navigate('Kakitori', { level: state.settings.level, mode: 'drill', script: 'kanji' }), UNLOCK_NEED.kakitori); // 漢字書き取り(練習)
    if (state.settings.level === 'N5') { // カタカナ/ひらがな書き取り(練習)はN5のみ・書き取りの直後
      add('cards.kakitori_kata', () => nav.navigate('Kakitori', { mode: 'drill', script: 'katakana' }), 0);
      add('cards.kakitori_hira', () => nav.navigate('Kakitori', { mode: 'drill', script: 'hiragana' }), 0);
    }
    add('cards.kanji_mean', () => nav.navigate('KanjiRecognition', { mode: 'mean' }), 0); // ①意味(認識・易)
    add('cards.kanji_read', () => nav.navigate('KanjiRecognition', { mode: 'read' }), 0); // ②読み(認識)
    add('cards.kanji_form', () => nav.navigate('KanjiForm'), 0);                            // ③形の弁別(似た字4択)
    add('cards.listening', () => nav.navigate('ListeningQuiz', { kind: 'kanji' }), UNLOCK_NEED.listen); // ④聞き取り(難)
  }
  // 漢字は指定した表示順(挿入順)を尊重。語彙/文法は従来どおり解禁順(need昇順)。
  const ordered = kubun === 'kanji'
    ? entries.map((e, i) => ({ ...e, i }))
    : entries.map((e, i) => ({ ...e, i })).sort((a, b) => a.need - b.need || a.i - b.i);

  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        <View style={s.badge}><Text style={s.badgeTxt}>{m.emoji}</Text></View>
        <Text style={s.cardTitle}>{t(m.labelKey)}</Text>
        <Pressable style={s.covBadgeWrap} onPress={() => setCollPct(pct)}>
          <Badge set={badgeSet} metric="cover" pct={pct} size={54} />
          <Text style={s.covTierName}>{t('home.coverTier' + badgeTierIndex(pct))}</Text>
        </Pressable>
      </View>
      <View style={s.covBarRow}>
        <View style={s.covTrack}><View style={[s.covFill, { width: `${pct}%`, backgroundColor: c.blue }]} /></View>
        <Text style={s.covFrac}>{b.learned}/{b.total}</Text>
      </View>

      {ordered.map((o) => o.el)}
      <BadgeCollection visible={collPct !== null} onClose={() => setCollPct(null)} set={badgeSet} metric="cover" pct={collPct} />
    </View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  card: { ...shadow(1), backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: spacing.md, gap: spacing.sm },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  badge: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: c.blueLight },
  badgeTxt: { color: c.blueDark, fontSize: ty.h2, fontWeight: '800' },
  cardTitle: { flex: 1, fontSize: ty.h2, fontWeight: '800', color: c.ink, letterSpacing: 0.5 },
  covBadgeWrap: { width: 64, alignItems: 'center' },
  covTierName: { fontSize: 9, color: c.mute, fontWeight: '700', marginTop: 2, textAlign: 'center' },
  covBarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  covTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: c.bgSoft, overflow: 'hidden' },
  covFill: { height: 8, borderRadius: 4 },
  covFrac: { fontSize: ty.small, fontWeight: '700', color: c.ink2, minWidth: 56, textAlign: 'right' },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: c.bgSoft, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md },
  linkTxt: { flex: 1, fontSize: ty.body, fontWeight: '700', color: c.ink2 },
  chevron: { fontSize: 24, color: c.trace, fontWeight: '700' },
  pressed: { backgroundColor: c.bgSoft, opacity: 0.85 },
  // 未解禁ボタン: グレーアウト＋鍵＋「◯%で解禁」。
  linkLocked: { backgroundColor: c.bg, borderStyle: 'dashed', opacity: 0.7 },
  linkTxtLocked: { color: c.faint },
  lockHint: { fontSize: ty.tiny, fontWeight: '800', color: c.mute },
});
