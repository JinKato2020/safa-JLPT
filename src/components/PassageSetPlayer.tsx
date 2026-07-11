// 1文章＋全設問を一括提示→各問回答(正誤は出さない)→全問回答で一括採点(色付け)＋quizAnswer記録→「次へ」待機。
// 読解・文章の文法・模試で共用。ルビは同級以上のみ(rubyNeeded)。解説なし。pointIdある問は＋my単語帳。
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import RubyText from './RubyText';
import { rubyNeeded } from '../data';
import { useAppState, useAppActions } from '../store/store';
import { shuffleChoices } from '../quiz/quiz';
import { type PassageSet } from '../quiz/passageSet';
import passageTransNe from '../data/exam/passageTransNe.json';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useT } from '../i18n';

// 本文のネパール語訳(回答後トグル表示・l1=ne時のみ)。key=PassageSet.id → 本文ごとの訳配列。
const TRANS_NE = passageTransNe as Record<string, string[]>;

export default function PassageSetPlayer({ set, isLast, onNext, onGraded }: { set: PassageSet; isLast: boolean; onNext: () => void; onGraded?: (results: { id: string; correct: boolean }[]) => void }) {
  const state = useAppState();
  const { quizAnswer, addToMyList } = useAppActions();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const t = useT();
  const rubyGate = (run: string) => rubyNeeded(run, state.settings.level);

  // 選択肢は問ごとに一度だけシャッフルして固定（sh.answerIndex＝シャッフル後の正解位置）。
  const qs = useMemo(() => set.questions.map((q) => ({ q, sh: shuffleChoices(q.choices, q.answerIndex) })), [set.id]);
  const [answers, setAnswers] = useState<(number | null)[]>(() => set.questions.map(() => null));
  const [correctness, setCorrectness] = useState<boolean[]>(() => set.questions.map(() => false)); // pick時に確定
  const [recorded, setRecorded] = useState(false);
  const [showTrans, setShowTrans] = useState(false);
  const revealed = answers.every((a) => a !== null);
  const trans = state.settings.l1 === 'ne' ? TRANS_NE[set.id] : undefined; // 本文ごとのネパール語訳(無ければundefined)

  // 全問回答した瞬間に、各設問の正誤を1回だけ記録（冪等）。呼び出し元(模試等)が採点集計したい場合は onGraded も同時に1回だけ発火。
  useEffect(() => {
    if (revealed && !recorded) {
      set.questions.forEach((q, i) => quizAnswer(q.id, correctness[i]));
      onGraded?.(set.questions.map((q, i) => ({ id: q.id, correct: correctness[i] })));
      setRecorded(true);
    }
  }, [revealed, recorded]);

  const pick = (qi: number, choiceIdx: number) => {
    if (answers[qi] !== null) return;
    const ok = choiceIdx === qs[qi].sh.answerIndex;
    setCorrectness((cs) => { const n = [...cs]; n[qi] = ok; return n; });
    setAnswers((a) => { const n = [...a]; n[qi] = choiceIdx; return n; });
  };

  const isSaved = (pointId?: string) => !!pointId && (state.myList ?? []).some((r) => r.type === 'grammar' && r.id === pointId);

  return (
    <ScrollView contentContainerStyle={s.body}>
      {set.passages.map((p, pi) => (
        <View key={pi} style={s.passageCard}>
          {p.format ? <Text style={s.fmtTag}>{p.format}</Text> : null}
          {p.title ? <RubyText text={p.title} style={s.passageTitle} rubyStyle={s.rubyS} rubyGate={rubyGate} /> : null}
          <View style={s.passageBodyWrap}>
            {p.body.split('\n').map((line, i) => (line ? <RubyText key={i} text={line} style={s.passageBody} rubyStyle={s.rubyS} rubyGate={rubyGate} /> : <View key={i} style={s.blankLine} />))}
          </View>
          {revealed && showTrans && trans?.[pi] ? <Text style={s.transTxt}>{trans[pi]}</Text> : null}
        </View>
      ))}

      {revealed && trans ? (
        <Pressable style={s.transBtn} onPress={() => setShowTrans((v) => !v)}>
          <Text style={s.transBtnTxt}>{showTrans ? t('passage.hideTrans') : t('passage.showTrans')}</Text>
        </Pressable>
      ) : null}

      {set.questions.map((q, qi) => {
        const picked = answers[qi];
        return (
          <View key={q.id} style={s.qBlock}>
            <Text style={s.qLabel}>{q.blankNo != null ? t('passage.blankLabel', { n: q.blankNo }) : t('passage.qLabel', { n: qi + 1 })}</Text>
            {q.q ? <RubyText text={q.q} style={s.qText} rubyStyle={s.rubyS} rubyGate={rubyGate} /> : null}
            <View style={s.choices}>
              {qs[qi].sh.choices.map((ch, ci) => {
                const isAns = ci === qs[qi].sh.answerIndex;
                const isPicked = ci === picked;
                return (
                  <Pressable key={ci} style={[s.choice, revealed && isAns && s.choiceOk, revealed && isPicked && !isAns && s.choiceNg, !revealed && isPicked && s.choicePicked]} onPress={() => pick(qi, ci)} disabled={revealed}>
                    <View style={s.choiceTxtWrap}><RubyText text={ch} style={s.choiceTxt} rubyStyle={s.rubyS} rubyGate={rubyGate} /></View>
                    {revealed && isAns ? <Text style={s.mark}>✓</Text> : null}
                  </Pressable>
                );
              })}
            </View>
            {revealed && q.pointId ? (
              <Pressable style={s.saveBtn} onPress={() => addToMyList({ type: 'grammar', id: q.pointId! })}>
                <Text style={s.saveTxt}>{isSaved(q.pointId) ? t('mywords.added') : t('mywords.add')}</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}

      {revealed ? (
        <Pressable style={s.nextBtn} onPress={onNext}><Text style={s.nextTxt}>{isLast ? t('passage.toResult') : t('passage.next')}</Text></Pressable>
      ) : (
        <Text style={s.hint}>{t('passage.hint')}</Text>
      )}
    </ScrollView>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.md },
  passageCard: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: spacing.md, gap: spacing.xs },
  fmtTag: { fontSize: ty.tiny, fontWeight: '800', color: c.mute, letterSpacing: 1 },
  passageTitle: { fontSize: ty.h2, fontWeight: '800', color: c.ink },
  passageBodyWrap: { gap: 2 },
  passageBody: { fontSize: ty.body, color: c.ink2, lineHeight: 26 },
  blankLine: { height: spacing.sm },
  rubyS: { fontSize: 10, color: c.mute },
  transTxt: { fontSize: ty.small, color: c.ink2, lineHeight: 22, marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: c.line },
  transBtn: { alignSelf: 'flex-start', backgroundColor: c.bgSoft, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, paddingVertical: 6, paddingHorizontal: spacing.md, marginTop: -spacing.xs },
  transBtnTxt: { fontSize: ty.small, fontWeight: '700', color: c.blueDark },
  qBlock: { gap: spacing.sm },
  qLabel: { fontSize: ty.small, fontWeight: '800', color: c.blueDark },
  qText: { fontSize: ty.body, color: c.ink },
  choices: { gap: spacing.sm },
  choice: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.bgSoft, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md },
  choicePicked: { borderColor: c.blue, backgroundColor: c.blueLight },
  choiceOk: { borderColor: c.green, backgroundColor: c.okBg },
  choiceNg: { borderColor: c.red, backgroundColor: c.ngBg },
  choiceTxtWrap: { flex: 1 },
  choiceTxt: { fontSize: ty.body, color: c.ink2 },
  mark: { fontSize: ty.body, color: c.green, fontWeight: '800' },
  saveBtn: { alignSelf: 'flex-start', backgroundColor: c.blueLight, borderRadius: radius.md, paddingVertical: 6, paddingHorizontal: spacing.md },
  saveTxt: { fontSize: ty.small, fontWeight: '700', color: c.blueDark },
  nextBtn: { backgroundColor: c.blue, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  nextTxt: { color: '#ffffff', fontSize: ty.body, fontWeight: '800' },
  hint: { fontSize: ty.tiny, color: c.faint, textAlign: 'center' },
});
