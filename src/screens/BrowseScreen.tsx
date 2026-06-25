// 一覧・検索(辞書/単語帳)。漢字/語彙/文法を検索＆一覧。各項目に習得状態を表示。出題のランダムと逆に「目的の語を探す」用。
import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState } from '../store/store';
import { KANJI, VOCAB, GRAMMAR, KANJI_EXAMPLE_MULTI, VOCAB_EXAMPLE, DICT_EXT_VOCAB, DICT_EXT_KANJI } from '../data';
import type { KanjiReadingExample } from '../data';
import { effectiveP } from '../engine/engine';
import type { StudyItem } from '../data';
import { useT } from '../i18n';
import { highlightSegments } from '../quiz/highlight';

type Kubun = 'vocab' | 'kanji' | 'grammar';
const KUBUN: { key: Kubun; labelKey: string }[] = [
  { key: 'vocab', labelKey: 'browse.vocab' },
  { key: 'kanji', labelKey: 'browse.kanji' },
  { key: 'grammar', labelKey: 'browse.grammar' },
];
// 辞書のレベル並び(易→難)。「全」表示時はこの順でソート。
const LEVEL_ORDER = ['N5', 'N4', 'N3', 'N2', 'N1'];

function haystack(it: StudyItem): string {
  if (it.type === 'vocab') return `${it.word} ${it.reading} ${it.meaning}`.toLowerCase();
  if (it.type === 'kanji') return `${it.char} ${it.on} ${it.kun} ${it.meaning}`.toLowerCase();
  return `${it.point} ${it.romaji} ${it.meaning} ${it.exampleJa} ${it.exampleEn}`.toLowerCase();
}

// 音/訓の例語を「読み：語（語の読み）」で頻度順に連結。語の読みが見出し読みと同じなら（…）を省略。
function fmtReadEx(list: KanjiReadingExample[]): string {
  return list
    .map((e) => (e.wordReading && e.wordReading !== e.reading ? `${e.reading}：${e.word}（${e.wordReading}）` : `${e.reading}：${e.word}`))
    .join('　');
}

export default function BrowseScreen() {
  const t = useT();
  const { settings, items } = useAppState();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const now = Date.now();

  const [kubun, setKubun] = useState<Kubun>('vocab');
  const [level, setLevel] = useState<string>(settings.level); // 'all' または N5..N1
  const [query, setQuery] = useState('');

  // 辞書は N5-N1(語彙/漢字はN2/N1の参考辞書を追加)。文法はN5-N3のまま。
  const src = useMemo<StudyItem[]>(
    () => (kubun === 'vocab' ? [...VOCAB, ...DICT_EXT_VOCAB] : kubun === 'kanji' ? [...KANJI, ...DICT_EXT_KANJI] : GRAMMAR),
    [kubun],
  );
  // この区分に存在するレベルだけをN5→N1順で(プルダウン用)。
  const availLevels = useMemo(() => LEVEL_ORDER.filter((l) => src.some((i) => i.level === l)), [src]);
  // 選択レベルがこの区分に無ければ「全」扱い(例: 文法でN1選択→全表示)。
  const effLevel = level === 'all' || availLevels.includes(level) ? level : 'all';

  const results = useMemo(() => {
    const byLevel =
      effLevel === 'all'
        ? [...src].sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level)) // 全=N5→N1でソート
        : src.filter((i) => i.level === effLevel);
    const q = query.trim().toLowerCase();
    return q ? byLevel.filter((i) => haystack(i).includes(q)) : byLevel;
  }, [src, effLevel, query]);

  const statusMark = (item: StudyItem) => {
    const st = items[item.id];
    const status = !st ? 'new' : effectiveP(st, now) >= 0.6 ? 'learned' : 'seen';
    return (
      <Text style={[s.status, status === 'learned' && s.stLearned, status === 'seen' && s.stSeen]}>
        {status === 'learned' ? '✓' : status === 'seen' ? '・' : ''}
      </Text>
    );
  };

  const renderSentence = (ja: string, target: string, en?: string) => {
    if (!ja) return null;
    const segs = highlightSegments(ja, target);
    return (
      <>
        <Text style={s.example}>
          {segs.map((sg, i) => (
            <Text key={i} style={sg.hit ? s.exampleHit : undefined}>{sg.text}</Text>
          ))}
        </Text>
        {en ? <Text style={s.exampleEn}>{en}</Text> : null}
      </>
    );
  };

  const renderItem = ({ item }: { item: StudyItem }) => (
    <View style={s.row}>
      <View style={s.rowMain}>
        {item.type === 'vocab' ? (
          <>
            <Text style={s.term}>{item.word}　<Text style={s.reading}>{item.reading}</Text></Text>
            <Text style={s.meaning}>{item.meaning}</Text>
            {VOCAB_EXAMPLE[item.id] ? renderSentence(VOCAB_EXAMPLE[item.id].ja, item.word, VOCAB_EXAMPLE[item.id].en) : null}
          </>
        ) : item.type === 'kanji' ? (
          <>
            <Text style={s.term}>{item.char}　<Text style={s.reading}>{item.kun ? t('browse.kanjiReading', { on: item.on, kun: item.kun }) : t('browse.kanjiReading_on', { on: item.on })}</Text></Text>
            <Text style={s.meaning}>{item.meaning}</Text>
            {KANJI_EXAMPLE_MULTI[item.char]?.on?.length ? (
              <Text style={s.example}>音 {fmtReadEx(KANJI_EXAMPLE_MULTI[item.char].on!)}</Text>
            ) : null}
            {KANJI_EXAMPLE_MULTI[item.char]?.kun?.length ? (
              <Text style={s.example}>訓 {fmtReadEx(KANJI_EXAMPLE_MULTI[item.char].kun!)}</Text>
            ) : null}
          </>
        ) : (
          <>
            <Text style={s.term}>{item.point}</Text>
            <Text style={s.meaning}>{item.meaning}</Text>
            {renderSentence(item.exampleJa, item.point)}
          </>
        )}
      </View>
      <Text style={s.levelBadge}>{item.level}</Text>
      {statusMark(item)}
    </View>
  );

  return (
    <SafeAreaView style={s.c} edges={['top']}>
      <View style={s.top}>
        <Text style={s.tab}>{t('browse.title')}</Text>
        <TextInput
          style={s.search}
          value={query}
          onChangeText={setQuery}
          placeholder={t('browse.searchPlaceholder')}
          placeholderTextColor={c.faint}
          autoCorrect={false}
        />
      </View>

      <View style={s.filters}>
        {KUBUN.map((k) => (
          <Pressable key={k.key} onPress={() => setKubun(k.key)} style={[s.chip, kubun === k.key && s.chipOn]}>
            <Text style={[s.chipTxt, kubun === k.key && s.chipTxtOn]}>{t(k.labelKey)}</Text>
          </Pressable>
        ))}
      </View>

      {/* レベル選択(全＝N5→N1ソート / 各級＝その級のみ)。区分に在るレベルだけ表示。 */}
      <View style={[s.filters, s.filters2]}>
        <Pressable onPress={() => setLevel('all')} style={[s.chip, effLevel === 'all' && s.chipOn]}>
          <Text style={[s.chipTxt, effLevel === 'all' && s.chipTxtOn]}>{t('browse.allLevels')}</Text>
        </Pressable>
        {availLevels.map((l) => (
          <Pressable key={l} onPress={() => setLevel(l)} style={[s.chip, effLevel === l && s.chipOn]}>
            <Text style={[s.chipTxt, effLevel === l && s.chipTxtOn]}>{l}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={s.count}>{t('browse.count', { n: results.length })}</Text>

      <FlatList
        data={results}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        initialNumToRender={20}
        contentContainerStyle={s.listBody}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Text style={s.empty}>{t('browse.empty')}</Text>}
      />
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  c: { flex: 1, backgroundColor: c.bg },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  tab: { fontSize: ty.small, fontWeight: '700', letterSpacing: 1, color: c.mute },
  search: {
    flex: 1,
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.line,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: ty.body,
    color: c.ink,
  },
  filters: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, flexWrap: 'wrap' },
  filters2: { marginTop: spacing.sm },
  chip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
  },
  chipOn: { borderColor: c.blue, backgroundColor: c.blueLight },
  chipTxt: { fontSize: ty.small, color: c.ink2, fontWeight: '600' },
  chipTxtOn: { color: c.blueDark, fontWeight: '800' },
  count: { fontSize: ty.tiny, color: c.faint, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  listBody: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.line,
    padding: spacing.md,
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  rowMain: { flex: 1, gap: 2 },
  term: { fontSize: ty.h2, fontWeight: '800', color: c.ink },
  reading: { fontSize: ty.small, fontWeight: '600', color: c.mute },
  meaning: { fontSize: ty.small, color: c.ink2 },
  example: { fontSize: ty.body, color: c.ink, lineHeight: 24, marginTop: spacing.xs },
  exampleHit: { color: c.ink, textDecorationLine: 'underline' },
  exampleEn: { fontSize: ty.tiny, color: c.faint, fontStyle: 'italic', marginTop: 2 },
  levelBadge: { fontSize: 10, fontWeight: '800', color: c.mute, alignSelf: 'flex-start' },
  status: { fontSize: ty.h2, fontWeight: '800', color: c.trace, width: 20, textAlign: 'center' },
  stLearned: { color: c.green },
  stSeen: { color: c.faint },
  empty: { fontSize: ty.body, color: c.faint, textAlign: 'center', marginTop: spacing.xl },
});
