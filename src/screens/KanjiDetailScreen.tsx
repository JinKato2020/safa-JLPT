// 漢字詳細(モーダル)。BrowseScreenの辞書カードから開き、全読み(音訓)＋例語(語全体ルビ)＋
// 書き取り練習への導線を提供する。BrowseScreenの意匠/RubyText/KANJI_CARD_READINGSを流用。
import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState } from '../store/store';
import { KANJI, KANJI_CARD_READINGS, KANJI_LEVEL_READINGS, meaningIn } from '../data';
import type { KanjiCardReadingEntry } from '../data';
import { useT } from '../i18n';
import RubyText from '../components/RubyText';
import { rubyForWord } from '../kakitori/furigana';

const hiraToKata = (s: string): string => s.replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));

// 例語は「語全体」にルビ(その語の全漢字が読める形)。BrowseScreenの部分ルビ(対象字だけ)とは異なる。
interface CardLine { label: string; furiWord: string; }
function fullWordReadingLines(char: string): { on: CardLine[]; kun: CardLine[] } {
  const d = KANJI_CARD_READINGS[char];
  if (!d) return { on: [], kun: [] };
  const map = (list: KanjiCardReadingEntry[], isOn: boolean): CardLine[] =>
    list.map((e) => ({
      label: isOn ? hiraToKata(e.reading) : e.reading,
      furiWord: rubyForWord(e.word, e.wordReading),
    }));
  return { on: map(d.on, true), kun: map(d.kun, false) };
}

// scope='level': KANJI_LEVEL_READINGS(当該レベルの読み/例のみ)から行を作る。
// examplesは [word, wordReading] の配列。先頭例を語全体ルビにする。
function levelWordReadingLines(char: string): { on: CardLine[]; kun: CardLine[] } {
  const entries = KANJI_LEVEL_READINGS[char];
  if (!entries) return { on: [], kun: [] };
  const on: CardLine[] = [];
  const kun: CardLine[] = [];
  for (const e of entries) {
    const ex = e.examples && e.examples[0];
    const line: CardLine = {
      label: e.type === 'on' ? hiraToKata(e.reading) : e.reading,
      furiWord: ex ? rubyForWord(ex[0], ex[1]) : e.reading,
    };
    (e.type === 'on' ? on : kun).push(line);
  }
  return { on, kun };
}

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function KanjiDetailScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'KanjiDetail'>>();
  const char = route.params?.char ?? '';
  const t = useT();
  const { settings } = useAppState();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  const l1 = settings.l1;
  const info = useMemo(() => KANJI.find((k) => k.char === char), [char]);
  const meaning = (l1 && l1 !== 'en' ? meaningIn(char, l1) : undefined) ?? info?.meaning;
  const meaningEn = info?.meaning;
  const scope = route.params?.scope ?? 'all';
  const { on, kun } = useMemo(
    () => (scope === 'level' ? levelWordReadingLines(char) : fullWordReadingLines(char)),
    [char, scope],
  );

  const readLine = (tag: string, lines: CardLine[]) => (
    <View style={s.readLine} key={tag}>
      <Text style={s.readTag}>{tag}</Text>
      {lines.map((e, i) => (
        <View key={i} style={s.readPair}>
          <Text style={s.readLabel}>{e.label}：</Text>
          <View style={s.rubyWord}>
            <RubyText text={e.furiWord} style={s.readWord} rubyStyle={s.readRuby} />
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={s.c} edges={['top']}>
      <View style={s.head}>
        <Pressable onPress={() => nav.goBack()} hitSlop={12}><Text style={s.close}>×</Text></Pressable>
        <View style={{ width: 30 }} />
      </View>
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.bigChar}>{char}</Text>
        {!!meaning && <Text style={s.meaning}>{meaning}</Text>}
        {!!meaningEn && meaningEn !== meaning && <Text style={s.meaningEn}>{meaningEn}</Text>}
        {typeof info?.strokes === 'number' && (
          <Text style={s.strokes}>{t('kanjiDetail.strokes', { n: info.strokes })}</Text>
        )}

        {(on.length > 0 || kun.length > 0) ? (
          <View style={s.readingsBox}>
            {on.length ? readLine('音', on) : null}
            {kun.length ? readLine('訓', kun) : null}
          </View>
        ) : (
          <Text style={s.noData}>{t('kanjiDetail.noReadings')}</Text>
        )}

        <Pressable
          style={s.cta}
          onPress={() => nav.navigate('Kakitori', { char })}
        >
          <Text style={s.ctaTxt}>{t('kanjiDetail.practice')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  c: { flex: 1, backgroundColor: c.bg },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  close: { fontSize: 30, color: c.mute, fontWeight: '700' },
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, alignItems: 'center' },
  bigChar: { fontSize: 88, fontFamily: 'ShipporiMincho-Bold', color: c.ink, marginTop: spacing.sm },
  meaning: { fontSize: ty.h2, fontWeight: '700', color: c.ink2, textAlign: 'center', marginTop: spacing.sm },
  meaningEn: { fontSize: ty.small, color: c.faint, textAlign: 'center', marginTop: 2 },
  strokes: { fontSize: ty.small, color: c.mute, marginTop: spacing.xs },
  readingsBox: {
    alignSelf: 'stretch',
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.line,
    padding: spacing.md,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  readLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', rowGap: spacing.sm },
  readTag: { fontSize: ty.small, fontWeight: '800', color: c.mute, marginRight: 6 },
  readPair: { flexDirection: 'row', alignItems: 'flex-end', marginRight: spacing.md, marginTop: spacing.xs },
  readLabel: { fontSize: ty.body, color: c.ink2, fontWeight: '700' },
  rubyWord: { alignItems: 'center' },
  readWord: { fontSize: ty.body, color: c.ink },
  readRuby: { fontSize: 10, lineHeight: 12, color: c.faint, textAlign: 'center' },
  noData: { fontSize: ty.small, color: c.faint, marginTop: spacing.lg },
  cta: {
    alignSelf: 'stretch',
    backgroundColor: c.blue,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  ctaTxt: { fontSize: ty.body, fontWeight: '800', color: '#fff' },
});
