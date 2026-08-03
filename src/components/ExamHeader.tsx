// 試験タブの全問題画面で共通の最上部ヘッダー。大問名を中央に固定表示し、UIを統一する。
//  左=閉じる(✕) / 中央=大問名 / 右=進捗など(任意)。すべての大問画面(Quiz/読解/聴解/文章の文法)で同一。
import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { spacing, type as ty, useColors, type ThemeColors } from '../theme';

// sub=問題ID(kb-… / vid#daimon 等)。大問名と進捗(分数)の間に小さく出す=バグ報告時にどの問題か一意に特定できる。
export default function ExamHeader({ title, onClose, right, sub }: { title?: string; onClose: () => void; right?: string; sub?: string }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={s.wrap}>
      <Pressable onPress={onClose} hitSlop={12} style={s.side}>
        <Text style={s.close}>✕</Text>
      </Pressable>
      <View style={s.center}>
        <Text style={s.title} numberOfLines={1}>{title ?? ''}</Text>
        {sub ? <Text style={s.sub} numberOfLines={1}>{sub}</Text> : null}
      </View>
      <View style={[s.side, s.right]}>
        <Text style={s.prog}>{right ?? ''}</Text>
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    wrap: { flexDirection: 'row', alignItems: 'center', paddingBottom: spacing.sm },
    side: { minWidth: 48, justifyContent: 'center' },
    right: { alignItems: 'flex-end' },
    close: { fontSize: ty.h2, color: c.mute },
    center: { flex: 1, alignItems: 'center' },
    title: { alignSelf: 'stretch', textAlign: 'center', fontSize: ty.body, fontWeight: '800', color: c.ink },
    // 問題ID(バグ特定用)。大問名の直下・進捗の手前に小さく等幅寄りで出す。
    sub: { textAlign: 'center', fontSize: ty.tiny, color: c.faint, fontWeight: '700', marginTop: 1 },
    prog: { fontSize: ty.small, color: c.mute, fontWeight: '700' },
  });
