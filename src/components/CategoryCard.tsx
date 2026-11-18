// 試験タブの1カテゴリ(文字語彙/文法/読解/聴解)カードをインライン表示する自己完結コンポーネント。
// 全体と大問別の正答率を表示し、各項目から個別出題へ進む。
// 練習タブと表示部品を共用し、カテゴリ別の出題ルートと集計だけを持つ。
import { useMemo } from 'react';
import { Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useColors } from '../theme';
import { useAppState } from '../store/store';
import { ringsFor, daimonRingPct, idsRingPct } from '../store/selectors';
import StudyMenuCard from './StudyMenuCard';
import { readingItemsForSub, READING_SUBTYPES, listeningItemsForSub, LISTENING_SUBTYPES } from '../data';
import { daimonsWithUnits } from '../data/daimon';
import { DAIMON_LABEL } from '../data/examBlueprint';
import { examOf } from '../engine/examProfile';
import type { Category } from '../engine/engine';
import type { RootStackParamList, StudyStackParamList } from '../navigation/types';
import { useT } from '../i18n';

type Nav = NativeStackNavigationProp<StudyStackParamList & RootStackParamList>;
interface SubRing { key: string; label: string; value: number | null; onPress: () => void; }

export default function CategoryCard({ cat }: { cat: Category }) {
  const nav = useNavigation<Nav>();
  const state = useAppState();
  const { settings } = state;
  const c = useColors();
  const t = useT();
  const now = Date.now();
  const lv = settings.level;
  const prof = examOf(settings.targetExam);
  const isJft = prof.exam === 'jft';
  // カード見出しは下端アイコンのラベルと一致させる: moji_goi は漢字を内包するが表示は「語彙」(icon と同じ cards.vocab)。
  const catName = (cc: Category) => t(cc === 'moji_goi' ? 'cards.vocab' : prof.catLabel[cc]);
  const rings = useMemo(() => ringsFor(state, now), [state]); // eslint-disable-line react-hooks/exhaustive-deps
  const mojiDaimons = useMemo(() => daimonsWithUnits(lv, 'moji_goi'), [lv]);
  const bunpouDaimons = useMemo(() => daimonsWithUnits(lv, 'bunpou'), [lv]);
  const readingSubs = useMemo(() => READING_SUBTYPES.map((sub) => ({ ...sub, n: readingItemsForSub(lv, sub.key).length })).filter((x) => x.n > 0), [lv]);
  const listeningSubs = useMemo(() => LISTENING_SUBTYPES.map((sub) => ({ ...sub, n: listeningItemsForSub(lv, sub.key).length })).filter((x) => x.n > 0), [lv]);
  const ringColor = (v: number | null): string => (v === null ? c.trace : v >= 80 ? c.green : v >= 50 ? c.amber : c.red);

  const subRingsFor = (cc: Category): SubRing[] => {
    if (isJft && cc === 'bunpou') return [];
    if (cc === 'moji_goi' || cc === 'bunpou') {
      const list = cc === 'moji_goi' ? mojiDaimons : bunpouDaimons;
      return list.map((d) => ({
        key: d.daimon,
        label: t(DAIMON_LABEL[d.daimon]),
        value: daimonRingPct(state, now, d.daimon),
        onPress: () => (d.daimon === 'passage_grammar' ? nav.navigate('PassageGrammar', { title: t(DAIMON_LABEL[d.daimon]) }) : nav.navigate('Quiz', { daimon: d.daimon, title: t(DAIMON_LABEL[d.daimon]) })),
      }));
    }
    // 正答率は「設問id(questions[].id)」で記録される(quizAnswer)。集計もパッセージidでなく設問idで見る
    // (旧: x.id=パッセージidを渡していたため state に無く、常に未測定=大問別正答率が出ないバグ。StudyCategoryScreenと同じ修正)。
    if (cc === 'dokkai')
      return readingSubs.map((sub) => ({ key: sub.key, label: t(sub.labelKey), value: idsRingPct(state, now, readingItemsForSub(lv, sub.key).flatMap((x) => x.questions.map((q) => q.id))), onPress: () => nav.navigate('Reading', { subtype: sub.key, title: t(sub.labelKey) }) }));
    return listeningSubs.map((sub) => ({ key: sub.key, label: t(sub.labelKey), value: idsRingPct(state, now, listeningItemsForSub(lv, sub.key).flatMap((x) => x.questions.map((q) => q.id))), onPress: () => nav.navigate('Listening', { subtype: sub.key, title: t(sub.labelKey) }) }));
  };
  const subs = subRingsFor(cat);

  const percent = (value: number | null) => value === null ? '–' : `${value}%`;
  const accuracy = t('study.accuracy');
  return (
    <StudyMenuCard
      title={catName(cat)}
      summary={<Text style={{ color: c.mute, fontSize: 12, flexShrink: 1 }}>{accuracy} {percent(rings[cat])}</Text>}
      entries={subs.map((entry) => ({
        key: entry.key, label: entry.label, onPress: entry.onPress,
        detail: { text: percent(entry.value), color: ringColor(entry.value), accessibilityLabel: `${accuracy} ${percent(entry.value)}` },
      }))}
    />
  );
}
