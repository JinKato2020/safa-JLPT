// 漢字詳細(モーダル)。BrowseScreenの辞書カードから開き、全読み(音訓)＋例語(語全体ルビ)＋
// 書き取り練習への導線を提供する。BrowseScreenの意匠/RubyText/KANJI_CARDSを流用。詳細は全読み表示(表面で隠した応用読みの受け皿)＋レベル超えにバッジ。
import { useMemo, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState } from '../store/store';
import { KANJI, KANJI_CARDS, meaningIn, readingAboveUserLevel } from '../data';
import type { KanjiCard } from '../data';
import { useT } from '../i18n';
import RubyText from '../components/RubyText';
import { rubyForWord } from '../kakitori/furigana';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { playVocab } from '../data/vocabAudio';
import { vocabIdForWord } from '../words/vocabIndex';

const hiraToKata = (s: string): string => s.replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));

// 例語は「語全体」にルビ(その語の全漢字が読める形)。BrowseScreenの部分ルビ(対象字だけ)とは異なる。
// 読みごとに「音/訓・読みラベル・意味(gloss)・例語(1〜3)」を1行にまとめる(KANJI_CARDS正データ)。
interface RdExample { furiWord: string; word: string; reading: string; gloss: string; }
interface RdLine { type: 'on' | 'kun'; label: string; level: string; gloss: string; examples: RdExample[]; }
// 詳細は全読みを表示(表面で隠したレベル超えの読みの受け皿)。levelも保持しバッジ判定に使う。
function cardReadingLines(char: string): RdLine[] {
  const card = KANJI_CARDS[char];
  if (!card) return [];
  return card.readings.map((r) => ({
    type: r.type,
    label: r.type === 'on' ? hiraToKata(r.reading) : r.reading,
    level: r.level,
    gloss: r.gloss,
    examples: r.examples.map((e) => ({ furiWord: rubyForWord(e.word, e.reading), word: e.word, reading: e.reading, gloss: e.gloss })),
  }));
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
  const card = KANJI_CARDS[char] as KanjiCard | undefined;
  // 意味: 母語(l1) > カードの簡潔意味(glossShort) > 同梱の全義。詳細(glossFull)は下に小さく併記。
  const meaning = (l1 && l1 !== 'en' ? meaningIn(char, l1) : undefined) ?? card?.glossShort ?? info?.meaning;
  const meaningFull = card?.glossFull ?? info?.meaning;
  const readings = useMemo(() => cardReadingLines(char), [char]);

  useEffect(() => { Audio.setAudioModeAsync({ playsInSilentModeIOS: true }).catch(() => {}); }, []);
  const playExample = (word: string, reading: string) => {
    const id = word ? vocabIdForWord(word, reading) : null;
    if (id) playVocab(id).then((ok) => { if (!ok && reading) Speech.speak(reading, { language: 'ja-JP' }); });
    else if (reading) Speech.speak(reading, { language: 'ja-JP' });
  };

  // 1読み=1行: [音/訓][読み][意味] ＋ 例語(語全体ルビ＋再生)。
  const readingRow = (r: RdLine, i: number) => (
    <View style={s.readRow} key={i}>
      <View style={s.readHead}>
        <Text style={s.readTag}>{r.type === 'on' ? '音' : '訓'}</Text>
        <Text style={s.readLabel}>{r.label}</Text>
        {readingAboveUserLevel(r.level, settings.level) && <Text style={s.readLevelBadge}>{r.level}</Text>}
        <Text style={s.readGloss} numberOfLines={2}>{r.gloss}</Text>
      </View>
      <View style={s.readExamples}>
        {r.examples.map((e, j) => (
          <View key={j} style={s.readPair}>
            <Pressable style={s.exPlay} hitSlop={8} onPress={() => playExample(e.word, e.reading)}>
              <Ionicons name="play" size={16} color={c.mute} />
            </Pressable>
            <View style={s.rubyWord}>
              <RubyText text={e.furiWord} style={s.readWord} rubyStyle={s.readRuby} />
            </View>
            {!!e.gloss && <Text style={s.exGloss} numberOfLines={1}>{e.gloss}</Text>}
          </View>
        ))}
      </View>
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
        {!!meaningFull && meaningFull !== meaning && <Text style={s.meaningEn}>{meaningFull}</Text>}
        {typeof info?.strokes === 'number' && (
          <Text style={s.strokes}>{t('kanjiDetail.strokes', { n: info.strokes })}</Text>
        )}

        {readings.length ? (
          <View style={s.readingsBox}>
            {readings.map((r, i) => readingRow(r, i))}
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
    gap: spacing.md,
  },
  // 1読み=1ブロック: 見出し行(音/訓・読み・意味)＋例語行。
  readRow: { alignSelf: 'stretch', gap: 4 },
  readHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  readTag: { fontSize: ty.small, fontWeight: '800', color: c.mute, marginRight: 6 },
  readLabel: { fontSize: ty.body, color: c.ink2, fontWeight: '800', marginRight: 6 },
  // レベル超えの読み(自分のレベルより上)に付く小さなバッジ。応用読みだと一目で分かる。
  readLevelBadge: { fontSize: 10, fontWeight: '800', color: c.mute, backgroundColor: c.bgSoft, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, overflow: 'hidden', marginRight: spacing.sm },
  readGloss: { fontSize: ty.small, color: c.mute, flexShrink: 1 },
  // 例語は縦に積む(各行: ▷ 語(ルビ) 英訳)。英訳を併記して読みやすく。
  readExamples: { paddingLeft: spacing.md, gap: spacing.xs, marginTop: 2 },
  readPair: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  exGloss: { fontSize: ty.small, color: c.mute, flexShrink: 1, marginBottom: 1 },
  rubyWord: { alignItems: 'center' },
  readWord: { fontSize: ty.body, color: c.ink },
  readRuby: { fontSize: 10, lineHeight: 12, color: c.faint, textAlign: 'center' },
  exPlay: { paddingLeft: 6, paddingVertical: 2, alignSelf: 'center' },
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
