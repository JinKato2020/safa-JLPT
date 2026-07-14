// 一覧・検索(辞書/単語帳)。漢字/語彙/文法を検索＆一覧。各項目に習得状態を表示。出題のランダムと逆に「目的の語を探す」用。
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, FlatList, SectionList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import { playVocab } from '../data/vocabAudio';
import type { RootStackParamList } from '../navigation/types';
import { spacing, radius, type as ty, shadow, useColors, type ThemeColors } from '../theme';
import { useAppState, useAppActions } from '../store/store';
import { isInMyList, type SaveRef } from '../store/state';
import { KANJI, VOCAB, GRAMMAR, KANJI_CARDS, VOCAB_EXAMPLE, VOCAB_FURIGANA, DICT_EXT_VOCAB, DICT_EXT_KANJI, meaningIn, exampleIn, cardFaceReadings } from '../data';
import { effectiveP } from '../engine/engine';
import type { StudyItem } from '../data';
import { loadSharedDict, syncDictCache, type SharedDict } from '../../shared/JLPT-Listening/dict/dictRemote';
import { buildDictMaps, sharedVocabItems, sharedKanjiItems } from '../data/dictView';
import { useT } from '../i18n';
import { highlightSegments } from '../quiz/highlight';
import RubyText from '../components/RubyText';
import { rubyForWord } from '../kakitori/furigana';
import Dropdown from '../components/Dropdown';
import { levelListFor } from '../words/levelList';
import { studySections } from '../words/sections';
import { CAT_BY_ID } from '../data/categories';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Kubun = 'vocab' | 'kanji' | 'grammar';
const KUBUN: { key: Kubun; labelKey: string; glyph: string }[] = [
  { key: 'vocab', labelKey: 'browse.vocab', glyph: '語' },
  { key: 'kanji', labelKey: 'browse.kanji', glyph: '漢' },
  { key: 'grammar', labelKey: 'browse.grammar', glyph: '文' },
];
// 辞書のレベル並び(易→難)。「全」表示時はこの順でソート。
const LEVEL_ORDER = ['N5', 'N4', 'N3', 'N2', 'N1'];

function haystack(it: StudyItem): string {
  if (it.type === 'vocab') return `${it.word} ${it.reading} ${it.meaning}`.toLowerCase();
  if (it.type === 'kanji') return `${it.char} ${it.on} ${it.kun} ${it.meaning}`.toLowerCase();
  return `${it.point} ${it.romaji} ${it.meaning} ${it.exampleJa} ${it.exampleEn}`.toLowerCase();
}

const hiraToKata = (s: string): string => s.replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));

// 漢字カードの音訓＋例語(KANJI_CARDS=正データ・読みごとに高頻度例語)。表示はローカル優先(リモート辞書の羅列を使わない)。
// 1読み=1行: [音/訓][読み][先頭例語(語全体ルビ)][例語の英訳gloss]。詳細カードと同じ情報を辞書/単語タブにも。
interface CardLine { tag: string; label: string; furiWord: string; gloss: string; }
// カード表面はレベル適応: 自分のレベル(またはその漢字のレベル)以下の読みだけ。上の読みは詳細でのみ。
function cardReadingLines(char: string, userLevel: string): CardLine[] {
  return cardFaceReadings(char, userLevel).map((r) => {
    const ex = r.examples[0];
    return {
      tag: r.type === 'on' ? '音' : '訓',
      label: r.type === 'on' ? hiraToKata(r.reading) : r.reading,
      furiWord: ex ? rubyForWord(ex.word, ex.reading) : r.reading,
      gloss: ex?.gloss ?? '',
    };
  });
}

export default function BrowseScreen() {
  const t = useT();
  const { settings, items, myList } = useAppState();
  const { addToMyList } = useAppActions();
  // 辞書は常にルビ表示(引くためのツールなので、レベル適応ゲートを免除して全漢字にルビ)。
  const rubyGate = (_run?: string) => true;
  const nav = useNavigation<Nav>();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const now = Date.now();
  const l1 = settings.l1; // 母語コード
  // 母語(l1)の意味。無ければ undefined(=英語表示)。
  const nm = (key: string): string | undefined => (l1 && l1 !== 'en' ? meaningIn(key, l1) : undefined);

  const route = useRoute();
  const params = (route.params ?? {}) as { view?: Kubun; mode?: 'dict' | 'study' };
  const study = params.mode === 'study';
  const [kubun] = useState<Kubun>(params.view ?? 'vocab');
  const [level, setLevel] = useState<string>(settings.level); // 'all' または N5..N1
  const [query, setQuery] = useState('');

  useEffect(() => { Audio.setAudioModeAsync({ playsInSilentModeIOS: true }).catch(() => {}); }, []);

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
      study
        ? levelListFor(kubun, settings.level)
        : kubun === 'vocab' ? (sVocab ?? [...VOCAB, ...DICT_EXT_VOCAB])
        : kubun === 'kanji' ? (sKanji ?? [...KANJI, ...DICT_EXT_KANJI])
        : GRAMMAR,
    [kubun, sVocab, sKanji, study, settings.level],
  );
  // 例文: 共有辞書があれば共有(語|読み / char)を、無ければ同梱を使う。
  // 同梱学習語は辞書タブでも「ローカル例文」を優先する(リモート共有辞書の不適合＝いくら→幾ら/あっち→彼方 を避ける)。
  // 同梱に無い辞書専用語(sv:…)のみリモートを使う。
  const vocabExOf = (it: StudyItem & { type: 'vocab' }) =>
    VOCAB_EXAMPLE[it.id] ?? (shared ? shared.examples[`${it.word}|${it.reading}`] : undefined);
  // この区分に存在するレベルだけをN5→N1順で(プルダウン用)。
  const availLevels = useMemo(() => LEVEL_ORDER.filter((l) => src.some((i) => i.level === l)), [src]);
  // 選択レベルがこの区分に無ければ「全」扱い(例: 文法でN1選択→全表示)。
  const effLevel = level === 'all' || availLevels.includes(level) ? level : 'all';

  const results = useMemo(() => {
    if (study) return src; // 既に当該レベルのコアのみ・検索なし
    const byLevel =
      effLevel === 'all'
        ? [...src].sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level)) // 全=N5→N1でソート
        : src.filter((i) => i.level === effLevel);
    const q = query.trim().toLowerCase();
    return q ? byLevel.filter((i) => haystack(i).includes(q)) : byLevel;
  }, [src, effLevel, query, study]);

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
            <RubyText text={ja} target={target} style={s.exampleRubyBase} hitStyle={s.exampleHit} rubyStyle={s.exampleRuby} rubyGate={rubyGate} />
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

  // 単語帳(my単語帳)へ追加/解除するトグルボタン。語彙・文法の各行に置く。
  const SaveButton = ({ refItem }: { refItem: SaveRef }) => {
    const saved = isInMyList(myList ?? [], refItem);
    return (
      <Pressable
        style={s.saveBtn}
        hitSlop={10}
        onPress={() => addToMyList(refItem)}
        accessibilityLabel={t(saved ? 'mywords.added' : 'mywords.add')}
      >
        <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={20} color={saved ? c.blue : c.mute} />
      </Pressable>
    );
  };

  const renderItem = ({ item }: { item: StudyItem }) => {
    const playWord = (id: string, reading: string) => {
      playVocab(id).then((ok) => {
        if (!ok && reading) Speech.speak(reading, { language: 'ja-JP' });
      });
    };
    const rowInner = (
      <>
      <View style={s.rowMain}>
        {item.type === 'vocab' ? (
          <>
            {/* 見出し語: 読みを漢字の上にルビ表示(レベル適応=ユーザーのレベル以上の漢字を含む時だけ)。 */}
            <View style={s.termRubyWrap}>
              <Text style={s.termRuby} numberOfLines={1}>{rubyGate(item.word) ? item.reading : ' '}</Text>
              <Text style={s.term}>{item.word}</Text>
            </View>
            <Text style={s.meaning}>{nm(item.id) ?? item.meaning}</Text>
            {nm(item.id) ? <Text style={s.meaningEn}>{item.meaning}</Text> : null}
            {(() => {
              const ex = vocabExOf(item);
              // ふりがな付きの正データ(VOCAB_FURIGANA=vocabExamplesAi由来)を優先=ルビ表示。無ければ素の例文。
              const furi = VOCAB_FURIGANA[item.id];
              const ja = furi ?? ex?.ja;
              if (!ja) return null;
              const norm = (str?: string) => (str ? str.replace(/[（(][^）)]*[）)]/g, '').replace(/\s|　/g, '') : '');
              // 英訳は表示JA(良文)と同一文の時だけ(共有辞書の別例文との不一致を避ける)。
              const en = ex?.en && norm(ex.ja) === norm(ja) ? ex.en : undefined;
              const nex = l1 && l1 !== 'en' ? exampleIn(item.id, l1) : undefined;
              return (<>{renderSentence(ja, item.word, en)}{nex ? <Text style={s.exampleNe}>{nex}</Text> : null}</>);
            })()}
          </>
        ) : item.type === 'kanji' ? (
          <>
            <Text style={s.term}>{item.char}</Text>
            {/* 意味はローカル優先: 母語 > カードの簡潔意味(glossShort) > 同梱/リモート。リモートの平坦な多義羅列を避ける。 */}
            <Text style={s.meaning}>{nm(item.char) ?? KANJI_CARDS[item.char]?.glossShort ?? item.meaning}</Text>
            {nm(item.char) && KANJI_CARDS[item.char]?.glossShort ? <Text style={s.meaningEn}>{KANJI_CARDS[item.char].glossShort}</Text> : null}
            {(() => {
              const lines = cardReadingLines(item.char, settings.level);
              return (
                <View style={s.readBox}>
                  {lines.map((e, i) => (
                    <View key={i} style={s.readLine}>
                      <Text style={s.readTag}>{e.tag}</Text>
                      <Text style={s.readLabel}>{e.label}</Text>
                      <View style={s.rubyWord}>
                        <RubyText text={e.furiWord} style={s.readWord} rubyStyle={s.exampleRuby} rubyGate={rubyGate} />
                      </View>
                      {!!e.gloss && <Text style={s.readGloss} numberOfLines={1}>{e.gloss}</Text>}
                    </View>
                  ))}
                </View>
              );
            })()}
          </>
        ) : (
          <>
            {/（[^）]*）/.test(item.point) ? (
              <View style={s.termRubyWrap}>
                <RubyText text={item.point} style={s.term} rubyStyle={s.termRuby} rubyGate={rubyGate} />
              </View>
            ) : (
              <Text style={s.term}>{item.point}</Text>
            )}
            <Text style={s.meaning}>{item.meaning}</Text>
            {(() => {
              // 文法点を例文中で下線。活用等で辞書形がそのまま無い時は文法点の漢字にフォールバック(合う→合)。
              const pt = item.point.replace(/[（(][^）)]*[）)]/g, '').replace(/[〜～]/g, '');
              const plainEx = item.exampleJa.replace(/[（(][^）)]*[）)]/g, '');
              const tgt = pt && plainEx.includes(pt) ? pt : (pt.match(/[一-鿿々〆〇ヶ]+/)?.[0] ?? pt);
              return renderSentence(item.exampleJa, tgt);
            })()}
          </>
        )}
      </View>
      <Text style={s.levelBadge}>{item.level}</Text>
      {statusMark(item)}
      </>
    );
    if (item.type === 'kanji') {
      return (
        <Pressable style={s.row} onPress={() => nav.navigate('KanjiDetail', { char: item.char, scope: study ? 'level' : 'all' })}>
          {rowInner}
        </Pressable>
      );
    }
    if (item.type === 'vocab') {
      return (
        <View style={s.row}>
          {rowInner}
          <View style={s.rowBtns}>
            <Pressable
              style={s.playBtn}
              hitSlop={10}
              onPress={() => playWord(item.id, item.reading)}
              accessibilityLabel={`${item.word} を再生`}
            >
              <Ionicons name="play" size={20} color={c.mute} />
            </Pressable>
            <SaveButton refItem={{ type: 'vocab', id: item.id }} />
          </View>
        </View>
      );
    }
    // 文法
    return (
      <View style={s.row}>
        {rowInner}
        <View style={s.rowBtns}>
          <SaveButton refItem={{ type: 'grammar', id: item.id }} />
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.c} edges={['top']}>
      {/* 上部の操作: 戻る＋検索窓。辞書タブ(dictモード)はここに「レベルのプルダウン」だけを添える。 */}
      <View style={s.top}>
        {study || route.params ? (
          <Pressable onPress={() => nav.goBack()} hitSlop={12}>
            <Text style={s.close}>{study ? '←' : '×'}</Text>
          </Pressable>
        ) : <View style={{ width: 30 }} />}
        {!study && (
          <TextInput
            style={s.search}
            value={query}
            onChangeText={setQuery}
            placeholder={t('browse.searchPlaceholder')}
            placeholderTextColor={c.faint}
            autoCorrect={false}
          />
        )}
        {study && <Text style={s.title}>{t(KUBUN.find((k) => k.key === kubun)!.labelKey)}</Text>}
        {study && <View style={{ width: 30 }} />}
      </View>

      {/* レベル変更のプルダウン(全＝N5→N1ソート / 各級＝その級のみ)＋ 右に「今どの区分の一覧か」を明示。 */}
      {!study && (
        <View style={[s.filters, s.filters2, s.filtersRow]}>
          <View style={s.filterSide}>
            <Dropdown
              value={effLevel}
              options={['all', ...availLevels]}
              labelFor={(l) => (l === 'all' ? t('browse.allLevels') : l)}
              onSelect={setLevel}
            />
          </View>
          <Text style={s.listTitle}>{t(KUBUN.find((k) => k.key === kubun)!.labelKey)}</Text>
          <View style={s.filterSide} />
        </View>
      )}

      <Text style={s.count}>{t('browse.count', { n: results.length })}</Text>

      {study ? (
        <SectionList
          key={`sec-${kubun}-${settings.level}`}
          sections={studySections(kubun, results).map((sec) => ({ ...sec, key: sec.catId }))}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={({ section }) => (
            <View style={s.catHeaderWrap}>
              {section.umbrella ? <Text style={s.catUmbrella}>{CAT_BY_ID[section.umbrella]?.label}</Text> : null}
              <Text style={s.catHeader}>{section.label}</Text>
            </View>
          )}
          stickySectionHeadersEnabled={false}
          initialNumToRender={20}
          contentContainerStyle={s.listBody}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={s.empty}>{t('browse.empty')}</Text>}
        />
      ) : (
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
      )}
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  c: { flex: 1, backgroundColor: c.bg },
  catHeaderWrap: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm, backgroundColor: c.bg },
  catUmbrella: { fontSize: ty.small, fontWeight: '700', color: c.mute, letterSpacing: 1, marginBottom: 2 },
  catHeader: { fontSize: ty.h2, fontWeight: '800', color: c.ink },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  close: { fontSize: 30, color: c.mute, fontWeight: '700' },
  tab: { fontSize: ty.small, fontWeight: '700', letterSpacing: 1, color: c.mute },
  title: { flex: 1, textAlign: 'center', fontSize: ty.h2, fontWeight: '800', color: c.ink },
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
  filtersRow: { alignItems: 'center', flexWrap: 'nowrap' },
  filterSide: { flex: 1, alignItems: 'flex-start' }, // 左=プルダウン / 右=空スペーサ。両側flex:1で区分名を中央に。
  listTitle: { fontSize: ty.h2, fontWeight: '800', color: c.ink, textAlign: 'center' },
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
  playBtn: { paddingLeft: 10, paddingVertical: 4, alignSelf: 'center' },
  rowBtns: { alignItems: 'center', justifyContent: 'center', gap: 6, paddingLeft: 6 },
  saveBtn: { paddingVertical: 4, paddingHorizontal: 4 },
  rowMain: { flex: 1, gap: 2 },
  // App Bのリスト見出しに合わせ、見出し語は明朝(Shippori Mincho)で上質に。
  term: { fontSize: ty.h2, fontWeight: '800', color: c.ink, letterSpacing: 0.3 },
  reading: { fontSize: ty.small, fontWeight: '600', color: c.mute },
  // 見出し語の読みルビ(語の上に小さく・中央寄せ)。
  termRubyWrap: { alignSelf: 'flex-start', alignItems: 'center' },
  termRuby: { fontSize: 11, lineHeight: 13, fontWeight: '600', color: c.mute, textAlign: 'center' },
  meaning: { fontSize: ty.small, color: c.ink2 },
  meaningEn: { fontSize: ty.tiny, color: c.faint, marginTop: 1 },
  example: { fontSize: ty.body, color: c.ink, lineHeight: 24, marginTop: spacing.xs },
  exampleRubyWrap: { marginTop: spacing.xs },
  exampleRubyBase: { fontSize: ty.body, color: c.ink },
  exampleRuby: { fontSize: 9, lineHeight: 11, color: c.faint, textAlign: 'center' },
  exampleHit: { color: c.ink, textDecorationLine: 'underline' },
  // 漢字カードの音訓行(例語はグループルビ=語の上に読み)。
  // 1読み=1行(音/訓・読み・例語・英訳)。詳細カードと同じ情報を辞書/単語タブのカードにも。
  readBox: { marginTop: spacing.xs, gap: spacing.xs, alignSelf: 'stretch' },
  readLine: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, flexWrap: 'wrap' },
  readTag: { fontSize: ty.small, fontWeight: '800', color: c.mute },
  readPair: { flexDirection: 'row', alignItems: 'flex-end', marginRight: spacing.md },
  readLabel: { fontSize: ty.body, color: c.ink2, fontWeight: '700' },
  rubyWord: { alignItems: 'center' },
  readWord: { fontSize: ty.body, color: c.ink },
  readGloss: { fontSize: ty.small, color: c.mute, flexShrink: 1, marginBottom: 1 },
  exampleEn: { fontSize: ty.tiny, color: c.faint, fontStyle: 'italic', marginTop: 2 },
  exampleNe: { fontSize: ty.tiny, color: c.mute, marginTop: 1 },
  levelBadge: { fontSize: 10, fontWeight: '800', color: c.mute, alignSelf: 'flex-start' },
  status: { fontSize: ty.h2, fontWeight: '800', color: c.trace, width: 20, textAlign: 'center' },
  stLearned: { color: c.green },
  stSeen: { color: c.faint },
  empty: { fontSize: ty.body, color: c.faint, textAlign: 'center', marginTop: spacing.xl },
});
