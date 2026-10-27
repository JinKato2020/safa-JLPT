// 文法の「くわしい解説」(モーダル)。文法リスト(単語タブ)・文法辞書(辞書タブ)の文法カードから開く(同じ BrowseScreen)。
// 中身はサイト(app_website)の解説を tools/import_grammar_notes.py で取り込んだもの。表示言語で取得(grammarNotes.ts)。
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useT, useUiLang } from '../i18n';
import RubyText from '../components/RubyText';
import { loadGrammarNote, type GrammarNote } from '../data/grammarNotes';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function GrammarNoteScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'GrammarNote'>>();
  const id = route.params?.id ?? '';
  const t = useT();
  const lang = useUiLang();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const [note, setNote] = useState<GrammarNote | null | undefined>(undefined); // undefined=読込中 / null=失敗

  useEffect(() => {
    let alive = true;
    setNote(undefined);
    loadGrammarNote(id, lang).then((n) => { if (alive) setNote(n); });
    return () => { alive = false; };
  }, [id, lang]);

  const section = (label: string) => <Text style={s.section}>{label}</Text>;

  return (
    <SafeAreaView style={s.c} edges={['top']}>
      <View style={s.head}>
        <Pressable onPress={() => nav.goBack()} hitSlop={12}><Text style={s.close}>×</Text></Pressable>
      </View>
      {note === undefined ? (
        <View style={s.center}><ActivityIndicator color={c.blue} /></View>
      ) : note === null ? (
        <View style={s.center}><Text style={s.noData}>{t('grammarNote.loadFailed')}</Text></View>
      ) : (
        <ScrollView contentContainerStyle={s.body}>
          <Text style={s.title}>{note.title}</Text>
          {!!note.summary && <Text style={s.summary}>{note.summary}</Text>}

          {note.patterns.length > 0 && (
            <View style={s.box}>
              {section(t('grammarNote.patterns'))}
              {note.patterns.map((p, i) => (
                <View key={i} style={s.item}>
                  <Text style={s.form}>{p.form}</Text>
                  {!!p.gloss && <Text style={s.sub}>{p.gloss}</Text>}
                </View>
              ))}
            </View>
          )}

          {note.body.map((b, i) => (
            <View key={i} style={s.para}>
              {!!b.h && <Text style={s.h}>{b.h}</Text>}
              <Text style={s.p}>{b.p}</Text>
            </View>
          ))}

          {note.examples.length > 0 && (
            <View style={s.box}>
              {section(t('grammarNote.examples'))}
              {note.examples.map((e, i) => (
                <View key={i} style={s.item}>
                  <RubyText text={e.ja} style={s.exJa} rubyStyle={s.exRuby} />
                  {!!e.romaji && <Text style={s.romaji}>{e.romaji}</Text>}
                  {!!e.tr && <Text style={s.sub}>{e.tr}</Text>}
                  {!!e.note && <Text style={s.exNote}>{e.note}</Text>}
                </View>
              ))}
            </View>
          )}

          {note.pitfalls.length > 0 && (
            <View style={s.box}>
              {section(t('grammarNote.pitfalls'))}
              {note.pitfalls.map((p, i) => (
                <Text key={i} style={s.pitfall}>・{p}</Text>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  c: { flex: 1, backgroundColor: c.bg },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  close: { fontSize: 30, color: c.mute, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  noData: { fontSize: ty.small, color: c.faint, textAlign: 'center' },
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  title: { fontSize: ty.h2, fontWeight: '800', color: c.ink, marginTop: spacing.sm },
  summary: { fontSize: ty.body, color: c.ink2, lineHeight: 24 },
  box: { backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, padding: spacing.md, gap: spacing.sm },
  section: { fontSize: ty.small, fontWeight: '800', color: c.mute },
  item: { gap: 2 },
  form: { fontSize: ty.body, fontWeight: '800', color: c.ink },
  sub: { fontSize: ty.small, color: c.mute, lineHeight: 20 },
  para: { gap: 4 },
  h: { fontSize: ty.body, fontWeight: '800', color: c.ink },
  p: { fontSize: ty.body, color: c.ink2, lineHeight: 24 },
  exJa: { fontSize: ty.body, color: c.ink },
  exRuby: { fontSize: 10, lineHeight: 12, color: c.faint, textAlign: 'center' },
  romaji: { fontSize: ty.small, color: c.faint },
  exNote: { fontSize: ty.small, color: c.faint, fontStyle: 'italic' },
  pitfall: { fontSize: ty.small, color: c.ink2, lineHeight: 20 },
});
