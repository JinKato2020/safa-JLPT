// my単語帳(モーダル)。解答後の「＋my単語帳」/漢字詳細の「★」で保存した 語彙・漢字・文法 の一覧。
// 3区分(語彙/漢字/文法)をアクセント色のセクションで表示。vocab/kanji/grammar.json から表示テキストを解決
// (未収載idは静かにスキップ=クラッシュ回避)。上部「復習する」= 保存済みの語彙＋漢字をFlashcard(overrideBatch経由)で復習。
import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, SectionList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, type as ty, shadow, useColors, type ThemeColors } from '../theme';
import { useAppState, useAppActions } from '../store/store';
import type { SaveRef } from '../store/state';
import { VOCAB, GRAMMAR, KANJI, meaningIn } from '../data';
import { useT } from '../i18n';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Kind = 'vocab' | 'kanji' | 'grammar';

interface Row { ref: SaveRef; title: string; sub: string; big?: boolean }
interface Sec { kind: Kind; label: string; glyph: string; accent: string; data: Row[] }

export default function MyWordsScreen() {
  const nav = useNavigation<Nav>();
  const state = useAppState();
  const { addToMyList } = useAppActions();
  const c = useColors();
  const t = useT();
  const s = useMemo(() => makeStyles(c), [c]);
  const l1 = state.settings.l1;
  const nm = (key: string, fallback: string) => (l1 && l1 !== 'en' ? meaningIn(key, l1) : undefined) ?? fallback;

  const vocabById = useMemo(() => new Map(VOCAB.map((v) => [v.id, v])), []);
  const grammarById = useMemo(() => new Map(GRAMMAR.map((g) => [g.id, g])), []);
  const kanjiById = useMemo(() => new Map(KANJI.map((k) => [k.id, k])), []);

  // 保存参照を種別ごとの表示行に解決(挿入順を保持)。辞書に無いid(データ更新等)は静かにスキップ。
  const { sections, total } = useMemo(() => {
    const list = state.myList ?? [];
    const vocab: Row[] = [], kanji: Row[] = [], grammar: Row[] = [];
    for (const ref of list) {
      if (ref.type === 'vocab') {
        const v = vocabById.get(ref.id);
        if (v) vocab.push({ ref, title: v.word, sub: `${v.reading ? v.reading + ' ・ ' : ''}${nm(v.id, v.meaning)}` });
      } else if (ref.type === 'kanji') {
        const k = kanjiById.get(ref.id);
        if (k) kanji.push({ ref, title: k.char, sub: nm(k.char, k.meaning), big: true });
      } else {
        const g = grammarById.get(ref.id);
        if (g) grammar.push({ ref, title: g.point, sub: nm(g.id, g.meaning) });
      }
    }
    const all: Sec[] = [
      { kind: 'vocab', label: t('browse.vocab'), glyph: '語', accent: c.mojiGoi, data: vocab },
      { kind: 'kanji', label: t('browse.kanji'), glyph: '漢', accent: c.dokkai, data: kanji },
      { kind: 'grammar', label: t('browse.grammar'), glyph: '文', accent: c.bunpou, data: grammar },
    ];
    return { sections: all.filter((sec) => sec.data.length > 0), total: vocab.length + kanji.length + grammar.length };
  }, [state.myList, vocabById, kanjiById, grammarById, c, t, l1]);

  // 復習対象=保存済みの語彙＋漢字のid(Flashcard対応)。文法は対象外。
  const reviewIds = useMemo(
    () => (state.myList ?? [])
      .filter((r) => (r.type === 'vocab' && vocabById.has(r.id)) || (r.type === 'kanji' && kanjiById.has(r.id)))
      .map((r) => r.id),
    [state.myList, vocabById, kanjiById],
  );

  const accentOf = (kind: Kind) => (kind === 'vocab' ? c.mojiGoi : kind === 'kanji' ? c.dokkai : c.bunpou);

  return (
    <SafeAreaView style={s.c} edges={['top']}>
      <View style={s.top}>
        <Pressable onPress={() => nav.goBack()} hitSlop={12}><Text style={s.close}>✕</Text></Pressable>
        <View style={s.titleWrap}>
          <Text style={s.title}>{t('mywords.title')}</Text>
          {total > 0 ? <Text style={s.totalBadge}>{total}</Text> : null}
        </View>
        <View style={{ width: 24 }} />
      </View>

      {reviewIds.length > 0 ? (
        <Pressable style={({ pressed }) => [s.reviewBtn, pressed && s.pressed]} onPress={() => nav.navigate('Flashcard', { ids: reviewIds })}>
          <Ionicons name="refresh" size={18} color="#fff" />
          <Text style={s.reviewTxt}>{t('mywords.review')}</Text>
          <Text style={s.reviewCount}>{reviewIds.length}</Text>
        </Pressable>
      ) : null}

      {total === 0 ? (
        <View style={s.emptyWrap}>
          <View style={s.emptyIcon}><Ionicons name="star-outline" size={34} color={c.faint} /></View>
          <Text style={s.emptyTxt}>{t('mywords.empty')}</Text>
        </View>
      ) : (
        <SectionList
          sections={sections.map((sec) => ({ ...sec, key: sec.kind }))}
          keyExtractor={(item) => `${item.ref.type}:${item.ref.id}`}
          contentContainerStyle={s.list}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <View style={s.secHead}>
              <View style={[s.secGlyph, { backgroundColor: section.accent }]}><Text style={s.secGlyphTxt}>{section.glyph}</Text></View>
              <Text style={s.secLabel}>{section.label}</Text>
              <Text style={s.secCount}>{section.data.length}</Text>
            </View>
          )}
          renderItem={({ item, section }) => (
            <View style={s.row}>
              <View style={[s.accentBar, { backgroundColor: accentOf(section.kind) }]} />
              <View style={s.rowText}>
                <Text style={[s.rowTitle, item.big && s.rowTitleBig]} numberOfLines={1}>{item.title}</Text>
                <Text style={s.rowSub} numberOfLines={2}>{item.sub}</Text>
              </View>
              <Pressable style={s.delBtn} hitSlop={10} onPress={() => addToMyList(item.ref)}>
                <Ionicons name="close" size={18} color={c.faint} />
              </Pressable>
            </View>
          )}
          SectionSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        />
      )}
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
  // 復習: アクセントの効いた全幅ボタン。
  reviewBtn: { ...shadow(1), flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: c.blue, borderRadius: radius.lg, marginHorizontal: spacing.lg, marginBottom: spacing.sm, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  pressed: { opacity: 0.85 },
  reviewTxt: { flex: 1, fontSize: ty.body, fontWeight: '800', color: '#fff' },
  reviewCount: { fontSize: ty.small, fontWeight: '800', color: '#fff', backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 1, overflow: 'hidden', minWidth: 22, textAlign: 'center' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  emptyIcon: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bgSoft },
  emptyTxt: { fontSize: ty.body, color: c.mute, textAlign: 'center' },
  list: { padding: spacing.lg, paddingTop: spacing.xs },
  // セクション見出し: 区分色のグリフ(語/漢/文)＋ラベル＋件数。
  secHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.sm },
  secGlyph: { width: 26, height: 26, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  secGlyphTxt: { fontSize: ty.small, fontWeight: '900', color: '#fff' },
  secLabel: { flex: 1, fontSize: ty.body, fontWeight: '800', color: c.ink },
  secCount: { fontSize: ty.small, fontWeight: '800', color: c.mute },
  // 行: 左に区分アクセントバー、カード。
  row: { ...shadow(1), flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, overflow: 'hidden', paddingRight: spacing.md },
  accentBar: { width: 5, alignSelf: 'stretch' },
  rowText: { flex: 1, paddingVertical: spacing.md, paddingLeft: spacing.md },
  rowTitle: { fontSize: ty.body, fontWeight: '800', color: c.ink },
  rowTitleBig: { fontSize: 28, lineHeight: 34, fontFamily: 'ShipporiMincho-Bold' },
  rowSub: { fontSize: ty.small, color: c.mute, marginTop: 2 },
  delBtn: { padding: spacing.xs },
});
