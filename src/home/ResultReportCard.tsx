// 合格/不合格の自己申告フロー(§4=解約が最も起きる瞬間を物語で受け止める)。ホームのスワイプシート内に出す。
//  ・受験日を過ぎたら「受験おつかれさま／結果を教えてね」＋ 受かった/だめだった の2択。
//  ・選ぶ → buildResultReport で桜の一言＋(合格なら)色紙を壁へ1枚。桜貝は付けない(reward:0=嘘の旨味を作らない)。
//  ・合格=「叶ったね」→ 願いの書き換えを勧める(設定で)。不合格=慰めない・願いにだけ触れる・壁に残さない。
//  ・報告したら examDate を空にして「解決済み」に(=このカードは二度と催促しない)。手習い帳/貝殻/課金には一切触れない。
//  ・花吹雪など「消える演出」はP1(要素材)。ここは一言＋証＋次の門まで。
import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState, useAppActions } from '../store/store';
import { dayStr } from '../store/state';
import { buildResultReport, hasPassShikishi, resultHint, type Outcome, type ResultReport } from '../story/resultReport';
import { ShikishiCard } from './ShikishiWall';

function dayNo(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

export default function ResultReportCard() {
  const state = useAppState();
  const { reportResult, setSettings } = useAppActions();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const [report, setReport] = useState<ResultReport | null>(null);

  const today = dayStr(Date.now());
  const examDate = state.settings.examDate;
  const isJft = (state.settings.targetExam ?? 'jlpt') === 'jft';
  const level = state.settings.level;
  // 出す条件: JLPT・試験日が過去・この級の合格色紙がまだ無い。報告するとexamDateを空にするので再催促しない。
  const due = !isJft && !!examDate && examDate < today && !hasPassShikishi(state, level);
  if (!due && !report) return null;

  const onReport = (outcome: Outcome) => {
    const rep = buildResultReport({ level, outcome, date: today, wish: state.settings.wish, seed: dayNo(today) });
    reportResult(level, outcome, today); // 合格のみ色紙を壁へ(級ごと一度)。不合格は状態不変。
    setSettings({ examDate: null });      // 受験は解決済み=このカードは次回から出ない
    setReport(rep);
  };

  // 報告後: 桜の一言＋(合格なら)色紙＋願い書き換えの誘い＋次の門。
  if (report) {
    const g = report.nextGate;
    return (
      <View style={s.card}>
        <Text style={s.voice}>{report.voice.text}</Text>
        {report.shikishi && (
          <View style={s.shikishiRow}>
            <ShikishiCard item={report.shikishi} />
          </View>
        )}
        {report.suggestRewish && (
          <Text style={s.hint}>願いは変わってもいい。設定でいつでも書き換えられるよ。</Text>
        )}
        <Text style={s.gate}>
          {g.kind === 'advance' ? `次は ${g.level} の門` : `また ${g.level} の門をくぐろう`}
        </Text>
      </View>
    );
  }

  // 未報告: 受験おつかれさま＋2択。
  return (
    <View style={s.card}>
      <Text style={s.title}>受験おつかれさま</Text>
      <Text style={s.voice}>{resultHint(dayNo(today)).text}</Text>
      <View style={s.btnRow}>
        <Pressable style={[s.btn, s.btnPass]} onPress={() => onReport('pass')}>
          <Text style={s.btnPassTxt}>受かった</Text>
        </Pressable>
        <Pressable style={[s.btn, s.btnFail]} onPress={() => onReport('fail')}>
          <Text style={s.btnFailTxt}>だめだった</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: spacing.md, gap: spacing.sm },
    title: { fontSize: ty.small, fontWeight: '800', color: c.ink2 },
    voice: { fontSize: ty.body, fontWeight: '700', color: c.ink, lineHeight: 24 },
    hint: { fontSize: ty.small, color: c.mute, lineHeight: 20 },
    gate: { fontSize: ty.small, fontWeight: '800', color: c.blue },
    shikishiRow: { flexDirection: 'row', justifyContent: 'center', paddingVertical: spacing.xs },
    btnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
    btn: { flex: 1, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: 'center' },
    btnPass: { backgroundColor: c.blue },
    btnPassTxt: { color: '#ffffff', fontSize: ty.body, fontWeight: '800' },
    btnFail: { backgroundColor: c.bgSoft, borderWidth: 1, borderColor: c.line },
    btnFailTxt: { color: c.ink2, fontSize: ty.body, fontWeight: '700' },
  });
