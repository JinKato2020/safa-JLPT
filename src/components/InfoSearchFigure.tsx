// 情報検索(joho)の図表主体プレイヤー。N5/N4/N3 共通。画像を使わず軽量な figure データを
// ネイティブ描画。公式3型に対応: route=経路図 / card=ポスター表 / notice=掲示板 / table=グリッド。
// すべて「縦カード」で描画するので、列が多い図表でも横あふれせず画面幅に収まる(枠に収まる)。
// 選択肢タップで即採点→解説→「次へ」。全テキストは RubyText＋レベルゲート(同級以上のみルビ)。
import { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import RubyText from './RubyText';
import { type Figure, type FigureBlock } from '../quiz/passageSet';
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
  const R = (text: string, style: any, opts?: { ruby?: any; center?: boolean; key?: number | string }) => (
    <RubyText key={opts?.key} text={text} style={style} rubyStyle={opts?.ruby ?? s.ruby} rubyGate={rubyGate} center={opts?.center} />
  );

  const pick = (idx: number) => {
    if (revealed) return; // 単問なので即採点・固定
    setPicked(idx);
    onGraded(idx === answer);
  };

  // 1ブロック(縦カード)を描画。type ごとに存在するフィールドだけ出す。
  const renderBlock = (b: FigureBlock, key: number) => (
    <View key={key} style={s.block}>
      {b.source ? R(b.source, s.blockSource) : null}
      {b.title ? R(b.title, s.blockTitle) : null}

      {b.badges && b.badges.length > 0 ? (
        <View style={s.chipRow}>
          {b.badges.map((bd, i) => (
            <View key={i} style={s.chip}>
              {bd.label ? <Text style={s.chipLabel}>{bd.label}</Text> : null}
              {R(bd.value, s.chipValue)}
            </View>
          ))}
        </View>
      ) : null}

      {b.steps && b.steps.length > 0 ? (
        <View style={s.steps}>
          {b.steps.map((st, i) => (
            <View key={i}>
              <View style={s.stepBox}>{R(st, s.stepText, { center: true })}</View>
              {i < b.steps!.length - 1 ? (
                <View style={s.edge}>
                  <Text style={s.edgeArrow}>↓</Text>
                  {b.edges && b.edges[i] ? R(b.edges[i], s.edgeLabel) : null}
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {b.fields && b.fields.length > 0 ? (
        <View style={s.fields}>
          {b.fields.map((f, i) => (
            <View key={i} style={s.fieldRow}>
              {R(f.label, s.fieldLabel)}
              <View style={s.fieldValWrap}>{R(f.value, s.fieldVal)}</View>
            </View>
          ))}
        </View>
      ) : null}

      {b.lines && b.lines.length > 0 ? (
        <View style={s.lines}>{b.lines.map((ln, i) => R(ln, s.lineText, { key: i }))}</View>
      ) : null}

      {b.table ? renderTable(b.table, key) : null}

      {b.note ? R(b.note, s.blockNote) : null}
    </View>
  );

  const renderTable = (tbl: { caption?: string; columns: string[]; rows: string[][] }, key: number) => (
    <View key={`t${key}`} style={s.tableWrap}>
      {tbl.caption ? R(tbl.caption, s.caption) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={s.tableScroll}>
        <View style={s.table}>
          <View style={[s.row, s.headRow]}>
            {tbl.columns.map((col, ci) => (
              <View key={ci} style={[s.cell, ci === 0 && s.firstCol]}>{R(col, s.headText, { ruby: s.rubyOnDark, center: true })}</View>
            ))}
          </View>
          {tbl.rows.map((row, ri) => (
            <View key={ri} style={[s.row, ri % 2 === 1 && s.rowAlt]}>
              {row.map((val, ci) => (
                <View key={ci} style={[s.cell, ci === 0 && s.firstCol]}>{R(val, ci === 0 ? s.cellHeadText : s.cellText, { center: true })}</View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  const blocks = figure?.blocks ?? [];
  const legacyTables = figure?.tables ?? [];

  return (
    <ScrollView contentContainerStyle={s.body}>
      {title ? R(title, s.title) : null}

      {situation ? (
        <View style={s.situationWrap}>
          {situation.split('\n').map((line, i) => (line ? R(line, s.situation, { key: i }) : <View key={i} style={s.gap} />))}
        </View>
      ) : null}

      {/* 図版カード全体 */}
      <View style={s.figureCard}>
        {figure?.header ? R(figure.header, s.figHeader, { center: true }) : null}
        {figure?.intro ? R(figure.intro, s.intro) : null}

        {blocks.length > 0
          ? blocks.map((b, i) => renderBlock(b, i))
          : legacyTables.map((tbl, i) => renderTable(tbl, i))}

        {figure?.notes && figure.notes.length > 0 ? (
          <View style={s.notes}>{figure.notes.map((n, ni) => R(n, s.noteText, { key: ni }))}</View>
        ) : null}

        {figure?.footer ? R(figure.footer, s.footer) : null}
      </View>

      {question ? R(question, s.question) : null}

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
              <View style={s.choiceTxtWrap}>{R(ch, s.choiceTxt)}</View>
              {revealed && isAns ? <Text style={s.mark}>✓</Text> : null}
            </Pressable>
          );
        })}
      </View>

      {revealed ? (
        <>
          {explain ? (
            <View style={s.explainCard}>
              {explain.split('\n').map((line, i) => (line ? R(line, s.explainText, { key: i }) : <View key={i} style={s.gap} />))}
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
  figHeader: { fontSize: ty.body, fontWeight: '800', color: c.ink, paddingBottom: spacing.xs, borderBottomWidth: 1, borderBottomColor: c.line },
  intro: { fontSize: ty.small, color: c.ink2, lineHeight: 24 },

  // 縦カード(ブロック)共通
  block: { backgroundColor: c.bgSoft, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, padding: spacing.sm + 2, gap: spacing.xs },
  blockSource: { fontSize: ty.tiny, color: c.mute, fontWeight: '700' },
  blockTitle: { fontSize: ty.small, fontWeight: '800', color: c.ink },
  blockNote: { fontSize: ty.small, color: c.blueDark, lineHeight: 22, marginTop: 2 },

  // route: 要点チップ + 経路ステップ
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.blue, borderRadius: radius.sm, paddingVertical: 3, paddingHorizontal: spacing.sm },
  chipLabel: { fontSize: ty.tiny, color: '#ffffff', opacity: 0.85 },
  chipValue: { fontSize: ty.small, color: '#ffffff', fontWeight: '800' },
  steps: { alignItems: 'stretch', gap: 0, marginTop: 2 },
  stepBox: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: radius.sm, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  stepText: { fontSize: ty.small, color: c.ink, fontWeight: '600' },
  edge: { alignItems: 'center', paddingVertical: 2 },
  edgeArrow: { fontSize: ty.small, color: c.mute, lineHeight: 16 },
  edgeLabel: { fontSize: ty.tiny, color: c.ink2 },

  // card: key:value 行
  fields: { gap: 4, marginTop: 2 },
  fieldRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  fieldLabel: { fontSize: ty.small, color: c.mute, fontWeight: '700', width: 72 },
  fieldValWrap: { flex: 1 },
  fieldVal: { fontSize: ty.small, color: c.ink2, lineHeight: 22 },

  // notice: プローズ行
  lines: { gap: 3 },
  lineText: { fontSize: ty.small, color: c.ink2, lineHeight: 24 },

  // table(グリッド・後方互換/併用)
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
  footer: { fontSize: ty.small, color: c.mute, marginTop: spacing.xs },

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
