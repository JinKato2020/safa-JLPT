// 1文章＋全設問を一括提示→各問回答(正誤は出さない)→全問回答で一括採点(色付け)＋quizAnswer記録→「次へ」待機。
// 読解・文章の文法・模試で共用。ルビは同級以上のみ(rubyNeeded)。解説なし。pointIdある問は＋my単語帳。
// テーブル型(情報検索)は別コンポーネントにルーティング。
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RubyText from './RubyText';
import { InfoSearchFigure } from './InfoSearchFigure';
import { rubyNeeded } from '../data';
import { useAppState, useAppActions } from '../store/store';
import { shuffleChoices } from '../quiz/quiz';
import { type PassageSet, type Figure } from '../quiz/passageSet';
import { PASSAGE_TRANS_NE, PASSAGE_TRANS_EN, Q_TRANS_NE, Q_TRANS_EN } from '../data';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useT, meaningL1 } from '../i18n';
import AnswerFooter from './AnswerFooter';

// 旧・情報検索テーブル(Record<列,値>[])を figure(表1枚)へ変換する後方互換ヘルパ。新形式は figure を直接持つ。
function tableToFigure(rows: Record<string, string | number>[]): Figure {
  const columns = rows.length ? Object.keys(rows[0]) : [];
  return { tables: [{ columns, rows: rows.map((r) => columns.map((col) => String(r[col] ?? ''))) }] };
}

export default function PassageSetPlayer({ set, isLast, onNext, onGraded, mock }: { set: PassageSet; isLast: boolean; onNext: () => void; onGraded?: (results: { id: string; correct: boolean }[]) => void; mock?: boolean }) {
  const state = useAppState();
  const { quizAnswer } = useAppActions();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const t = useT();
  const rubyGate = (run: string) => rubyNeeded(run, state.settings.level);

  // 情報検索(図表主体)問題か判別。新形式は figure、旧形式は table を持つ。
  const isInfoSearch = !!set.figure || (!!set.table && set.table.length > 0);

  // 情報検索は全級 InfoSearchFigure へルーティング(N5/N4/N3 共通・画像なしの軽量図表描画)。
  if (isInfoSearch) {
    const q0 = set.questions[0];
    const fig: Figure = set.figure ?? tableToFigure(set.table!);
    return (
      <InfoSearchFigure
        level={set.level}
        title={set.passages[0]?.title ?? ''}
        situation={set.passages[0]?.body ?? ''}
        figure={fig}
        question={q0?.q ?? ''}
        choices={q0?.choices ?? []}
        answer={q0?.answerIndex ?? 0}
        explain={q0?.explain ?? ''}
        rubyGate={rubyGate}
        isLast={isLast}
        mock={mock}
        onGraded={(correct) => { if (q0) { quizAnswer(q0.id, correct); onGraded?.([{ id: q0.id, correct }]); } }}
        onNext={onNext}
      />
    );
  }

  // 選択肢は問ごとに一度だけシャッフルして固定（sh.answerIndex＝シャッフル後の正解位置）。
  const qs = useMemo(() => set.questions.map((q) => ({ q, sh: shuffleChoices(q.choices, q.answerIndex) })), [set.id]);
  const [answers, setAnswers] = useState<(number | null)[]>(() => set.questions.map(() => null));
  const [recorded, setRecorded] = useState(false);
  const [showTrans, setShowTrans] = useState(false);
  // 全問回答したら自動で答え合わせ(採点)。それまでは各問いつでも選び直せる。
  const revealed = answers.length > 0 && answers.every((a) => a !== null);
  // 模試中は正誤・解説・訳を出さない(採点記録はする)。最後に「解答・解説」でまとめて表示。
  const showFeedback = revealed && !mock;
  const useNe = meaningL1(state.settings) === 'ne'; // ne母語=ネパール語訳／それ以外(ja UI/en/他言語)=英語訳
  const trans = useNe ? PASSAGE_TRANS_NE[set.id] : PASSAGE_TRANS_EN[set.id]; // 本文ごとの訳(無ければundefined)
  const qtr = useNe ? Q_TRANS_NE : Q_TRANS_EN; // 設問・選択肢の訳(内容理解のみ・key=設問id)
  const hasTrans = !!trans || set.questions.some((q) => qtr[q.id]); // 訳トグルを出すか

  // 全問回答した瞬間に一括採点＝各設問の正誤を1回だけ記録（冪等）。呼び出し元(模試等)の集計も同時に1回だけ発火。
  useEffect(() => {
    if (revealed && !recorded) {
      const results = qs.map((x, i) => answers[i] === x.sh.answerIndex);
      set.questions.forEach((q, i) => quizAnswer(q.id, results[i]));
      onGraded?.(set.questions.map((q, i) => ({ id: q.id, correct: results[i] })));
      setRecorded(true);
    }
  }, [revealed, recorded]);

  // 採点(全問回答)前はいつでも選び直せる（間違いに後から気付いた時のため／再タップで別の選択肢に変更）。採点後は変更不可。
  const pick = (qi: number, choiceIdx: number) => {
    if (revealed) return;
    setAnswers((a) => { const n = [...a]; n[qi] = choiceIdx; return n; });
  };

  return (
    <ScrollView contentContainerStyle={s.body}>
      {set.passages.map((p, pi) => (
        <View key={pi} style={s.passageCard}>
          {p.format ? <Text style={s.fmtTag}>{p.format}</Text> : null}
          {p.title ? <RubyText text={p.title} style={s.passageTitle} rubyStyle={s.rubyS} rubyGate={rubyGate} /> : null}
          <View style={s.passageBodyWrap}>
            {p.body.split('\n').map((line, i) => (line ? <RubyText key={i} text={line} style={s.passageBody} rubyStyle={s.rubyS} rubyGate={rubyGate} /> : <View key={i} style={s.blankLine} />))}
          </View>
          {showFeedback && showTrans && trans?.[pi] ? <Text style={s.transTxt}>{trans[pi]}</Text> : null}
        </View>
      ))}

      {showFeedback && hasTrans ? (
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
            {showFeedback && showTrans && qtr[q.id]?.q ? <Text style={s.qTrans}>{qtr[q.id]!.q}</Text> : null}
            <View style={s.choices}>
              {qs[qi].sh.choices.map((ch, ci) => {
                const isAns = ci === qs[qi].sh.answerIndex;
                const isPicked = ci === picked;
                const ctr = showFeedback && showTrans ? qtr[q.id]?.choices[qs[qi].q.choices.indexOf(ch)] : undefined;
                return (
                  <Pressable key={ci} style={[s.choice, showFeedback && isAns && s.choiceOk, showFeedback && isPicked && !isAns && s.choiceNg, !showFeedback && isPicked && s.choicePicked]} onPress={() => pick(qi, ci)} disabled={revealed}>
                    <View style={s.choiceTxtWrap}>
                      <RubyText text={ch} style={s.choiceTxt} rubyStyle={s.rubyS} rubyGate={rubyGate} />
                      {ctr ? <Text style={s.choiceTrans}>{ctr}</Text> : null}
                    </View>
                    {showFeedback && isAns ? <Text style={s.mark}>✓</Text> : null}
                  </Pressable>
                );
              })}
            </View>
            {showFeedback && q.explain ? (
              <View style={s.explainBox}>
                <Text style={s.explainLabel}>{t('passage.explainLabel')}</Text>
                <Text style={s.explainTxt}>{q.explain}</Text>
              </View>
            ) : null}
            {/* 解説は難所(指示語・理由)のみ。それ以外は本文/設問/選択肢の母語・英語訳で理解を助ける。 */}
          </View>
        );
      })}

      {revealed ? (
        <AnswerFooter onNext={onNext} nextKind={isLast ? 'result' : 'next'} />
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
  qTrans: { fontSize: ty.small, color: c.ink2, lineHeight: 20, marginTop: 4 },
  choiceTrans: { fontSize: ty.small, color: c.ink2, marginTop: 3 },
  explainBox: { marginTop: spacing.sm, padding: spacing.sm, backgroundColor: c.bgSoft, borderRadius: radius.md, borderLeftWidth: 3, borderLeftColor: c.blue },
  explainLabel: { fontSize: ty.small, fontWeight: '700', color: c.blueDark, marginBottom: 2 },
  explainTxt: { fontSize: ty.small, color: c.ink, lineHeight: 21 },
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
  saveBtn: { alignSelf: 'flex-start', width: 40, height: 40, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, backgroundColor: c.bgSoft, alignItems: 'center', justifyContent: 'center' },
  nextBtn: { backgroundColor: c.blue, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  nextTxt: { color: '#ffffff', fontSize: ty.body, fontWeight: '800' },
  hint: { fontSize: ty.tiny, color: c.faint, textAlign: 'center' },
});
