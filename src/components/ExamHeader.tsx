// 試験タブの全問題画面で共通の最上部ヘッダー。全大問でUIを完全統一する。
//  レイアウト(統一仕様):
//   1行目 = 大問名 ＋ 分数(現在問題 / 総問題)  ← 中央に並べる
//   2行目 = 問題ID(バグ報告時にどの問題か一意に特定できる)
//  左端に閉じる(✕)、右端は対称のための余白。すべての大問画面(Quiz/読解/聴解/文章の文法/単語ドリル)で同一。
import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { spacing, type as ty, useColors, type ThemeColors } from '../theme';

// count=分数文字列("3 / 10" 等) / id=問題ID。どちらも無い画面では省略可(存在すれば必ず同じ位置に出る)。
export default function ExamHeader({ title, count, id, onClose }: { title?: string; count?: string; id?: string; onClose: () => void }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={s.wrap}>
      <Pressable onPress={onClose} hitSlop={12} style={s.side}>
        <Text style={s.close}>✕</Text>
      </Pressable>
      <View style={s.center}>
        {/* 1行目: 大問名 + 分数。名前が長い時は名前だけ縮め、分数は必ず見える。 */}
        <View style={s.line1}>
          <Text style={s.title} numberOfLines={1}>{title ?? ''}</Text>
          {count ? <Text style={s.count}>{count}</Text> : null}
        </View>
        {/* 2行目: 問題ID。 */}
        {id ? <Text style={s.sub} numberOfLines={1}>{id}</Text> : null}
      </View>
      <View style={s.side} />
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    wrap: { flexDirection: 'row', alignItems: 'center', paddingBottom: spacing.sm },
    side: { minWidth: 48, justifyContent: 'center' },
    close: { fontSize: ty.h2, color: c.mute },
    center: { flex: 1, alignItems: 'center' },
    // 1行目=大問名+分数を横並び・中央寄せ。名前は flexShrink で縮み、分数は縮まない。
    line1: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 8, maxWidth: '100%' },
    title: { flexShrink: 1, textAlign: 'center', fontSize: ty.body, fontWeight: '800', color: c.ink },
    count: { fontSize: ty.small, fontWeight: '700', color: c.mute },
    // 問題ID(バグ特定用)。大問名の直下に小さく。
    sub: { textAlign: 'center', fontSize: ty.tiny, color: c.faint, fontWeight: '700', marginTop: 1 },
  });
