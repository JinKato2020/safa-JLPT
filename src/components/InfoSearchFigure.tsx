// 情報検索(joho)の図表主体プレイヤー。N5/N4/N3 共通。画像を使わず軽量な figure データを
// ネイティブ描画。公式3型に対応: route=経路図 / card=ポスター表 / notice=掲示板 / table=グリッド。
// 見た目は「掲示物風」＝和紙色の紙＋画びょう＋印刷罫の表＋※お知らせ枠(2026-08-21改修)。
//   紙(figureCard=keiji)はダークでも紙色で固定＝実物の掲示に寄せる。周囲UI(設問/選択肢/解説)はテーマ追従。
// 選択肢タップで即採点→解説→「次へ」。全テキストは RubyText＋レベルゲート(同級以上のみルビ)。
import { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import RubyText from './RubyText';
import { type Figure, type FigureBlock, type FigureTable } from '../quiz/passageSet';
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
  // 紙(掲示物)の上に載るテキストはルビも紙用の濃い色にする(テーマ既定だとダークで見えなくなる)。
  const RP = (text: string, style: any, opts?: { center?: boolean; key?: number | string }) =>
    R(text, style, { ruby: s.rubyPaper, center: opts?.center, key: opts?.key });

  const pick = (idx: number) => {
    if (revealed) return; // 単問なので即採点・固定
    setPicked(idx);
    onGraded(idx === answer);
  };

  // notice(お知らせ)は ※ の点線枠で。決め手はここに埋まる＝自分で読んで気づく設計。
  const renderNotice = (b: FigureBlock, key: number) => (
    <View key={key} style={s.noticeBox}>
      {b.title ? RP(b.title, s.noticeTitle) : null}
      {(b.lines ?? []).map((ln, i) => (
        <View key={i} style={s.noticeLineRow}>
          <Text style={s.noticeBullet}>※</Text>
          <View style={s.noticeLineWrap}>{RP(ln, s.noticeLine)}</View>
        </View>
      ))}
    </View>
  );

  // 1ブロックを描画。type ごとに存在するフィールドだけ出す。notice は専用の点線枠。
  const renderBlock = (b: FigureBlock, key: number) => {
    if (b.type === 'notice' && b.lines && b.lines.length > 0) return renderNotice(b, key);
    return (
    <View key={key} style={s.block}>
      {b.source ? RP(b.source, s.blockSource) : null}
      {b.title ? RP(b.title, s.blockTitle) : null}

      {b.badges && b.badges.length > 0 ? (
        <View style={s.chipRow}>
          {b.badges.map((bd, i) => (
            <View key={i} style={s.chip}>
              {bd.label ? <Text style={s.chipLabel}>{bd.label}</Text> : null}
              {RP(bd.value, s.chipValue)}
            </View>
          ))}
        </View>
      ) : null}

      {b.steps && b.steps.length > 0 ? (
        <View style={s.steps}>
          {b.steps.map((st, i) => (
            <View key={i}>
              <View style={s.stepBox}>{RP(st, s.stepText, { center: true })}</View>
              {i < b.steps!.length - 1 ? (
                <View style={s.edge}>
                  <Text style={s.edgeArrow}>↓</Text>
                  {b.edges && b.edges[i] ? RP(b.edges[i], s.edgeLabel) : null}
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
              {RP(f.label, s.fieldLabel)}
              <View style={s.fieldValWrap}>{RP(f.value, s.fieldVal)}</View>
            </View>
          ))}
        </View>
      ) : null}

      {b.lines && b.lines.length > 0 ? (
        <View style={s.lines}>{b.lines.map((ln, i) => RP(ln, s.lineText, { key: i }))}</View>
      ) : null}

      {b.table ? renderTable(b.table, key) : null}

      {b.note ? RP(b.note, s.blockNote) : null}
    </View>
    );
  };

  const renderTable = (tblIn: FigureTable | string[][], key: number) => {
    // データが {columns, rows} でも、旧・行配列([ヘッダ行, ...データ行])でも落ちないよう正規化＋undefinedガード。
    const tbl = Array.isArray(tblIn)
      ? { caption: undefined as string | undefined, columns: (tblIn[0] ?? []) as string[], rows: tblIn.slice(1) as string[][] }
      : tblIn;
    const columns = tbl?.columns ?? [];
    const rows = tbl?.rows ?? [];
    return (
    <View key={`t${key}`} style={s.tableWrap}>
      {tbl?.caption ? RP(tbl.caption, s.caption) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={s.tableScroll}>
        <View style={s.table}>
          <View style={[s.row, s.headRow]}>
            {columns.map((col, ci) => (
              <View key={ci} style={[s.cell, ci === 0 && s.firstCol]}>{RP(col, s.headText)}</View>
            ))}
          </View>
          {rows.map((row, ri) => (
            <View key={ri} style={[s.row, ri === rows.length - 1 && s.lastRow]}>
              {(row ?? []).map((val, ci) => (
                <View key={ci} style={[s.cell, ci === 0 && s.firstCol]}>{RP(val, ci === 0 ? s.cellHeadText : s.cellText)}</View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
    );
  };

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

      {/* 掲示物(紙)本体 */}
      <View style={s.figureCard}>
        <View style={s.pinRow}><View style={s.pin} /></View>
        {figure?.header ? (
          <View style={s.banner}>
            {RP(figure.header, s.figHeader, { center: true })}
            <View style={s.bannerRule} />
          </View>
        ) : null}
        {figure?.intro ? RP(figure.intro, s.intro, { center: true }) : null}

        {blocks.length > 0
          ? blocks.map((b, i) => renderBlock(b, i))
          : legacyTables.map((tbl, i) => renderTable(tbl, i))}

        {figure?.notes && figure.notes.length > 0 ? (
          <View style={s.notes}>{figure.notes.map((n, ni) => RP(n, s.noteText, { key: ni }))}</View>
        ) : null}

        {figure?.footer ? RP(figure.footer, s.footer) : null}
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

// 掲示物(紙)の固定パレット。テーマに追従させず、ダークでも実物の掲示のように紙色を保つ。
const PAPER = '#f5efe0', PAPER2 = '#efe7d3', INK_P = '#282219', SUB_P = '#6f6553',
  FAINT_P = '#9a8d70', RULE_P = '#c8bc9e', RULE2_P = '#7a6f56', BAND_P = '#243c5a', STAMP_P = '#b0432c';

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.md },
  title: { fontSize: ty.h2, fontWeight: '800', color: c.ink },
  ruby: { fontSize: 10, color: c.mute },
  rubyPaper: { fontSize: 10, color: SUB_P },
  situationWrap: { gap: 2 },
  situation: { fontSize: ty.body, color: c.ink2, lineHeight: 26 },
  gap: { height: spacing.sm },

  // 掲示物(紙)本体＝figureCard
  figureCard: {
    backgroundColor: PAPER, borderRadius: 6, borderWidth: 1, borderColor: RULE2_P,
    paddingTop: spacing.md, paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm,
    shadowColor: '#282219', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 3,
  },
  pinRow: { alignItems: 'center', marginTop: -spacing.xs, marginBottom: spacing.xs },
  pin: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#b0432c', borderWidth: 1, borderColor: '#8f2f1e' },
  banner: { alignItems: 'center', marginBottom: 2 },
  figHeader: { fontSize: ty.body + 3, fontWeight: '800', color: INK_P, letterSpacing: 0.5, textAlign: 'center' },
  bannerRule: { width: 56, height: 3, backgroundColor: BAND_P, borderRadius: 2, marginTop: 6, marginBottom: 2 },
  intro: { fontSize: ty.small, color: SUB_P, lineHeight: 22, textAlign: 'center' },

  // ブロック(紙の上・枠なしで流す)
  block: { gap: spacing.xs },
  blockSource: { fontSize: ty.tiny, color: SUB_P, fontWeight: '700' },
  blockTitle: { fontSize: ty.small, fontWeight: '800', color: INK_P },
  blockNote: { fontSize: ty.small, color: SUB_P, lineHeight: 22, marginTop: 2 },

  // route: 要点チップ + 経路ステップ
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: BAND_P, borderRadius: radius.sm, paddingVertical: 3, paddingHorizontal: spacing.sm },
  chipLabel: { fontSize: ty.tiny, color: '#ffffff', opacity: 0.85 },
  chipValue: { fontSize: ty.small, color: '#ffffff', fontWeight: '800' },
  steps: { alignItems: 'stretch', gap: 0, marginTop: 2 },
  stepBox: { backgroundColor: PAPER2, borderWidth: 1, borderColor: RULE_P, borderRadius: radius.sm, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  stepText: { fontSize: ty.small, color: INK_P, fontWeight: '600' },
  edge: { alignItems: 'center', paddingVertical: 2 },
  edgeArrow: { fontSize: ty.small, color: SUB_P, lineHeight: 16 },
  edgeLabel: { fontSize: ty.tiny, color: SUB_P },

  // card: key:value 行
  fields: { gap: 4, marginTop: 2 },
  fieldRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  fieldLabel: { fontSize: ty.small, color: SUB_P, fontWeight: '700', width: 72 },
  fieldValWrap: { flex: 1 },
  fieldVal: { fontSize: ty.small, color: INK_P, lineHeight: 22 },

  // notice: プローズ行(旧・card等のlines用)
  lines: { gap: 3 },
  lineText: { fontSize: ty.small, color: INK_P, lineHeight: 24 },

  // 印刷物風テーブル(上下の太罫＋行間の細罫・青グリッドをやめる)
  tableWrap: { gap: spacing.xs, marginTop: 4 },
  caption: { fontSize: ty.small, fontWeight: '800', color: INK_P },
  tableScroll: { minWidth: '100%' },
  table: { borderTopWidth: 2, borderBottomWidth: 2, borderColor: RULE2_P, minWidth: '100%' },
  row: { flexDirection: 'row' },
  headRow: { backgroundColor: PAPER2 },
  lastRow: {},
  cell: { minWidth: 76, flex: 1, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: RULE_P, justifyContent: 'center' },
  firstCol: { minWidth: 92 },
  headText: { fontSize: ty.small, fontWeight: '700', color: INK_P },
  cellText: { fontSize: ty.small, color: INK_P },
  cellHeadText: { fontSize: ty.small, fontWeight: '700', color: INK_P },

  // ※お知らせ枠(点線・決め手はここ)
  noticeBox: { marginTop: spacing.sm, backgroundColor: 'rgba(122,111,86,0.07)', borderWidth: 1, borderStyle: 'dashed', borderColor: RULE2_P, borderRadius: 6, padding: spacing.sm + 2, gap: 5 },
  noticeTitle: { fontSize: ty.small, fontWeight: '800', color: BAND_P, marginBottom: 2 },
  noticeLineRow: { flexDirection: 'row', gap: 4 },
  noticeBullet: { color: STAMP_P, fontWeight: '700', fontSize: ty.small, lineHeight: 22 },
  noticeLineWrap: { flex: 1 },
  noticeLine: { fontSize: ty.small, color: INK_P, lineHeight: 22 },

  notes: { gap: 2, marginTop: spacing.xs },
  noteText: { fontSize: ty.small, color: FAINT_P, lineHeight: 22 },
  footer: { fontSize: ty.tiny, color: FAINT_P, textAlign: 'right', marginTop: spacing.xs },

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
