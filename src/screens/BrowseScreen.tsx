// 一覧・検索(辞書/単語帳)。漢字/語彙/文法を検索＆一覧。各項目に習得状態を表示。出題のランダムと逆に「目的の語を探す」用。
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState } from '../store/store';
import { KANJI, VOCAB, GRAMMAR, KANJI_CARD_READINGS, VOCAB_EXAMPLE, DICT_EXT_VOCAB, DICT_EXT_KANJI, meaningIn, exampleIn } from '../data';
import type { KanjiCardReadingEntry } from '../data';
import { effectiveP } from '../engine/engine';
import type { StudyItem } from '../data';
import { loadSharedDict, syncDictCache, type SharedDict } from '../../shared/JLPT-Listening/dict/dictRemote';
import { buildDictMaps, sharedVocabItems, sharedKanjiItems } from '../data/dictView';
import { useT } from '../i18n';
import { highlightSegments } from '../quiz/highlight';
import RubyText from '../components/RubyText';

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

const hiraToKata = (s: string): string => s.replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));

// 漢字カードの音訓＋例語(KANJI_CARD_READINGS=本アプリ作成・KANJIDIC範囲内で検証済み)。
// 読み(音=カタカナ/訓=ひらがな)＋例語(語＋語全体の読み)を構造化して返す。例語はルビ表示する。
interface CardLine { label: string; word: string; wordReading: string; }
function cardReadingLines(char: string): { on: CardLine[]; kun: CardLine[] } {
  const d = KANJI_CARD_READINGS[char];
  if (!d) return { on: [], kun: [] };
  const map = (list: KanjiCardReadingEntry[], isOn: boolean): CardLine[] =>
    list.map((e) => ({ label: isOn ? hiraToKata(e.reading) : e.reading, word: e.word, wordReading: e.wordReading }));
  return { on: map(d.on, true), kun: map(d.kun, false) };
}

export default function BrowseScreen() {
  const t = useT();
  const { settings, items } = useAppState();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const now = Date.now();
  const l1 = settings.l1; // 母語コード
  // 母語(l1)の意味。無ければ undefined(=英語表示)。
  const nm = (key: string): string | undefined => (l1 && l1 !== 'en' ? meaningIn(key, l1) : undefined);

  const [kubun, setKubun] = useState<Kubun>('vocab');
  const [level, setLevel] = useState<string>(settings.level); // 'all' または N5..N1
  const [query, setQuery] = useState('');

  // 共有辞書(単一ソース=Pages配信)を取得＋キャッシュ。読めるまでは同梱データで表示(オフラインfallback)。
  const [shared, setShared] = useState<SharedDict | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try { await syncDictCache(); const d = await loadSharedDict(); if (alive) setShared(d); }
      catch { /* オフライン等は同梱データのまま */ }
    })();
    return () => { alive = false; };
  }, []);

  const maps = useMemo(buildDictMaps, []);
  const sVocab = useMemo(() => (shared ? sharedVocabItems(shared, maps) : null), [shared, maps]);
  const sKanji = useMemo(() => (shared ? sharedKanjiItems(shared, maps) : null), [shared, maps]);
  // 辞書は共有辞書(remote)優先・未取得時は同梱にフォールバック。文法はJLPT固有(共有辞書に無い)=同梱のまま。
  const src = useMemo<StudyItem[]>(
    () =>
      kubun === 'vocab' ? (sVocab ?? [...VOCAB, ...DICT_EXT_VOCAB])
      : kubun === 'kanji' ? (sKanji ?? [...KANJI, ...DICT_EXT_KANJI])
      : GRAMMAR,
    [kubun, sVocab, sKanji],
  );
  // 例文: 共有辞書があれば共有(語|読み / char)を、無ければ同梱を使う。
  const vocabExOf = (it: StudyItem & { type: 'vocab' }) =>
    shared ? shared.examples[`${it.word}|${it.reading}`] : VOCAB_EXAMPLE[it.id];
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
    // ふりがな「漢字（かな）」を含む例文(＝文法)は、括弧併記でなく本物のルビ(漢字の上に小さくかな)で表示。
    if (/（[^）]*）/.test(ja)) {
      return (
        <>
          <View style={s.exampleRubyWrap}>
            <RubyText text={ja} target={target} style={s.exampleRubyBase} hitStyle={s.exampleHit} rubyStyle={s.exampleRuby} />
          </View>
          {en ? <Text style={s.exampleEn}>{en}</Text> : null}
        </>
      );
    }
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
            <Text style={s.meaning}>{nm(item.id) ?? item.meaning}</Text>
            {nm(item.id) ? <Text style={s.meaningEn}>{item.meaning}</Text> : null}
            {(() => {
              const ex = vocabExOf(item);
              if (!ex) return null;
              const nex = l1 && l1 !== 'en' ? exampleIn(item.id, l1) : undefined;
              return (<>{renderSentence(ex.ja, item.word, ex.en)}{nex ? <Text style={s.exampleNe}>{nex}</Text> : null}</>);
            })()}
          </>
        ) : item.type === 'kanji' ? (
          <>
            <Text style={s.term}>{item.char}　<Text style={s.reading}>{item.kun ? t('browse.kanjiReading', { on: item.on, kun: item.kun }) : t('browse.kanjiReading_on', { on: item.on })}</Text></Text>
            <Text style={s.meaning}>{nm(item.char) ?? item.meaning}</Text>
            {nm(item.char) ? <Text style={s.meaningEn}>{item.meaning}</Text> : null}
            {(() => {
              const { on, kun } = cardReadingLines(item.char);
              const line = (tag: string, lines: CardLine[]) => (
                <View style={s.readLine}>
                  <Text style={s.readTag}>{tag}</Text>
                  {lines.map((e, i) => (
                    <View key={i} style={s.readPair}>
                      <Text style={s.readLabel}>{e.label}：</Text>
                      <View style={s.rubyWord}>
                        <Text style={s.exampleRuby} numberOfLines={1}>{e.wordReading}</Text>
                        <Text style={s.readWord}>{e.word}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              );
              return (
                <>
                  {on.length ? line('音', on) : null}
                  {kun.length ? line('訓', kun) : null}
                </>
              );
            })()}
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
        key={`${kubun}-${effLevel}`}
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
  // App Bのリスト見出しに合わせ、見出し語は明朝(Shippori Mincho)で上質に。
  term: { fontSize: ty.h2, fontFamily: 'ShipporiMincho-Bold', color: c.ink, letterSpacing: 0.3 },
  reading: { fontSize: ty.small, fontWeight: '600', color: c.mute },
  meaning: { fontSize: ty.small, color: c.ink2 },
  meaningEn: { fontSize: ty.tiny, color: c.faint, marginTop: 1 },
  example: { fontSize: ty.body, color: c.ink, lineHeight: 24, marginTop: spacing.xs },
  exampleRubyWrap: { marginTop: spacing.xs },
  exampleRubyBase: { fontSize: ty.body, color: c.ink },
  exampleRuby: { fontSize: 9, lineHeight: 11, color: c.faint, textAlign: 'center' },
  exampleHit: { color: c.ink, textDecorationLine: 'underline' },
  // 漢字カードの音訓行(例語はグループルビ=語の上に読み)。
  readLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', marginTop: spacing.xs, rowGap: spacing.xs },
  readTag: { fontSize: ty.small, fontWeight: '800', color: c.mute, marginRight: 6 },
  readPair: { flexDirection: 'row', alignItems: 'flex-end', marginRight: spacing.md },
  readLabel: { fontSize: ty.body, color: c.ink2, fontWeight: '700' },
  rubyWord: { alignItems: 'center' },
  readWord: { fontSize: ty.body, color: c.ink },
  exampleEn: { fontSize: ty.tiny, color: c.faint, fontStyle: 'italic', marginTop: 2 },
  exampleNe: { fontSize: ty.tiny, color: c.mute, marginTop: 1 },
  levelBadge: { fontSize: 10, fontWeight: '800', color: c.mute, alignSelf: 'flex-start' },
  status: { fontSize: ty.h2, fontWeight: '800', color: c.trace, width: 20, textAlign: 'center' },
  stLearned: { color: c.green },
  stSeen: { color: c.faint },
  empty: { fontSize: ty.body, color: c.faint, textAlign: 'center', marginTop: spacing.xl },
});
