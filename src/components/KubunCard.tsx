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
import { kakitoriDueToday } from '../kakitori/srs';
import { useT } from '../i18n';

type Nav = NativeStackNavigationProp<WordsStackParamList & RootStackParamList>;
const META: Record<Kubun, { emoji: string; labelKey: string; listKey: string }> = {
  kanji: { emoji: '漢', labelKey: 'cards.kanji', listKey: 'cards.kanji_list' },
  vocab: { emoji: '語', labelKey: 'cards.vocab', listKey: 'cards.vocab_list' },
  grammar: { emoji: '文', labelKey: 'cards.grammar', listKey: 'cards.grammar_list' },
};
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

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

      <Pressable style={({ pressed }) => [s.linkBtn, pressed && s.pressed]} onPress={() => nav.navigate('WordList', { view: kubun, mode: 'study' })}>
        <Text style={s.linkTxt}>{t(m.listKey)}</Text><Text style={s.chevron}>›</Text>
      </Pressable>

      {kubun === 'vocab' ? (
        <Pressable style={({ pressed }) => [s.linkBtn, pressed && s.pressed]} onPress={() => nav.navigate('WordDrill', { kind: 'vProduce' })}>
          <Text style={s.linkTxt}>{t('cards.produce')}</Text><Text style={s.chevron}>›</Text>
        </Pressable>
      ) : null}
      {kubun === 'grammar' ? (
        <>
          <Pressable style={({ pressed }) => [s.linkBtn, pressed && s.pressed]} onPress={() => nav.navigate('WordDrill', { kind: 'gMeaning' })}>
            <Text style={s.linkTxt}>{t('cards.gmeaning')}</Text><Text style={s.chevron}>›</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [s.linkBtn, pressed && s.pressed]} onPress={() => nav.navigate('WordDrill', { kind: 'gBuild' })}>
            <Text style={s.linkTxt}>{t('cards.gorder')}</Text><Text style={s.chevron}>›</Text>
          </Pressable>
        </>
      ) : null}
      {(kubun === 'vocab' || kubun === 'kanji') ? (
        <Pressable style={({ pressed }) => [s.linkBtn, pressed && s.pressed]} onPress={() => nav.navigate('ListeningQuiz', { kind: kubun })}>
          <Text style={s.linkTxt}>{t('cards.listening')}</Text><Text style={s.chevron}>›</Text>
        </Pressable>
      ) : null}
      {kubun === 'kanji' ? (
        <>
          {kakitoriDueToday(state.kakitori, todayStr()).length ? (
            <Pressable style={({ pressed }) => [s.linkBtn, pressed && s.pressed]} onPress={() => nav.navigate('Kakitori', { mode: 'review' })}>
              <Text style={s.linkTxt}>{t('cards.kakitori_review')}</Text><Text style={s.chevron}>›</Text>
            </Pressable>
          ) : null}
          <Pressable style={({ pressed }) => [s.linkBtn, pressed && s.pressed]} onPress={() => nav.navigate('Kakitori', { level: state.settings.level, mode: 'drill', script: 'kanji' })}>
            <Text style={s.linkTxt}>{t('cards.kakitori_entry')}</Text><Text style={s.chevron}>›</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [s.linkBtn, pressed && s.pressed]} onPress={() => nav.navigate('Kakitori', { mode: 'drill', script: 'katakana' })}>
            <Text style={s.linkTxt}>{t('cards.kakitori_kata')}</Text><Text style={s.chevron}>›</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [s.linkBtn, pressed && s.pressed]} onPress={() => nav.navigate('Kakitori', { mode: 'drill', script: 'hiragana' })}>
            <Text style={s.linkTxt}>{t('cards.kakitori_hira')}</Text><Text style={s.chevron}>›</Text>
          </Pressable>
        </>
      ) : null}
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
