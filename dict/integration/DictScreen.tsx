// ドロップイン辞書画面（App B「聞いて話せる日本語」辞書タブ用）
// JLPTアプリの BrowseScreen を移植。SRS/ストア依存を除去し props 駆動・テーマ可変の自己完結部品にした。
// 依存: react / react-native / react-native-safe-area-context のみ（App B に既にある）。
//
// データ: dict/ja-vocab.json（語彙）・dict/ja-kanji.json（漢字）を props で渡す（読込方法は App B 側が選ぶ）。
//   ※意味(gloss)は JMdict 由来＝英語。多言語の意味が要る場合は別途翻訳（要コスト）。
//   ※類義語(ja-synonyms.json)は JLPT 出題生成用でこの辞書表示には使わない（キーが App B 語彙と結合できないため）。
//
// 使い方（最小）:
//   import vocab from '../../dict/ja-vocab.json';
//   import kanji from '../../dict/ja-kanji.json';
//   <DictScreen vocab={vocab} kanji={kanji} />
// テーマを揃える場合は colors / labels を渡す（下の型参照）。

import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export interface DictVocab {
  word: string; reading: string; level: string;
  gloss: string; senses?: string[]; pos?: string[];
}
export interface DictKanji {
  char: string; on?: string[]; kun?: string[];
  meanings?: string[]; grade?: number; strokes?: number;
}

// 画面の文言（i18n）。未指定は日本語デフォルト。App B 側で t() の結果を渡せば多言語化。
export interface DictLabels {
  title?: string;
  searchPlaceholder?: string;
  vocab?: string;
  kanji?: string;
  allLevels?: string;
  count?: (n: number) => string;
  empty?: string;
  strokes?: (n: number) => string;
}

// 配色。未指定は明るい既定。App B の useTokens 等から渡せばテーマ統一できる。
export interface DictColors {
  bg: string; surface: string; line: string; ink: string; ink2: string;
  mute: string; faint: string; blue: string; blueLight: string; blueDark: string;
}

const DEFAULT_COLORS: DictColors = {
  bg: '#f6f7f9', surface: '#ffffff', line: '#e6e8ec', ink: '#1a1d22', ink2: '#454b54',
  mute: '#6b7280', faint: '#9aa1ab', blue: '#2563eb', blueLight: '#e8f0fe', blueDark: '#1d4ed8',
};

const DEFAULT_LABELS: Required<DictLabels> = {
  title: '辞書',
  searchPlaceholder: '単語・読み・意味で検索',
  vocab: '語彙',
  kanji: '漢字',
  allLevels: 'すべて',
  count: (n) => `${n}件`,
  empty: '見つかりませんでした',
  strokes: (n) => `${n}画`,
};

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
type Kubun = 'vocab' | 'kanji';

const vHay = (v: DictVocab) =>
  `${v.word} ${v.reading} ${v.gloss} ${(v.senses || []).join(' ')}`.toLowerCase();
const kHay = (k: DictKanji) =>
  `${k.char} ${(k.on || []).join(' ')} ${(k.kun || []).join(' ')} ${(k.meanings || []).join(' ')}`.toLowerCase();

export interface DictScreenProps {
  vocab: DictVocab[];
  kanji: DictKanji[];
  initialLevel?: string;     // 既定の級フィルタ（未指定=すべて）
  colors?: Partial<DictColors>;
  labels?: DictLabels;
}

export default function DictScreen({ vocab, kanji, initialLevel, colors, labels }: DictScreenProps) {
  const c = useMemo(() => ({ ...DEFAULT_COLORS, ...(colors || {}) }), [colors]);
  const L = useMemo(() => ({ ...DEFAULT_LABELS, ...(labels || {}) }), [labels]);
  const s = useMemo(() => makeStyles(c), [c]);

  const [kubun, setKubun] = useState<Kubun>('vocab');
  const [level, setLevel] = useState<string | null>(initialLevel ?? null); // null=すべて
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (kubun === 'vocab') {
      let r = level ? vocab.filter((v) => v.level === level) : vocab;
      if (q) r = r.filter((v) => vHay(v).includes(q));
      return r;
    }
    // 漢字(KANJIDIC2由来)は JLPT級フィールドが無いため級フィルタは適用しない（級チップも非表示）。
    let r = kanji;
    if (q) r = r.filter((k) => kHay(k).includes(q));
    return r;
  }, [kubun, level, query, vocab, kanji]);

  const renderVocab = (v: DictVocab) => (
    <View style={s.row}>
      <View style={s.rowMain}>
        <Text style={s.term}>{v.word}　<Text style={s.reading}>{v.reading}</Text></Text>
        <Text style={s.meaning}>{v.gloss}</Text>
        {v.senses && v.senses.length > 1 ? <Text style={s.sub}>{v.senses.slice(0, 5).join(' / ')}</Text> : null}
      </View>
      <Text style={s.levelBadge}>{v.level}</Text>
    </View>
  );

  const renderKanji = (k: DictKanji) => (
    <View style={s.row}>
      <View style={s.rowMain}>
        <Text style={s.term}>
          {k.char}　<Text style={s.reading}>{[(k.on || []).join('・'), (k.kun || []).join('・')].filter(Boolean).join('　')}</Text>
        </Text>
        <Text style={s.meaning}>{(k.meanings || []).join(', ')}</Text>
        <Text style={s.sub}>
          {[k.grade ? `小${k.grade}` : '', k.strokes ? L.strokes(k.strokes) : ''].filter(Boolean).join('　')}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={s.c} edges={['top']}>
      <View style={s.top}>
        <Text style={s.tab}>{L.title}</Text>
        <TextInput
          style={s.search}
          value={query}
          onChangeText={setQuery}
          placeholder={L.searchPlaceholder}
          placeholderTextColor={c.faint}
          autoCorrect={false}
        />
      </View>

      <View style={s.filters}>
        <Pressable onPress={() => setKubun('vocab')} style={[s.chip, kubun === 'vocab' && s.chipOn]}>
          <Text style={[s.chipTxt, kubun === 'vocab' && s.chipTxtOn]}>{L.vocab}</Text>
        </Pressable>
        <Pressable onPress={() => setKubun('kanji')} style={[s.chip, kubun === 'kanji' && s.chipOn]}>
          <Text style={[s.chipTxt, kubun === 'kanji' && s.chipTxtOn]}>{L.kanji}</Text>
        </Pressable>
        {kubun === 'vocab' ? (
          <>
            <View style={s.sep} />
            <Pressable onPress={() => setLevel(null)} style={[s.chip, level === null && s.chipOn]}>
              <Text style={[s.chipTxt, level === null && s.chipTxtOn]}>{L.allLevels}</Text>
            </Pressable>
            {LEVELS.map((lv) => (
              <Pressable key={lv} onPress={() => setLevel(lv)} style={[s.chip, level === lv && s.chipOn]}>
                <Text style={[s.chipTxt, level === lv && s.chipTxtOn]}>{lv}</Text>
              </Pressable>
            ))}
          </>
        ) : null}
      </View>

      <Text style={s.count}>{L.count(results.length)}</Text>

      <FlatList
        data={results as Array<DictVocab | DictKanji>}
        keyExtractor={(it, i) => ((it as DictVocab).word ?? (it as DictKanji).char ?? '') + i}
        renderItem={({ item }) => (kubun === 'vocab' ? renderVocab(item as DictVocab) : renderKanji(item as DictKanji))}
        initialNumToRender={20}
        contentContainerStyle={s.listBody}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Text style={s.empty}>{L.empty}</Text>}
      />
    </SafeAreaView>
  );
}

const makeStyles = (c: DictColors) => StyleSheet.create({
  c: { flex: 1, backgroundColor: c.bg },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16 },
  tab: { fontSize: 12, fontWeight: '700', letterSpacing: 1, color: c.mute },
  search: {
    flex: 1, backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.line,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, color: c.ink,
  },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, flexWrap: 'wrap', alignItems: 'center' },
  sep: { width: 1, height: 18, backgroundColor: c.line, marginHorizontal: 2 },
  chip: { paddingVertical: 5, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface },
  chipOn: { borderColor: c.blue, backgroundColor: c.blueLight },
  chipTxt: { fontSize: 12, color: c.ink2, fontWeight: '600' },
  chipTxtOn: { color: c.blueDark, fontWeight: '800' },
  count: { fontSize: 11, color: c.faint, paddingHorizontal: 20, paddingTop: 8 },
  listBody: { paddingHorizontal: 16, paddingBottom: 32 },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: 12,
    borderWidth: 1, borderColor: c.line, padding: 14, marginTop: 8, gap: 8,
  },
  rowMain: { flex: 1, gap: 2 },
  term: { fontSize: 20, fontWeight: '800', color: c.ink },
  reading: { fontSize: 13, fontWeight: '600', color: c.mute },
  meaning: { fontSize: 13, color: c.ink2 },
  sub: { fontSize: 11, color: c.faint, marginTop: 2 },
  levelBadge: { fontSize: 10, fontWeight: '800', color: c.mute, alignSelf: 'flex-start' },
  empty: { fontSize: 16, color: c.faint, textAlign: 'center', marginTop: 32 },
});
