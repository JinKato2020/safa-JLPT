// 単語タブの1区分カード(漢字/語彙/文法)をインライン表示する自己完結コンポーネント。
// カバー率バッジ＋バー＋辞書リスト/各ドリル/聞き取り/書き取り 入口。タブ画面の背景の下に差し込む。
import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { spacing, radius, type as ty, shadow, useColors, type ThemeColors } from '../theme';
import { useAppState } from '../store/store';
import { coverageBars } from '../store/selectors';
import { UNLOCK_NEED } from '../store/unlocks';
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

  // 段階解禁: このカードのkubunカバー率(pct)がしきい値に達すると学習モードが解禁。
  // (漢字聞き取り/書き取りは漢字pct、語彙系は語彙pct、文法系は文法pctで判定=カード内pctと一致。)
  const dev = state.settings.devUnlimitedPoints === true;
  const gated = (labelKey: string, onPress: () => void, need = 0) => {
    const ok = need === 0 || dev || pct >= need;
    return (
      <Pressable key={labelKey} disabled={!ok} style={({ pressed }) => [s.linkBtn, ok && pressed && s.pressed, !ok && s.linkLocked]} onPress={ok ? onPress : undefined}>
        <Text style={[s.linkTxt, !ok && s.linkTxtLocked]}>{t(labelKey)}</Text>
        {ok ? <Text style={s.chevron}>›</Text> : <Text style={s.lockHint}>🔒 {t('unlock.needpct', { pct: String(need) })}</Text>}
      </Pressable>
    );
  };

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

      {/* 辞書リストは常時解禁(参照・学習の土台)。 */}
      {gated(m.listKey, () => nav.navigate('WordList', { view: kubun, mode: 'study' }), 0)}

      {/* 語彙: 意味から単語(産出)=語彙15%で解禁。 */}
      {kubun === 'vocab' ? gated('cards.produce', () => nav.navigate('WordDrill', { kind: 'vProduce' }), UNLOCK_NEED.vproduce) : null}
      {/* 文法: 意味を選ぶ(認識)=初期解禁 / 組み立て(産出)=文法20%で解禁。 */}
      {kubun === 'grammar' ? (
        <>
          {gated('cards.gmeaning', () => nav.navigate('WordDrill', { kind: 'gMeaning' }), 0)}
          {gated('cards.gorder', () => nav.navigate('WordDrill', { kind: 'gBuild' }), UNLOCK_NEED.gbuild)}
        </>
      ) : null}
      {/* 聞き取り(漢字/語彙)=その分野5%で解禁。 */}
      {(kubun === 'vocab' || kubun === 'kanji') ? gated('cards.listening', () => nav.navigate('ListeningQuiz', { kind: kubun }), UNLOCK_NEED.listen) : null}
      {kubun === 'kanji' ? (
        <>
          {/* 漢字書き取り(産出)=漢字10%で解禁。復習も同条件。 */}
          {kakitoriDueToday(state.kakitori, todayStr()).length ? gated('cards.kakitori_review', () => nav.navigate('Kakitori', { mode: 'review' }), UNLOCK_NEED.kakitori) : null}
          {gated('cards.kakitori_entry', () => nav.navigate('Kakitori', { level: state.settings.level, mode: 'drill', script: 'kanji' }), UNLOCK_NEED.kakitori)}
          {/* カタカナ/ひらがな書き取りはN5のみ・初期から解禁(土台)。 */}
          {state.settings.level === 'N5' && (
            <>
              {gated('cards.kakitori_kata', () => nav.navigate('Kakitori', { mode: 'drill', script: 'katakana' }), 0)}
              {gated('cards.kakitori_hira', () => nav.navigate('Kakitori', { mode: 'drill', script: 'hiragana' }), 0)}
            </>
          )}
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
  // 未解禁ボタン: グレーアウト＋鍵＋「◯%で解禁」。
  linkLocked: { backgroundColor: c.bg, borderStyle: 'dashed', opacity: 0.7 },
  linkTxtLocked: { color: c.faint },
  lockHint: { fontSize: ty.tiny, fontWeight: '800', color: c.mute },
});
