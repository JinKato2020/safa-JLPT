// カードタブ = 漢字/語彙/文法の3カード。各カードにカバー率(ホームから移設)＋辞書リストへのリンク。
// 漢字カードは書き取り(サンプル10字)入口＋進捗も持つ。
import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { spacing, radius, type as ty, shadow, useColors, type ThemeColors } from '../theme';
import { useAppState } from '../store/store';
import { coverageBars } from '../store/selectors';
import Badge from '../components/Badge';
import { badgeTierIndex } from '../data/badges';
import type { RootStackParamList, WordsStackParamList } from '../navigation/types';
import { kanjiListFor } from '../kakitori/list';
import { kakitoriDueToday } from '../kakitori/srs';
import { useT } from '../i18n';

type Nav = NativeStackNavigationProp<WordsStackParamList & RootStackParamList>;
type Styles = ReturnType<typeof makeStyles>;
type Key = 'kanji' | 'vocab' | 'grammar';

const CARDS: { key: Key; emoji: string; labelKey: string; listKey: string }[] = [
  { key: 'kanji', emoji: '漢', labelKey: 'cards.kanji', listKey: 'cards.kanji_list' },
  { key: 'vocab', emoji: '語', labelKey: 'cards.vocab', listKey: 'cards.vocab_list' },
  { key: 'grammar', emoji: '文', labelKey: 'cards.grammar', listKey: 'cards.grammar_list' },
];

export default function CardsScreen() {
  const nav = useNavigation<Nav>();
  const state = useAppState();
  const c = useColors();
  const t = useT();
  const s = useMemo(() => makeStyles(c), [c]);
  const now = Date.now();
  const badgeSet = state.settings.badgeSet ?? 'gorgeous';
  const cov = useMemo(() => coverageBars(state, now), [state]);
  const covOf = (k: Key) => cov.find((b) => b.key === k) ?? { learned: 0, total: 0 };
  const kakiTotal = kanjiListFor(state.settings.level).length;
  const kakiDone = Object.values(state.kakitori ?? {}).filter((k) => k.step >= 3).length;

  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={s.c} edges={['top']}>
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.tab}>{t('cards.tab')}</Text>
        <Text style={s.title}>{t('cards.title')}</Text>

        {/* オススメ学習セット: SRSが弱点を自動選択して出題(設計 §2.3)。当面は横断ミックス(Quiz)へ。 */}
        <Pressable style={({ pressed }) => [s.reco, pressed && s.recoPressed]} onPress={() => nav.navigate('Quiz', undefined)}>
          <View style={s.recoIcon}><Text style={s.recoIconTxt}>★</Text></View>
          <View style={s.recoTextWrap}>
            <Text style={s.recoTitle}>{t('cards.reco')}</Text>
            <Text style={s.recoSub}>{t('cards.reco_sub')}</Text>
          </View>
          <Text style={s.recoChevron}>›</Text>
        </Pressable>

        {CARDS.map((card) => {
          const b = covOf(card.key);
          const pct = b.total > 0 ? Math.round((100 * b.learned) / b.total) : 0;
          return (
            <View key={card.key} style={s.card}>
              <View style={s.cardHead}>
                <View style={s.badge}><Text style={s.badgeTxt}>{card.emoji}</Text></View>
                <Text style={s.cardTitle}>{t(card.labelKey)}</Text>
                <View style={s.covBadgeWrap}>
                  <Badge set={badgeSet} metric="cover" pct={pct} size={54} />
                  <Text style={s.covTierName}>{t('home.coverTier' + badgeTierIndex(pct))}</Text>
                </View>
              </View>
              <View style={s.covBarRow}>
                <View style={s.covTrack}><View style={[s.covFill, { width: `${pct}%`, backgroundColor: c.blue }]} /></View>
                <Text style={s.covFrac}>{b.learned}/{b.total}</Text>
              </View>

              <Pressable style={({ pressed }) => [s.linkBtn, pressed && s.pressed]} onPress={() => nav.navigate('WordList', { view: card.key, mode: 'study' })}>
                <Text style={s.linkTxt}>{t(card.listKey)}</Text>
                <Text style={s.chevron}>›</Text>
              </Pressable>

              {/* 問題(練習): 語彙/文法カードから各区分のQuizへ(既存の出題基盤=SRS+バンク)。漢字は聞き取り/書き取りで実践。 */}
              {(card.key === 'vocab' || card.key === 'grammar') ? (
                <Pressable style={({ pressed }) => [s.linkBtn, pressed && s.pressed]} onPress={() => nav.navigate('Quiz', { category: card.key === 'grammar' ? 'bunpou' : 'moji_goi' })}>
                  <Text style={s.linkTxt}>{t('cards.quiz')}</Text>
                  <Text style={s.chevron}>›</Text>
                </Pressable>
              ) : null}

              {(card.key === 'vocab' || card.key === 'kanji') ? (
                <Pressable style={({ pressed }) => [s.linkBtn, pressed && s.pressed]} onPress={() => nav.navigate('ListeningQuiz', { kind: card.key as 'vocab' | 'kanji' })}>
                  <Text style={s.linkTxt}>🎧 {t('cards.listening')}</Text>
                </Pressable>
              ) : null}

              {card.key === 'kanji' && (
                <>
                  {(() => {
                    const due = kakitoriDueToday(state.kakitori, todayStr());
                    return due.length ? (
                      <Pressable style={({ pressed }) => [s.kakiBtn, pressed && s.pressed]} onPress={() => nav.navigate('Kakitori', { mode: 'review' })}>
                        <Text style={s.kakiTxt}>{t('cards.kakitori_review', { n: due.length })}</Text>
                      </Pressable>
                    ) : null;
                  })()}
                  <Pressable style={({ pressed }) => [s.kakiBtn, pressed && s.pressed]} onPress={() => nav.navigate('Kakitori', { level: state.settings.level, mode: 'drill' })}>
                    <Text style={s.kakiTxt}>{t('cards.kakitori_entry')}</Text>
                    <Text style={s.kakiProg}>{t('cards.kakitori_progress', { done: kakiDone, total: kakiTotal })}</Text>
                  </Pressable>
                </>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  c: { flex: 1, backgroundColor: c.bg },
  body: { padding: spacing.lg, gap: spacing.sm },
  tab: { fontSize: ty.small, fontWeight: '700', letterSpacing: 1, color: c.mute },
  title: { fontSize: ty.h1, fontWeight: '800', color: c.ink, marginTop: spacing.xs, marginBottom: spacing.sm },
  reco: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: c.blue, borderRadius: radius.lg, padding: spacing.md, ...shadow(1) },
  recoPressed: { opacity: 0.9 },
  recoIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)' },
  recoIconTxt: { color: '#fff', fontSize: ty.h2, fontWeight: '800' },
  recoTextWrap: { flex: 1 },
  recoTitle: { fontSize: ty.body, fontWeight: '800', color: '#fff' },
  recoSub: { fontSize: ty.small, color: '#fff', opacity: 0.9, marginTop: 2 },
  recoChevron: { fontSize: 24, color: '#fff', fontWeight: '700' },
  card: {
    ...shadow(1),
    backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line,
    padding: spacing.md, marginTop: spacing.sm, gap: spacing.sm,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  badge: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: c.blueLight },
  badgeTxt: { color: c.blueDark, fontSize: ty.h2, fontWeight: '800' },
  cardTitle: { flex: 1, fontSize: ty.h2, fontFamily: 'ShipporiMincho-Bold', color: c.ink, letterSpacing: 0.5 },
  covBadgeWrap: { width: 64, alignItems: 'center' },
  covTierName: { fontSize: 9, color: c.mute, fontWeight: '700', marginTop: 2, textAlign: 'center' },
  covBarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  covTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: c.bgSoft, overflow: 'hidden' },
  covFill: { height: 8, borderRadius: 4 },
  covFrac: { fontSize: ty.small, fontWeight: '700', color: c.ink2, minWidth: 56, textAlign: 'right' },
  linkBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: c.bgSoft, borderRadius: radius.md, borderWidth: 1, borderColor: c.line,
    paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md,
  },
  linkTxt: { flex: 1, fontSize: ty.body, fontWeight: '700', color: c.ink2 },
  chevron: { fontSize: 24, color: c.trace, fontWeight: '700' },
  pressed: { backgroundColor: c.bgSoft, opacity: 0.85 },
  kakiBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: c.blueLight, borderRadius: radius.md, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md,
  },
  kakiTxt: { fontSize: ty.body, fontWeight: '800', color: c.blueDark },
  kakiProg: { fontSize: ty.small, fontWeight: '700', color: c.blueDark },
});
