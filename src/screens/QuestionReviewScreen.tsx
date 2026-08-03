// 学習後の正誤表から開く「問題の見直し」全画面。出題時そのままの本文/台本/問題文/選択肢(正解✓・誤答✕)を表示。
// 数値ロジックには触れない(表示のみ)。StudiedQuestion(出題時スナップショット)をそのまま描く。
import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState } from '../store/store';
import { rubyNeeded } from '../data';
import RubyText from '../components/RubyText';
import type { RootStackParamList } from '../navigation/types';

const hasFuri = (x: string) => /[（(][^）)]*[）)]/.test(x);
// 台本は話者ターン(全角空白)ごとに1行(ListeningScreen と同じ整形)。
function scriptLines(sc: string): string[] {
  return sc.split('　').map((x) => x.trim()).filter(Boolean);
}

export default function QuestionReviewScreen() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const nav = useNavigation();
  const state = useAppState();
  const route = useRoute<RouteProp<RootStackParamList, 'QuestionReview'>>();
  const q = route.params.q;
  // ルビは自レベル以上の漢字だけ(学習画面と同じレベルゲート)。
  const rubyGate = (run: string) => rubyNeeded(run, state.settings.level);

  return (
    <SafeAreaView style={s.c} edges={['top', 'bottom']}>
      <View style={s.head}>
        <Text style={s.headT}>問題の見直し</Text>
        <Pressable onPress={() => nav.goBack()} hitSlop={12}><Ionicons name="close" size={24} color={c.mute} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        {/* 読解の本文 */}
        {q.passage ? (
          <View style={s.card}>
            <Text style={s.cardLabel}>本文</Text>
            <RubyText text={q.passage} style={s.passage} rubyStyle={s.ruby} rubyGate={rubyGate} />
          </View>
        ) : null}

        {/* 聴解の台本 */}
        {q.script ? (
          <View style={s.card}>
            <Text style={s.cardLabel}>{q.clipTitle ? `台本（${q.clipTitle}）` : '台本'}</Text>
            <View style={s.scriptBox}>
              {scriptLines(q.script).map((line, i) => (
                <RubyText key={i} text={line} style={s.script} rubyStyle={s.ruby} rubyGate={rubyGate} />
              ))}
            </View>
          </View>
        ) : null}

        {/* 問題文＋選択肢 */}
        <View style={s.card}>
          {q.furi ? (
            <RubyText text={q.furi} target={q.furiTarget} style={s.stem} hitStyle={s.hit} rubyStyle={s.ruby} rubyGate={rubyGate} noRubyOnHit={q.noTargetRuby} />
          ) : q.example && q.example.length ? (
            <Text style={s.stem}>{q.example.map((sg, i) => <Text key={i} style={sg.hit ? s.hit : undefined}>{sg.text}</Text>)}</Text>
          ) : q.prompt ? (
            hasFuri(q.prompt)
              ? <RubyText text={q.prompt} style={s.stem} rubyStyle={s.ruby} rubyGate={rubyGate} />
              : <Text style={s.stem}>{q.prompt}</Text>
          ) : null}
          {!!q.question ? <Text style={s.qtext}>{q.question}</Text> : null}
          <View style={s.choices}>
            {q.choices.map((ch, i) => {
              const ok = i === q.answerIndex;
              const wrong = q.picked != null && i === q.picked && !ok;
              return (
                <View key={i} style={[s.choice, ok && s.choiceOk, wrong && s.choiceNg]}>
                  <View style={[s.badge, ok && s.badgeOk, wrong && s.badgeNg]}>
                    <Text style={[s.badgeT, (ok || wrong) && s.badgeTOn]}>{ok ? '✓' : wrong ? '✕' : String(i + 1)}</Text>
                  </View>
                  {hasFuri(ch) ? (
                    <View style={{ flex: 1 }}><RubyText text={ch} style={s.choiceT} rubyStyle={s.ruby} rubyGate={rubyGate} /></View>
                  ) : (
                    <Text style={[s.choiceT, ok && s.choiceTOk]}>{ch}</Text>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* 解説 */}
        {q.explain ? (
          <View style={[s.card, s.explainCard]}>
            <Text style={s.cardLabel}>解説</Text>
            <Text style={s.explain}>{q.explain}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  c: { flex: 1, backgroundColor: c.bg },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  headT: { fontSize: ty.body, fontWeight: '800', color: c.ink },
  body: { padding: spacing.lg, paddingTop: spacing.xs, gap: spacing.sm },
  card: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs },
  cardLabel: { fontSize: 11, letterSpacing: 1.2, color: c.ink2, fontWeight: '800', marginBottom: 2 },
  passage: { fontSize: ty.body, color: c.ink, lineHeight: 26 },
  scriptBox: { gap: 3 },
  script: { fontSize: ty.body, color: c.ink2, lineHeight: 26 },
  ruby: { fontSize: 10, lineHeight: 12, color: c.mute, textAlign: 'center' },
  stem: { fontSize: ty.h2, color: c.ink, fontWeight: '700', lineHeight: 30 },
  hit: { color: c.ink, fontWeight: '800', textDecorationLine: 'underline' },
  qtext: { fontSize: ty.small, color: c.mute, fontWeight: '600', marginTop: 2 },
  choices: { gap: spacing.sm, marginTop: spacing.xs },
  choice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: c.bgSoft, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md },
  choiceOk: { borderColor: c.green, backgroundColor: c.okBg },
  choiceNg: { borderColor: c.red, backgroundColor: c.ngBg },
  badge: { width: 24, height: 24, borderRadius: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
  badgeOk: { backgroundColor: c.green, borderColor: c.green },
  badgeNg: { backgroundColor: c.red, borderColor: c.red },
  badgeT: { fontSize: 12, fontWeight: '800', color: c.mute },
  badgeTOn: { color: '#fff' },
  choiceT: { flex: 1, fontSize: ty.body, color: c.ink2, fontWeight: '600' },
  choiceTOk: { color: c.green, fontWeight: '800' },
  explainCard: { backgroundColor: c.bgSoft, borderLeftWidth: 3, borderLeftColor: c.blue },
  explain: { fontSize: ty.small, color: c.ink2, lineHeight: 20 },
});
