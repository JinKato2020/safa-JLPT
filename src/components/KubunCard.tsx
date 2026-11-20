// 単語タブの1区分カード(漢字/語彙/文法)をインライン表示する自己完結コンポーネント。
// カバー率バッジ＋バー＋辞書リスト/各ドリル/聞き取り/書き取り 入口。タブ画面の背景の下に差し込む。
import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useColors } from '../theme';
import { useAppState } from '../store/store';
import { coverageBars } from '../store/selectors';
import Badge from './Badge';
import StudyMenuCard, { type StudyMenuEntry } from './StudyMenuCard';
import BadgeCollection from './BadgeCollection';
import { badgeTierIndex } from '../data/badges';
import type { RootStackParamList, WordsStackParamList, Kubun } from '../navigation/types';
import { useT } from '../i18n';

type Nav = NativeStackNavigationProp<WordsStackParamList & RootStackParamList>;
const META: Record<Kubun, { labelKey: string; listKey: string }> = {
  kanji: { labelKey: 'cards.kanji', listKey: 'cards.kanji_list' },
  vocab: { labelKey: 'cards.vocab', listKey: 'cards.vocab_list' },
  grammar: { labelKey: 'cards.grammar', listKey: 'cards.grammar_list' },
};

export default function KubunCard({ kubun }: { kubun: Kubun }) {
  const nav = useNavigation<Nav>();
  const state = useAppState();
  const c = useColors();
  const t = useT();
  const now = Date.now();
  const badgeSet = state.settings.badgeSet ?? 'gorgeous';
  const cov = useMemo(() => coverageBars(state, now), [state]); // eslint-disable-line react-hooks/exhaustive-deps
  const b = cov.find((x) => x.key === kubun) ?? { learned: 0, total: 0 };
  const pct = b.total > 0 ? Math.round((100 * b.learned) / b.total) : 0;
  const [collPct, setCollPct] = useState<number | null>(null);
  const m = META[kubun];

  // 入口ボタン。旧「全体カバー率◯%で解禁」の段階解禁は廃止(ユーザー方針2026-10-27)=全モード最初から解禁。
  const entries: StudyMenuEntry[] = [];
  const add = (key: string, onPress: () => void, badge?: string) => entries.push({ key, label: t(key), onPress, badge });

  add(m.listKey, () => nav.navigate('WordList', { view: kubun, mode: 'study' })); // 辞書リスト(土台)
  if (kubun === 'grammar') {
    add('cards.grammar_lessons', () => nav.navigate('GrammarLessons'), t('cards.new_feature'));
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
    add('cards.radical_lessons', () => nav.navigate('RadicalLessons'), t('cards.new_feature'));
    // 漢字の面=4面(読み/意味/聞き取り/形)。認識テストは意味/読みを別ボタンに分離(ユーザー方針2026-08-26)。
    // 表示順(ユーザー方針2026-08-26): リスト→書き取り(練習)→ドリルを難易度の易しい順(意味→読み→形→聞き取り)。
    // 書き取りは「練習」＝面に非計上(手書き産出の練習ツール)。★/SRSはKakitori側で従来どおり記録。
    add('cards.kakitori_entry', () => nav.navigate('Kakitori', { level: state.settings.level, mode: 'drill', script: 'kanji' })); // 漢字書き取り(練習)
    add('cards.kanji_mean', () => nav.navigate('KanjiRecognition', { mode: 'mean' })); // ①意味(認識・易)
    add('cards.kanji_read', () => nav.navigate('KanjiRecognition', { mode: 'read' })); // ②読み(認識)
    add('cards.kanji_form', () => nav.navigate('KanjiForm'));                            // ③形の弁別(似た字4択)
    add('cards.listening', () => nav.navigate('ListeningQuiz', { kind: 'kanji' })); // ④聞き取り(難)
  }

  const tier = t('home.coverTier' + badgeTierIndex(pct));
  return (
    <>
      <StudyMenuCard
        title={t(m.labelKey)}
        summary={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${tier} · ${b.learned}/${b.total}`}
            onPress={() => setCollPct(pct)}
            style={styles.progress}
          >
            <Badge set={badgeSet} metric="cover" pct={pct} size={28} />
            <View style={styles.progressText}>
              <Text style={{ color: c.ink2, fontSize: 11, fontWeight: '700' }}>{b.learned}/{b.total}</Text>
              <Text style={{ color: c.mute, fontSize: 10 }}>{tier}</Text>
            </View>
          </Pressable>
        }
        entries={entries}
      />
      <BadgeCollection visible={collPct !== null} onClose={() => setCollPct(null)} set={badgeSet} metric="cover" pct={collPct} />
    </>
  );
}

const styles = StyleSheet.create({
  progress: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 4, flexShrink: 1 },
  progressText: { flexShrink: 1 },
});
