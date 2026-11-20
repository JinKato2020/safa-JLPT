// 私の単語帳 = 保存した語彙・漢字・文法の一覧と辞書カードへの入口。
// 本棚/案内キャラは挟まず、開いたら直接いずれかの帳(リスト)を表示。上部のボタンで 漢字帳↔語彙帳↔文法帳 を切り替える。
// 保存参照は同梱データから解決する。
// 単一モーダル・単一入口(辞書タブ最上部)は不変。
import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, type as ty, shadow, type ThemeColors } from '../theme';
import { useStudyColors, studyPaper, StudySceneBanner } from '../components/StudyPresentation';
import { useAppState, useAppActions } from '../store/store';
import type { SaveRef } from '../store/state';
import { VOCAB, GRAMMAR, KANJI, meaningIn } from '../data';
import type { BookKind } from '../data/mywordsArt';
import { useT, meaningL1 } from '../i18n';
import type { DictStackParamList, RootStackParamList } from '../navigation/types';

type Nav = CompositeNavigationProp<
  NativeStackNavigationProp<DictStackParamList, 'MyWords'>,
  NativeStackNavigationProp<RootStackParamList>
>;
const KINDS: BookKind[] = ['kanji', 'vocab', 'grammar']; // 表示順=漢字→語彙→文法(ユーザー指定)

interface Row { ref: SaveRef; title: string; sub: string; level: string; big?: boolean }

export default function MyWordsScreen() {
  const nav = useNavigation<Nav>();
  const state = useAppState();
  const { addToMyList } = useAppActions();
  const c = useStudyColors();
  const t = useT();
  const s = useMemo(() => makeStyles(c), [c]);

  const l1 = meaningL1(state.settings);
  const nm = (key: string, fallback: string) => (l1 && l1 !== 'en' ? meaningIn(key, l1) : undefined) ?? fallback;
  const accentOf = (_k: BookKind) => c.blue; // 色分けしない(区分共通の単色。ユーザー指定)
  const bookTitle = (k: BookKind) => t(k === 'vocab' ? 'mywords.book_vocab' : k === 'kanji' ? 'mywords.book_kanji' : 'mywords.book_grammar');

  const vocabById = useMemo(() => new Map(VOCAB.map((v) => [v.id, v])), []);
  const grammarById = useMemo(() => new Map(GRAMMAR.map((g) => [g.id, g])), []);
  const kanjiById = useMemo(() => new Map(KANJI.map((k) => [k.id, k])), []);

  const rowsByKind = useMemo(() => {
    const out: Record<BookKind, Row[]> = { vocab: [], kanji: [], grammar: [] };
    for (const ref of state.myList ?? []) {
      if (ref.type === 'vocab') {
        const v = vocabById.get(ref.id);
        if (v) out.vocab.push({ ref, title: v.word, sub: `${v.reading ? v.reading + ' ・ ' : ''}${nm(v.id, v.meaning)}`, level: v.level });
      } else if (ref.type === 'kanji') {
        const k = kanjiById.get(ref.id);
        if (k) out.kanji.push({ ref, title: k.char, sub: nm(k.char, k.meaning), level: k.level, big: true });
      } else {
        const g = grammarById.get(ref.id);
        if (g) out.grammar.push({ ref, title: g.point, sub: nm(g.id, g.meaning), level: g.level });
      }
    }
    return out;
  }, [state.myList, vocabById, kanjiById, grammarById, l1]);

  const counts = { vocab: rowsByKind.vocab.length, kanji: rowsByKind.kanji.length, grammar: rowsByKind.grammar.length };
  // 開いたら直接1冊を表示。既定=最初に中身のある帳(無ければ漢字帳)。
  const [view, setView] = useState<BookKind>(() => {
    const list = state.myList ?? [];
    return KINDS.find((k) => list.some((r) => r.type === k)) ?? 'kanji';
  });
  const rows = rowsByKind[view];

  const openCard = (item: Row) => {
    const { type, id } = item.ref;
    if (type === 'kanji') {
      nav.navigate('KanjiDetail', { char: item.title, scope: 'all' });
      return;
    }
    nav.push('DictList', { view: type, entryId: id });
  };

  const rowItem = (item: Row, kind: BookKind) => (
    <View style={s.row}>
      <Pressable style={({ pressed }) => [s.rowLink, pressed && s.rowPressed]}
        accessibilityRole="button" onPress={() => openCard(item)}>
        <View style={[s.accentBar, { backgroundColor: accentOf(kind) }]} />
        <View style={s.rowText}>
          <Text style={[s.rowTitle, item.big && s.rowTitleBig]} numberOfLines={1}>{item.title}</Text>
          <Text style={s.rowSub} numberOfLines={2}>{item.sub}</Text>
        </View>
        <Text style={s.levelBadge}>{item.level}</Text>
        <Ionicons name="chevron-forward" size={16} color={c.mute} />
      </Pressable>
      <Pressable style={s.delBtn} accessibilityRole="button" accessibilityLabel={t('mywords.remove')} onPress={() => addToMyList(item.ref)}>
        <Ionicons name="close" size={18} color={c.faint} />
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      <View style={s.top}>
        <Pressable onPress={() => nav.goBack()} hitSlop={12}><Text style={s.close}>✕</Text></Pressable>
        <Text style={s.title}>{t('mywords.title')}</Text>
        <View style={{ width: 30 }} />
      </View>

      {/* 上部の切り替えボタン: 漢字帳 / 語彙帳 / 文法帳 */}
      <View style={s.tabs}>
        {KINDS.map((k) => {
          const on = view === k;
          return (
            <Pressable
              key={k}
              onPress={() => setView(k)}
              style={[s.tab, on ? { backgroundColor: accentOf(k), borderColor: accentOf(k) } : null]}
            >
              <Text style={[s.tabTxt, on && s.tabTxtOn]} >{bookTitle(k)}</Text>
              <Text style={[s.tabCount, on ? s.tabCountOn : { color: accentOf(k) }]}>{counts[k]}</Text>
            </Pressable>
          );
        })}
      </View>

      {rows.length === 0 ? (
        <View style={s.listEmpty}><Text style={s.emptyTxt}>{t('mywords.book_empty')}</Text></View>
      ) : (
        <FlatList
          ListHeaderComponent={<View style={{ marginBottom: spacing.md }}><StudySceneBanner /></View>}
          data={rows}
          keyExtractor={(r) => `${r.ref.type}:${r.ref.id}`}
          contentContainerStyle={s.list}
          renderItem={({ item }) => rowItem(item, view)}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        />
      )}
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  close: { fontSize: ty.h2, color: c.ink2, width: 30 },
  title: { flex: 1, textAlign: 'center', fontSize: ty.h2, fontWeight: '800', color: c.ink, letterSpacing: 1 },

  // 上部切り替えボタン
  tabs: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  tab: {
    flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface,
  },
  tabTxt: { textAlign: 'center', fontSize: ty.small, fontWeight: '800', color: c.ink2 },
  tabTxtOn: { color: '#fff' },
  tabCount: { fontSize: ty.small, fontWeight: '800' },
  tabCountOn: { color: '#fff' },

  // 各帳リスト
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  listEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyTxt: { fontSize: ty.body, color: c.mute, textAlign: 'center' },
  row: { ...shadow(1), flexDirection: 'row', alignItems: 'center', ...studyPaper(c), overflow: 'hidden', paddingRight: spacing.sm },
  rowLink: { alignSelf: 'stretch', flex: 1, flexDirection: 'row', alignItems: 'center', paddingRight: spacing.sm },
  rowPressed: { backgroundColor: c.bgSoft },
  accentBar: { width: 5, alignSelf: 'stretch' },
  rowText: { flex: 1, paddingVertical: spacing.md, paddingLeft: spacing.md },
  rowTitle: { fontSize: ty.body, fontWeight: '800', color: c.ink },
  rowTitleBig: { fontSize: 28, lineHeight: 34, fontWeight: '800' },
  rowSub: { fontSize: ty.small, color: c.mute, marginTop: 2 },
  levelBadge: { fontSize: 10, fontWeight: '800', color: c.mute, backgroundColor: c.bgSoft, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, overflow: 'hidden', marginRight: spacing.xs },
  delBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
