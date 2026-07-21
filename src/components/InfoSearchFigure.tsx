// 情報検索(joho)の図表主体プレイヤー。N5/N4/N3 共通。画像を使わず軽量な figure データ(表1枚以上＋※注記)を
// ネイティブ描画し、選択肢タップで即採点→解説→「次へ」。全テキストは RubyText＋レベルゲート(同級以上のみルビ)。
import { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import RubyText from './RubyText';
import { type Figure } from '../quiz/passageSet';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useT } from '../i18n';

type Props = {
  level: 'N5' | 'N4' | 'N3';
  title: string;
  situation: string;
  figure?: Figure;
  question: string;
  choices: string[];
  answer: number; // 正解の choices index
  explain: string;
  rubyGate: (run: string) => boolean;
  isLast: boolean;
  onGraded: (correct: boolean) => void; // 初回の選択で1回だけ発火
  onNext: () => void;
};

export function InfoSearchFigure(props: Props) {
  const { title, situation, figure, question, choices, answer, explain, rubyGate, isLast, onGraded, onNext } = props;
  const c = useColors();
  const s = makeStyles(c);
  const t = useT();
  const [picked, setPicked] = useState<number | null>(null);
  const revealed = picked !== null;

  const pick = (idx: number) => {
    if (revealed) return; // 一度選んだら固定(単問なので即採点)
    setPicked(idx);
    onGraded(idx === answer);
  };

  return (
    <ScrollView contentContainerStyle={s.body}>
      {/* 図版見出し */}
      {title ? <RubyText text={title} style={s.title} rubyStyle={s.ruby} rubyGate={rubyGate} /> : null}

      {/* 状況(誰が・何を・条件) */}
      {situation ? (
        <View style={s.situationWrap}>
          {situation.split('\n').map((line, i) => (line
            ? <RubyText key={i} text={line} style={s.situation} rubyStyle={s.ruby} rubyGate={rubyGate} />
            : <View key={i} style={s.gap} />))}
        </View>
      ) : null}

      {/* 図表カード */}
      <View style={s.figureCard}>
        {figure?.intro ? <RubyText text={figure.intro} style={s.intro} rubyStyle={s.ruby} rubyGate={rubyGate} /> : null}

        {(figure?.tables ?? []).map((tbl, ti) => (
          <View key={ti} style={s.tableWrap}>
            {tbl.caption ? <RubyText text={tbl.caption} style={s.caption} rubyStyle={s.ruby} rubyGate={rubyGate} /> : null}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tableScroll}>
              <View style={s.table}>
                {/* ヘッダ行 */}
                <View style={[s.row, s.headRow]}>
                  {tbl.columns.map((col, ci) => (
                    <View key={ci} style={[s.cell, ci === 0 && s.firstCol]}>
                      <RubyText text={col} style={s.headText} rubyStyle={s.rubyOnDark} rubyGate={rubyGate} center />
                    </View>
                  ))}
                </View>
                {/* データ行 */}
                {tbl.rows.map((row, ri) => (
                  <View key={ri} style={[s.row, ri % 2 === 1 && s.rowAlt]}>
                    {row.map((val, ci) => (
                      <View key={ci} style={[s.cell, ci === 0 && s.firstCol]}>
                        <RubyText text={val} style={ci === 0 ? s.cellHeadText : s.cellText} rubyStyle={s.ruby} rubyGate={rubyGate} center />
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        ))}

        {/* ※注記(追加条件) */}
        {(figure?.notes ?? []).length > 0 ? (
          <View style={s.notes}>
            {figure!.notes!.map((n, ni) => (
              <RubyText key={ni} text={n} style={s.noteText} rubyStyle={s.ruby} rubyGate={rubyGate} />
            ))}
          </View>
        ) : null}
      </View>

      {/* 問い */}
      {question ? <RubyText text={question} style={s.question} rubyStyle={s.ruby} rubyGate={rubyGate} /> : null}

      {/* 選択肢 */}
      <View style={s.choices}>
        {choices.map((ch, idx) => {
          const isAns = idx === answer;
          const isPicked = idx === picked;
          return (
            <Pressable
              key={idx}
              style={[s.choice, revealed && isAns && s.choiceOk, revealed && isPicked && !isAns && s.choiceNg]}
              onPress={() => pick(idx)}
              disabled={revealed}
            >
              <Text style={s.choiceNum}>{idx + 1}</Text>
              <View style={s.choiceTxtWrap}><RubyText text={ch} style={s.choiceTxt} rubyStyle={s.ruby} rubyGate={rubyGate} /></View>
              {revealed && isAns ? <Text style={s.mark}>✓</Text> : null}
            </Pressable>
          );
        })}
      </View>

      {/* 解説＋次へ */}
      {revealed ? (
        <>
          {explain ? (
            <View style={s.explainCard}>
              {explain.split('\n').map((line, i) => (line
                ? <RubyText key={i} text={line} style={s.explainText} rubyStyle={s.ruby} rubyGate={rubyGate} />
                : <View key={i} style={s.gap} />))}
            </View>
          ) : null}
          <Pressable style={s.nextBtn} onPress={onNext}>
            <Text style={s.nextTxt}>{isLast ? t('passage.toResult') : t('passage.next')}</Text>
          </Pressable>
        </>
      ) : (
        <Text style={s.hint}>{t('passage.hint')}</Text>
      )}
    </ScrollView>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.md },
  title: { fontSize: ty.h2, fontWeight: '800', color: c.ink },
  ruby: { fontSize: 10, color: c.mute },
  rubyOnDark: { fontSize: 10, color: '#ffffff' },
  situationWrap: { gap: 2 },
  situation: { fontSize: ty.body, color: c.ink2, lineHeight: 26 },
  gap: { height: spacing.sm },
  figureCard: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: spacing.md, gap: spacing.sm },
  intro: { fontSize: ty.small, fontWeight: '700', color: c.blueDark },
  tableWrap: { gap: spacing.xs },
  caption: { fontSize: ty.small, fontWeight: '800', color: c.ink },
  tableScroll: { minWidth: '100%' },
  table: { borderWidth: 1, borderColor: c.line, borderRadius: radius.md, overflow: 'hidden', minWidth: '100%' },
  row: { flexDirection: 'row' },
  headRow: { backgroundColor: c.blue },
  rowAlt: { backgroundColor: c.bgSoft },
  cell: { minWidth: 74, flex: 1, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: c.line, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line, justifyContent: 'center' },
  firstCol: { minWidth: 90 },
  headText: { fontSize: ty.small, fontWeight: '800', color: '#ffffff' },
  cellText: { fontSize: ty.small, color: c.ink2 },
  cellHeadText: { fontSize: ty.small, fontWeight: '700', color: c.ink },
  notes: { gap: 2, marginTop: spacing.xs },
  noteText: { fontSize: ty.small, color: c.ink2, lineHeight: 22 },
  question: { fontSize: ty.body, fontWeight: '700', color: c.ink, marginTop: spacing.xs },
  choices: { gap: spacing.sm },
  choice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: c.bgSoft, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md },
  choiceOk: { borderColor: c.green, backgroundColor: c.okBg },
  choiceNg: { borderColor: c.red, backgroundColor: c.ngBg },
  choiceNum: { fontSize: ty.body, fontWeight: '800', color: c.mute, width: 18, textAlign: 'center' },
  choiceTxtWrap: { flex: 1 },
  choiceTxt: { fontSize: ty.body, color: c.ink2 },
  mark: { fontSize: ty.body, color: c.green, fontWeight: '800' },
  explainCard: { backgroundColor: c.bgSoft, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, padding: spacing.md, gap: 2 },
  explainText: { fontSize: ty.small, color: c.ink2, lineHeight: 24 },
  nextBtn: { backgroundColor: c.blue, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  nextTxt: { color: '#ffffff', fontSize: ty.body, fontWeight: '800' },
  hint: { fontSize: ty.tiny, color: c.faint, textAlign: 'center' },
});
