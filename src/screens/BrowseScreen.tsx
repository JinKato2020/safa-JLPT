// 一覧・検索(辞書/単語帳)。漢字/語彙/文法を検索＆一覧。各項目に習得状態を表示。出題のランダムと逆に「目的の語を探す」用。
import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState } from '../store/store';
import { KANJI, VOCAB, GRAMMAR, KANJI_EXAMPLE, VOCAB_EXAMPLE } from '../data';
import { effectiveP } from '../engine/engine';
import type { StudyItem } from '../data';

type Kubun = 'vocab' | 'kanji' | 'grammar';
const KUBUN: { key: Kubun; label: string }[] = [
  { key: 'vocab', label: '語彙' },
  { key: 'kanji', label: '漢字' },
  { key: 'grammar', label: '文法' },
];

function haystack(it: StudyItem): string {
  if (it.type === 'vocab') return `${it.word} ${it.reading} ${it.meaning}`.toLowerCase();
  if (it.type === 'kanji') return `${it.char} ${it.on} ${it.kun} ${it.meaning}`.toLowerCase();
  return `${it.point} ${it.romaji} ${it.meaning} ${it.exampleJa} ${it.exampleEn}`.toLowerCase();
}

// 例文中の文法点をハイライト用セグメントに分割。ふりがな保持・変化系(活用語尾)・A〜B型(離れた2部分)に対応。
function highlightExample(exampleJa: string, point: string): { text: string; hit: boolean }[] {
  const units: { base: string; disp: string }[] = [];
  const re = /(.)（[^）]*）|([\s\S])/gu; // 「基（ふり）」または1文字
  let m: RegExpExecArray | null;
  while ((m = re.exec(exampleJa))) units.push({ base: m[1] ?? m[2] ?? '', disp: m[0] });
  const bases = units.map((u) => u.base).join('');
  const flags = new Array<boolean>(units.length).fill(false);
  const KANA = /[぀-ゟ]/;
  // 文法点を 〜/～ で分割(A〜B型対応)。各部分を順に探す。
  const parts = point
    .replace(/（[^）]*）/g, '')
    .split(/[〜～]/)
    .map((p) => p.replace(/\s/g, '').trim())
    .filter(Boolean);
  let from = 0;
  for (const part of parts) {
    let at = -1;
    let len = 0;
    for (let L = part.length; L >= 2; L--) {
      const i = bases.indexOf(part.slice(0, L), from); // 活用差に強い最長前方一致
      if (i >= 0) { at = i; len = L; break; }
    }
    if (at < 0) continue;
    let end = at + len;
    if (len < part.length) while (end < units.length && KANA.test(units[end].base)) end++; // 変化系も赤
    for (let j = at; j < end; j++) flags[j] = true;
    from = end;
  }
  const segs: { text: string; hit: boolean }[] = [];
  for (let i = 0; i < units.length; i++) {
    const last = segs[segs.length - 1];
    if (last && last.hit === flags[i]) last.text += units[i].disp;
    else segs.push({ text: units[i].disp, hit: flags[i] });
  }
  return segs;
}

export default function BrowseScreen() {
  const { settings, items } = useAppState();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const now = Date.now();

  const [kubun, setKubun] = useState<Kubun>('vocab');
  const [allLevels, setAllLevels] = useState(false);
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const src: StudyItem[] = kubun === 'vocab' ? VOCAB : kubun === 'kanji' ? KANJI : GRAMMAR;
    const byLevel = allLevels ? src : src.filter((i) => i.level === settings.level);
    const q = query.trim().toLowerCase();
    return q ? byLevel.filter((i) => haystack(i).includes(q)) : byLevel;
  }, [kubun, allLevels, query, settings.level]);

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
    const segs = highlightExample(ja, target);
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
            <Text style={s.term}>{item.char}　<Text style={s.reading}>音 {item.on}／訓 {item.kun}</Text></Text>
            <Text style={s.meaning}>{item.meaning}</Text>
            {KANJI_EXAMPLE[item.char] ? (
              <Text style={s.example}>
                {KANJI_EXAMPLE[item.char].word}（{KANJI_EXAMPLE[item.char].reading}）
                {KANJI_EXAMPLE[item.char].kun
                  ? `　${KANJI_EXAMPLE[item.char].kun!.word}（${KANJI_EXAMPLE[item.char].kun!.reading}）`
                  : ''}
              </Text>
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
      {statusMark(item)}
    </View>
  );

  return (
    <SafeAreaView style={s.c} edges={['top']}>
      <View style={s.top}>
        <Text style={s.tab}>辞書</Text>
        <TextInput
          style={s.search}
          value={query}
          onChangeText={setQuery}
          placeholder="語・読み・意味で検索"
          placeholderTextColor={c.faint}
          autoCorrect={false}
        />
      </View>

      <View style={s.filters}>
        {KUBUN.map((k) => (
          <Pressable key={k.key} onPress={() => setKubun(k.key)} style={[s.chip, kubun === k.key && s.chipOn]}>
            <Text style={[s.chipTxt, kubun === k.key && s.chipTxtOn]}>{k.label}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => setAllLevels((v) => !v)} style={[s.chip, allLevels && s.chipOn]}>
          <Text style={[s.chipTxt, allLevels && s.chipTxtOn]}>{allLevels ? '全級' : settings.level}</Text>
        </Pressable>
      </View>

      <Text style={s.count}>{results.length} 件</Text>

      <FlatList
        data={results}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        initialNumToRender={20}
        contentContainerStyle={s.listBody}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Text style={s.empty}>該当なし</Text>}
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
  status: { fontSize: ty.h2, fontWeight: '800', color: c.trace, width: 20, textAlign: 'center' },
  stLearned: { color: c.green },
  stSeen: { color: c.faint },
  empty: { fontSize: ty.body, color: c.faint, textAlign: 'center', marginTop: spacing.xl },
});
