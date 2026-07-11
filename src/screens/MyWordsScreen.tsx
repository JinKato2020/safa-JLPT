// my単語帳(モーダル) = イラストの本棚。保存した 語彙/漢字/文法 を「3冊の帳」に分け、タップで各帳を開く。
// 各帳=その区分だけの短いリスト(保存が増えても1画面が長くなりすぎない)。案内役マスコット=子ぎつね書生。
// 保存参照 SaveRef({type}) を vocab/kanji/grammar.json から解決(未収載idは静かにスキップ=クラッシュ回避)。
// 復習=保存済みの語彙＋漢字を Flashcard(overrideBatch)で。文法は対象外。入口=辞書タブ最上部(単一モーダル)。
import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, type as ty, shadow, useColors, type ThemeColors } from '../theme';
import { useAppState, useAppActions } from '../store/store';
import type { SaveRef } from '../store/state';
import { VOCAB, GRAMMAR, KANJI, meaningIn } from '../data';
import { MASCOT, BOOK_COVERS, type BookKind } from '../data/mywordsArt';
import WatercolorBackground from '../components/WatercolorBackground';
import { useT } from '../i18n';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const KINDS: BookKind[] = ['vocab', 'kanji', 'grammar'];

interface Row { ref: SaveRef; title: string; sub: string; big?: boolean }

export default function MyWordsScreen() {
  const nav = useNavigation<Nav>();
  const state = useAppState();
  const { addToMyList } = useAppActions();
  const c = useColors();
  const t = useT();
  const s = useMemo(() => makeStyles(c), [c]);
  const [view, setView] = useState<'shelf' | BookKind>('shelf');

  const l1 = state.settings.l1;
  const nm = (key: string, fallback: string) => (l1 && l1 !== 'en' ? meaningIn(key, l1) : undefined) ?? fallback;
  const accentOf = (k: BookKind) => (k === 'vocab' ? c.mojiGoi : k === 'kanji' ? c.dokkai : c.bunpou);
  const bookTitle = (k: BookKind) => t(k === 'vocab' ? 'mywords.book_vocab' : k === 'kanji' ? 'mywords.book_kanji' : 'mywords.book_grammar');

  const vocabById = useMemo(() => new Map(VOCAB.map((v) => [v.id, v])), []);
  const grammarById = useMemo(() => new Map(GRAMMAR.map((g) => [g.id, g])), []);
  const kanjiById = useMemo(() => new Map(KANJI.map((k) => [k.id, k])), []);

  // 保存参照を種別ごとの表示行に解決(挿入順を保持)。辞書に無いidは静かにスキップ。
  const rowsByKind = useMemo(() => {
    const out: Record<BookKind, Row[]> = { vocab: [], kanji: [], grammar: [] };
    for (const ref of state.myList ?? []) {
      if (ref.type === 'vocab') {
        const v = vocabById.get(ref.id);
        if (v) out.vocab.push({ ref, title: v.word, sub: `${v.reading ? v.reading + ' ・ ' : ''}${nm(v.id, v.meaning)}` });
      } else if (ref.type === 'kanji') {
        const k = kanjiById.get(ref.id);
        if (k) out.kanji.push({ ref, title: k.char, sub: nm(k.char, k.meaning), big: true });
      } else {
        const g = grammarById.get(ref.id);
        if (g) out.grammar.push({ ref, title: g.point, sub: nm(g.id, g.meaning) });
      }
    }
    return out;
  }, [state.myList, vocabById, kanjiById, grammarById, l1]);

  const counts = { vocab: rowsByKind.vocab.length, kanji: rowsByKind.kanji.length, grammar: rowsByKind.grammar.length };
  const total = counts.vocab + counts.kanji + counts.grammar;

  // 復習対象=保存済みの語彙＋漢字のid(Flashcard対応)。文法は対象外。
  const reviewIds = useMemo(
    () => (state.myList ?? [])
      .filter((r) => (r.type === 'vocab' && vocabById.has(r.id)) || (r.type === 'kanji' && kanjiById.has(r.id)))
      .map((r) => r.id),
    [state.myList, vocabById, kanjiById],
  );

  const rowItem = (item: Row, kind: BookKind) => (
    <View style={s.row}>
      <View style={[s.accentBar, { backgroundColor: accentOf(kind) }]} />
      <View style={s.rowText}>
        <Text style={[s.rowTitle, item.big && s.rowTitleBig]} numberOfLines={1}>{item.title}</Text>
        <Text style={s.rowSub} numberOfLines={2}>{item.sub}</Text>
      </View>
      <Pressable style={s.delBtn} hitSlop={10} onPress={() => addToMyList(item.ref)}>
        <Ionicons name="close" size={18} color={c.faint} />
      </Pressable>
    </View>
  );

  // ── 各帳(1区分だけのリスト) ──
  if (view !== 'shelf') {
    const kind = view;
    const rows = rowsByKind[kind];
    return (
      <SafeAreaView style={s.c} edges={['top']}>
        <WatercolorBackground skin="akane" />
        <View style={s.top}>
          <Pressable style={s.backBtn} hitSlop={10} onPress={() => setView('shelf')}>
            <Ionicons name="chevron-back" size={20} color={c.ink2} />
            <Text style={s.backTxt}>{t('mywords.back_to_shelf')}</Text>
          </Pressable>
          <View style={{ width: 24 }} />
        </View>
        <View style={s.kindHead}>
          <View style={[s.kindDot, { backgroundColor: accentOf(kind) }]} />
          <Text style={s.kindTitle}>{bookTitle(kind)}</Text>
          <Text style={s.kindCount}>{counts[kind]}</Text>
        </View>
        {rows.length === 0 ? (
          <View style={s.emptyWrap}>
            <Image source={MASCOT.empty} style={s.emptyMascot} resizeMode="contain" />
            <Text style={s.emptyTxt}>{t('mywords.book_empty')}</Text>
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(r) => `${r.ref.type}:${r.ref.id}`}
            contentContainerStyle={s.list}
            renderItem={({ item }) => rowItem(item, kind)}
            ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          />
        )}
      </SafeAreaView>
    );
  }

  // ── 本棚(ホーム) ──
  return (
    <SafeAreaView style={s.c} edges={['top']}>
      <WatercolorBackground skin="akane" />
      <View style={s.top}>
        <Pressable onPress={() => nav.goBack()} hitSlop={12}><Text style={s.close}>✕</Text></Pressable>
        <View style={s.titleWrap}>
          <Text style={s.title}>{t('mywords.title')}</Text>
          {total > 0 ? <Text style={s.totalBadge}>{total}</Text> : null}
        </View>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={s.shelfBody} showsVerticalScrollIndicator={false}>
        {/* マスコットの挨拶 */}
        <View style={s.greetWrap}>
          <Image source={total === 0 ? MASCOT.empty : MASCOT.hero} style={s.mascot} resizeMode="contain" />
          <View style={s.bubble}>
            <Text style={s.bubbleTxt}>{total === 0 ? t('mywords.mascot_empty') : t('mywords.mascot_hello')}</Text>
          </View>
        </View>

        {/* 本棚: 3冊の帳 */}
        <View style={s.shelfRow}>
          {KINDS.map((k) => (
            <Pressable key={k} style={({ pressed }) => [s.bookCard, pressed && s.pressed]} onPress={() => setView(k)}>
              <View style={s.bookImgWrap}>
                <Image source={BOOK_COVERS[k]} style={s.bookImg} resizeMode="contain" />
                <Text style={[s.bookCount, { backgroundColor: accentOf(k) }]}>{counts[k]}</Text>
              </View>
              <Text style={s.bookTitle} numberOfLines={1}>{bookTitle(k)}</Text>
            </Pressable>
          ))}
        </View>
        <View style={s.plank} />

        {/* 復習: 応援マスコット(水彩地)＋青ボタン */}
        {reviewIds.length > 0 ? (
          <View style={s.reviewRow}>
            <Image source={MASCOT.cheer} style={s.reviewMascot} resizeMode="contain" />
            <Pressable style={({ pressed }) => [s.reviewBtn, pressed && s.pressed]} onPress={() => nav.navigate('Flashcard', { ids: reviewIds })}>
              <Ionicons name="refresh" size={18} color="#fff" />
              <Text style={s.reviewTxt}>{t('mywords.review')}</Text>
              <Text style={s.reviewCount}>{reviewIds.length}</Text>
            </Pressable>
          </View>
        ) : total === 0 ? (
          <Text style={s.hint}>{t('mywords.shelf_hint')}</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  c: { flex: 1, backgroundColor: c.bg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  close: { fontSize: ty.h2, color: c.mute, width: 24 },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontSize: ty.h2, fontWeight: '800', color: c.ink, letterSpacing: 0.3 },
  totalBadge: { fontSize: ty.small, fontWeight: '800', color: c.blueDark, backgroundColor: c.blueLight, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 1, overflow: 'hidden', minWidth: 22, textAlign: 'center' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backTxt: { fontSize: ty.body, fontWeight: '700', color: c.ink2 },

  shelfBody: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  // マスコット＋吹き出し
  greetWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs, marginBottom: spacing.lg },
  mascot: { width: 96, height: 96 },
  bubble: { flex: 1, backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, ...shadow(1) },
  bubbleTxt: { fontSize: ty.body, color: c.ink2, fontWeight: '600', lineHeight: 20 },

  // 本棚(3冊)
  shelfRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' },
  bookCard: { flex: 1, alignItems: 'center', gap: 6 },
  pressed: { opacity: 0.85, transform: [{ translateY: 1 }] },
  bookImgWrap: { width: '100%', aspectRatio: 0.82, alignItems: 'center', justifyContent: 'flex-end' },
  bookImg: { width: '100%', height: '100%' },
  bookCount: { position: 'absolute', top: 2, right: '12%', minWidth: 22, textAlign: 'center', color: '#fff', fontSize: ty.small, fontWeight: '800', borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden', ...shadow(1) },
  bookTitle: { fontSize: ty.small, fontWeight: '800', color: c.ink2 },
  // 棚板
  plank: { height: 12, backgroundColor: '#cba876', borderBottomWidth: 4, borderBottomColor: '#a9814f', borderRadius: 3, marginTop: -6, marginBottom: spacing.xl, ...shadow(1) },

  // 復習
  reviewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reviewBtn: { ...shadow(2), flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: c.blue, borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  reviewMascot: { width: 56, height: 56 },
  reviewTxt: { flex: 1, fontSize: ty.body, fontWeight: '800', color: '#fff' },
  reviewCount: { fontSize: ty.small, fontWeight: '800', color: '#fff', backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 1, overflow: 'hidden', minWidth: 22, textAlign: 'center' },
  hint: { fontSize: ty.small, color: c.mute, textAlign: 'center', lineHeight: 20, paddingHorizontal: spacing.md },

  // 各帳リスト
  kindHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  kindDot: { width: 12, height: 12, borderRadius: 4 },
  kindTitle: { flex: 1, fontSize: ty.h2, fontWeight: '800', color: c.ink },
  kindCount: { fontSize: ty.body, fontWeight: '800', color: c.mute },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  row: { ...shadow(1), flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, overflow: 'hidden', paddingRight: spacing.md },
  accentBar: { width: 5, alignSelf: 'stretch' },
  rowText: { flex: 1, paddingVertical: spacing.md, paddingLeft: spacing.md },
  rowTitle: { fontSize: ty.body, fontWeight: '800', color: c.ink },
  rowTitleBig: { fontSize: 28, lineHeight: 34, fontFamily: 'ShipporiMincho-Bold' },
  rowSub: { fontSize: ty.small, color: c.mute, marginTop: 2 },
  delBtn: { padding: spacing.xs },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  emptyMascot: { width: 120, height: 120 },
  emptyTxt: { fontSize: ty.body, color: c.mute, textAlign: 'center' },
});
