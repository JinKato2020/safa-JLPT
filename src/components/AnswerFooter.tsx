// 全ドリル共通の「回答フッター」。下端固定バー: 左=正誤(正解/ざんねん・色)＋任意の答えヒント / 右=次へボタン。
// 単語タブ・試験タブのすべての問題後UIをこれ1本に統一(見た目・文言・挙動を揃える)。i18n=answer.*(全10言語)。
// 呼び出し側は「回答済みのときだけ」マウントする(correct に正誤を渡す)。nextKind で次へ/結果/終わる を切替。
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useT } from '../i18n';

export type NextKind = 'next' | 'result' | 'finish';

export default function AnswerFooter({ correct, onNext, nextKind = 'next', answerHint }: {
  correct?: boolean;      // 正誤(true=正解)。省略時は正誤を出さず「次へ」ボタンのみ(セット型=複数問一括の画面用)
  onNext: () => void;     // 次へ/結果へ
  nextKind?: NextKind;    // ボタン文言: next=次へ / result=結果を見る / finish=終わる
  answerHint?: string;    // 任意: 「答え ◯◯」等を正誤の下に小さく
}) {
  const c = useColors();
  const t = useT();
  const s = makeStyles(c);
  const nextLabel = nextKind === 'result' ? t('answer.result') : nextKind === 'finish' ? t('answer.finish') : t('answer.next');
  const soloBtn = correct === undefined; // 正誤なし=ボタン全幅
  return (
    <View style={s.footer}>
      {!soloBtn && (
        <View style={s.left}>
          <Text style={[s.judge, correct ? s.ok : s.ng]}>{correct ? t('answer.correct') : t('answer.wrong')}</Text>
          {!!answerHint && <Text style={s.hint} numberOfLines={1}>{answerHint}</Text>}
        </View>
      )}
      <Pressable style={[s.cta, soloBtn && s.ctaFull]} onPress={onNext} hitSlop={6}><Text style={s.ctaTxt}>{nextLabel}</Text></Pressable>
    </View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: c.line, backgroundColor: c.surface },
  left: { flex: 1, gap: 2 },
  judge: { fontSize: ty.h2, fontWeight: '800' },
  ok: { color: c.green },
  ng: { color: c.red },
  hint: { fontSize: ty.small, color: c.mute },
  cta: { backgroundColor: c.blue, borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, alignItems: 'center' },
  ctaFull: { flex: 1 },
  ctaTxt: { color: '#fff', fontSize: ty.h2, fontWeight: '800' },
});
