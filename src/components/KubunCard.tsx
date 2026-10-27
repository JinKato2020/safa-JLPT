// 単語タブの1区分カード(漢字/語彙/文法)をインライン表示する自己完結コンポーネント。
// カバー率バッジ＋バー＋辞書リスト/各ドリル/聞き取り/書き取り 入口。タブ画面の背景の下に差し込む。
import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { spacing, radius, type as ty, shadow, useColors, type ThemeColors } from '../theme';
import { useAppState } from '../store/store';
import { coverageBars } from '../store/selectors';
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

  // 入口ボタン。旧「全体カバー率◯%で解禁」の段階解禁は廃止(ユーザー方針2026-10-27)=全モード最初から解禁。
  const entries: React.ReactNode[] = [];
  const add = (labelKey: string, onPress: () => void) => entries.push(
    <Pressable key={labelKey} style={({ pressed }) => [s.linkBtn, pressed && s.pressed]} onPress={onPress}>
      <Text style={s.linkTxt}>{t(labelKey)}</Text>
      <Text style={s.chevron}>›</Text>
    </Pressable>,
  );

  add(m.listKey, () => nav.navigate('WordList', { view: kubun, mode: 'study' })); // 辞書リスト(土台)
  if (kubun === 'grammar') {
    add('cards.gmeaning', () => nav.navigate('WordDrill', { kind: 'gMeaning' })); // 意味を選ぶ(認識)
    add('cards.gorder', () => nav.navigate('WordDrill', { kind: 'gBuild' }));     // 文法パズル(産出)
  }
  if (kubun === 'vocab') {
    add('cards.poster', () => nav.navigate('PosterList'));                             // ポスター朗読(語彙リスト直下)
    add('cards.vmeaning', () => nav.navigate('WordDrill', { kind: 'vMeaning' }));      // 語彙の意味(認識)・文脈なし4択
    add('cards.vreading', () => nav.navigate('WordDrill', { kind: 'vReading' }));      // 語彙の読み(認識)・ルビ無し4択
    add('cards.vwriting', () => nav.navigate('WordDrill', { kind: 'vWriting' }));      // 語彙の表記(かたち・認識)・意味→漢字表記4択
    add('cards.listening', () => nav.navigate('ListeningQuiz', { kind: 'vocab' }));    // 聞き取り(旧解禁順の並びを維持)
    add('cards.produce', () => nav.navigate('WordDrill', { kind: 'vProduce' }));       // 語彙パズル(産出)
  }
  if (kubun === 'kanji') {
    // 漢字の面=4面(読み/意味/聞き取り/形)。認識テストは意味/読みを別ボタンに分離(ユーザー方針2026-08-26)。
    // 表示順(ユーザー方針2026-08-26): リスト→書き取り(練習)→ドリルを難易度の易しい順(意味→読み→形→聞き取り)。
    // 書き取りは「練習」＝面に非計上(手書き産出の練習ツール)。★/SRSはKakitori側で従来どおり記録。
    add('cards.kakitori_entry', () => nav.navigate('Kakitori', { level: state.settings.level, mode: 'drill', script: 'kanji' })); // 漢字書き取り(練習)
    if (state.settings.level === 'N5') { // カタカナ/ひらがな書き取り(練習)はN5のみ・書き取りの直後
      add('cards.kakitori_kata', () => nav.navigate('Kakitori', { mode: 'drill', script: 'katakana' }));
      add('cards.kakitori_hira', () => nav.navigate('Kakitori', { mode: 'drill', script: 'hiragana' }));
    }
    add('cards.kanji_mean', () => nav.navigate('KanjiRecognition', { mode: 'mean' })); // ①意味(認識・易)
    add('cards.kanji_read', () => nav.navigate('KanjiRecognition', { mode: 'read' })); // ②読み(認識)
    add('cards.kanji_form', () => nav.navigate('KanjiForm'));                            // ③形の弁別(似た字4択)
    add('cards.listening', () => nav.navigate('ListeningQuiz', { kind: 'kanji' })); // ④聞き取り(難)
  }

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

      {entries}
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
});
