// my単語帳(モーダル)。解答後の「＋my単語帳」で保存した語彙/文法の一覧。
// vocab.json/grammar.json から表示テキストを解決(未収載idは非表示にせずスキップ=クラッシュ回避)。
// 各行は既存の詳細画面が無い(vocab/grammar とも per-item detail route 未整備)ため非タップ。削除(トグルOFF)のみ可能。
// 上部「復習する」= 保存済みvocab idのみを FlashcardScreen(overrideBatch経由)で復習。
import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { spacing, radius, type as ty, shadow, useColors, type ThemeColors } from '../theme';
import { useAppState, useAppActions } from '../store/store';
import type { SaveRef } from '../store/state';
import { VOCAB, GRAMMAR } from '../data';
import { useT } from '../i18n';
import AppButton from '../components/AppButton';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Row { ref: SaveRef; title: string; sub: string; }

export default function MyWordsScreen() {
  const nav = useNavigation<Nav>();
  const state = useAppState();
  const { addToMyList } = useAppActions();
  const c = useColors();
  const t = useT();
  const s = useMemo(() => makeStyles(c), [c]);

  const vocabById = useMemo(() => new Map(VOCAB.map((v) => [v.id, v])), []);
  const grammarById = useMemo(() => new Map(GRAMMAR.map((g) => [g.id, g])), []);

  // 保存済み参照を表示行に解決。辞書に無いid(データ更新等で欠落)は静かにスキップ(クラッシュ回避)。
  const rows: Row[] = useMemo(() => {
    const list = state.myList ?? [];
    const out: Row[] = [];
    for (const ref of list) {
      if (ref.type === 'vocab') {
        const v = vocabById.get(ref.id);
        if (v) out.push({ ref, title: v.word, sub: `${v.reading ? v.reading + ' ・ ' : ''}${v.meaning}` });
      } else {
        const g = grammarById.get(ref.id);
        if (g) out.push({ ref, title: g.point, sub: g.meaning });
      }
    }
    return out;
  }, [state.myList, vocabById, grammarById]);

  // 復習対象=保存済みvocabのidのみ(文法はFlashcardScreenの対象外=spec §5.3)。
  const reviewVocabIds = useMemo(
    () => (state.myList ?? []).filter((r) => r.type === 'vocab' && vocabById.has(r.id)).map((r) => r.id),
    [state.myList, vocabById],
  );

  return (
    <SafeAreaView style={s.c} edges={['top']}>
      <View style={s.top}>
        <Pressable onPress={() => nav.goBack()} hitSlop={12}>
          <Text style={s.close}>✕</Text>
        </Pressable>
        <Text style={s.title}>{t('mywords.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      {reviewVocabIds.length > 0 ? (
        <View style={s.reviewWrap}>
          <AppButton label={t('mywords.review')} onPress={() => nav.navigate('Flashcard', { ids: reviewVocabIds })} />
        </View>
      ) : null}

      {rows.length === 0 ? (
        <View style={s.emptyWrap}>
          <Text style={s.emptyTxt}>{t('mywords.empty')}</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => `${r.ref.type}:${r.ref.id}`}
          contentContainerStyle={s.list}
          renderItem={({ item }) => (
            <View style={s.row}>
              <View style={[s.badge, item.ref.type === 'grammar' && s.badgeGrammar]}>
                <Text style={s.badgeTxt}>{item.ref.type === 'vocab' ? '語' : '文'}</Text>
              </View>
              <View style={s.rowText}>
                <Text style={s.rowTitle}>{item.title}</Text>
                <Text style={s.rowSub}>{item.sub}</Text>
              </View>
              <Pressable style={s.delBtn} hitSlop={10} onPress={() => addToMyList(item.ref)}>
                <Text style={s.delTxt}>✕</Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  c: { flex: 1, backgroundColor: c.bg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  close: { fontSize: ty.h2, color: c.mute, width: 24 },
  title: { fontSize: ty.h2, fontWeight: '800', color: c.ink },
  reviewWrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyTxt: { fontSize: ty.body, color: c.mute, textAlign: 'center' },
  list: { padding: spacing.lg, paddingTop: 0, gap: spacing.sm },
  row: {
    ...shadow(1),
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line,
    padding: spacing.md,
  },
  badge: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: c.blueLight },
  badgeGrammar: { backgroundColor: c.bgSoft },
  badgeTxt: { color: c.blueDark, fontSize: ty.body, fontWeight: '800' },
  rowText: { flex: 1 },
  rowTitle: { fontSize: ty.body, fontWeight: '800', color: c.ink },
  rowSub: { fontSize: ty.small, color: c.mute, marginTop: 2 },
  delBtn: { padding: spacing.xs },
  delTxt: { fontSize: ty.body, color: c.faint, fontWeight: '700' },
});
