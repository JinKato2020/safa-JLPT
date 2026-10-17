// 文字語彙(漢字+語彙)。連続学習→連続テストの共通フロー(LearnTestSession)で実施。
// 学習フェーズ=語/漢字＋読み＋意味＋例文を続けて提示(採点なし)。テスト=客観4択・自動採点(重み3)。
import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState } from '../store/store';
import { meaningL1, useT } from '../i18n';
import { itemsFor, allWordsFor, VOCAB, KANJI, GRAMMAR, cardFaceReadings, VOCAB_EXAMPLE, VOCAB_FURIGANA, meaningIn, exampleIn, rubyNeeded } from '../data';
import { effectiveP } from '../engine/engine';

const REVIEW_SIZE = 10; // my単語帳の「復習する」= 苦手優先で10問に絞る

const hiraToKata = (s: string): string => s.replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));
import type { StudyItem } from '../data';
import type { RootStackParamList } from '../navigation/types';
import LearnTestSession from '../components/LearnTestSession';
import RubyText from '../components/RubyText';
import { useSessionGate } from '../pro/useSessionGate';
import LimitReachedSheet from '../pro/LimitReachedSheet';

function VocabKanjiCard({ item }: { item: StudyItem }) {
  const c = useColors();
  const t = useT();
  const s = useMemo(() => cardStyles(c), [c]);
  const { settings } = useAppState();
  const l1 = meaningL1(settings); // 母語コード(日本語UIは英語を既定)
  // レベル適応ルビ: ユーザーのレベル以上(同レベル含む)の漢字群にだけ読みを振る。
  const rubyGate = (run: string) => rubyNeeded(run, settings.level);
  // 母語(l1)の意味があれば主表示、英語は補助。無ければ英語を主表示。
  const key = item.type === 'kanji' ? item.char : item.id;
  const native = l1 && l1 !== 'en' ? meaningIn(key, l1) : undefined;
  if (item.type === 'kanji') {
    // 主要な音訓＋例語(KANJI_CARDS=正データ・読みごとにlevel付き)。カード表面はレベル適応で絞る:
    // 自分のレベル以下の読みだけ提示し、レベル超えの読みは辞書の詳細でのみ見せる(ふりがな原則の読み版)。
    const rows = cardFaceReadings(item.char, settings.level).map((r) => {
      const ex = r.examples[0];
      return { on: r.type === 'on', reading: r.reading, word: ex?.word ?? '', wordReading: ex?.reading ?? '' };
    });
    return (
      <View style={s.card}>
        <Text style={s.kanji}>{item.char}</Text>
        <Text style={s.meaning}>{native ?? item.meaning}</Text>
        {native ? <Text style={s.meaningEn}>{item.meaning}</Text> : null}
        {rows.map((r, i) => (
          <View key={i} style={s.exRow}>
            <Text style={s.readTag}>{t(r.on ? 'browse.tag_on' : 'browse.tag_kun')} {r.on ? hiraToKata(r.reading) : r.reading}　</Text>
            <View style={s.rubyWord}>
              <Text style={s.exRuby} numberOfLines={1}>{rubyGate(r.word) ? r.wordReading : ' '}</Text>
              <Text style={s.ex}>{r.word}</Text>
            </View>
          </View>
        ))}
      </View>
    );
  }
  if (item.type === 'vocab') {
    const ex = VOCAB_EXAMPLE[item.id];
    const nex = l1 && l1 !== 'en' ? exampleIn(item.id, l1) : undefined; // 例文の母語訳
    return (
      <View style={s.card}>
        <Text style={s.word}>{item.word}</Text>
        <Text style={s.reading}>{item.reading}</Text>
        <Text style={s.meaning}>{native ?? item.meaning}</Text>
        {native ? <Text style={s.meaningEn}>{item.meaning}</Text> : null}
        {ex ? (
          <>
            <RubyText text={VOCAB_FURIGANA[item.id] ?? ex.ja} target={item.word} style={s.ex} hitStyle={s.exHit} rubyStyle={s.exRuby} rubyGate={rubyGate} center />
            {nex ? <Text style={s.exNe}>{nex}</Text> : ex.en ? <Text style={s.exEn}>{ex.en}</Text> : null}
          </>
        ) : null}
      </View>
    );
  }
  if (item.type === 'grammar') {
    // 文法の学習カード=文法点＋意味＋例文(かなルビは括弧表記なので剥がして素の文を提示)。
    const exPlain = item.exampleJa ? item.exampleJa.replace(/[（(][^）)]*[）)]/g, '') : '';
    return (
      <View style={s.card}>
        <Text style={s.word}>{item.point}</Text>
        <Text style={s.meaning}>{native ?? item.meaning}</Text>
        {native ? <Text style={s.meaningEn}>{item.meaning}</Text> : null}
        {exPlain ? <Text style={s.ex}>{exPlain}</Text> : null}
      </View>
    );
  }
  return null;
}

export default function FlashcardScreen() {
  const nav = useNavigation();
  // 1日の回数ゲート(共通)。GATING_ENABLED=false の間は素通りする。
  const gate = useSessionGate();
  const [gateAllowed, setGateAllowed] = useState<boolean | null>(null);
  useEffect(() => { setGateAllowed(gate.begin()); }, []); // 画面に入った時に1回だけ
  const state = useAppState();
  const { settings } = state;
  const route = useRoute<RouteProp<RootStackParamList, 'Flashcard'>>();
  const ids = route.params?.ids; // my単語帳の「復習する」= 保存済みの語彙＋漢字を復習(未指定時=従来のSRSキュー)
  // 誤答プール=語彙+漢字(moji_goi)に加え文法(bunpou)も含める。文法itemの誤答が他の文法点の意味から引けるように。
  const pool = useMemo(() => [...allWordsFor(settings.level, 'moji_goi'), ...allWordsFor(settings.level, 'bunpou')], [settings.level]);
  // idsが渡された時は、レベルに関係なくその語/漢字id群を対象にする(buildQueueのdue/fresh絞り込みを迂回)。
  // 出題順=苦手優先: 記憶度(effectiveP)が低い順に並べ、上位REVIEW_SIZE(10)問だけ復習する。
  // 未学習(SRS状態なし)は0扱い=最優先。同点は保存順を維持(安定ソート)。
  const overrideBatch = useMemo(() => {
    if (!ids || !ids.length) return undefined;
    const byId = new Map<string, StudyItem>();
    for (const v of VOCAB) byId.set(v.id, v);
    for (const k of KANJI) byId.set(k.id, k);
    for (const g of GRAMMAR) byId.set(g.id, g); // 私の単語帳に保存した文法も復習対象に含める
    const items = ids.map((id) => byId.get(id)).filter((x): x is StudyItem => Boolean(x));
    if (!items.length) return undefined;
    const now = Date.now();
    const weakness = (it: StudyItem) => { const st = state.items[it.id]; return st ? effectiveP(st, now) : 0; };
    return [...items].sort((a, b) => weakness(a) - weakness(b)).slice(0, REVIEW_SIZE);
  }, [ids, state.items]);
  if (gateAllowed === null) return null;
  if (!gateAllowed) return <LimitReachedSheet onClose={() => nav.goBack()} />;

  return <LearnTestSession pool={pool} size={12} overrideBatch={overrideBatch} review={!!ids?.length} renderLearnCard={(item) => <VocabKanjiCard item={item} />} />;
}

const cardStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.line,
      paddingVertical: spacing.xl,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      gap: spacing.xs,
    },
    kanji: { fontSize: 88, fontWeight: '800', color: c.ink, lineHeight: 96 },
    word: { fontSize: 40, fontWeight: '800', color: c.ink, textAlign: 'center' },
    reading: { fontSize: ty.body, color: c.mute, fontWeight: '700' },
    readTag: { fontWeight: '800', color: c.blueDark },
    meaning: { fontSize: ty.body, color: c.ink2, marginTop: spacing.xs, textAlign: 'center' },
    meaningEn: { fontSize: ty.tiny, color: c.faint, marginTop: 2, textAlign: 'center' },
    ex: { fontSize: ty.body, color: c.ink, textAlign: 'center', lineHeight: 24 },
    exHit: { textDecorationLine: 'underline' },
    exRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'center', marginTop: spacing.sm },
    rubyWord: { alignItems: 'center' },
    exRuby: { fontSize: 9, lineHeight: 11, color: c.mute, textAlign: 'center' },
    exEn: { fontSize: ty.tiny, color: c.faint, fontStyle: 'italic', textAlign: 'center' },
    exNe: { fontSize: ty.small, color: c.mute, textAlign: 'center', marginTop: 2 },
  });
