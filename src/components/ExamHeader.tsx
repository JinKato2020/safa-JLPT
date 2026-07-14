// 試験タブの全問題画面で共通の最上部ヘッダー。大問名を中央に固定表示し、UIを統一する。
//  左=閉じる(✕) / 中央=大問名 / 右=進捗など(任意)。すべての大問画面(Quiz/読解/聴解/文章の文法)で同一。
import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { spacing, type as ty, useColors, type ThemeColors } from '../theme';

export default function ExamHeader({ title, onClose, right }: { title?: string; onClose: () => void; right?: string }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={s.wrap}>
      <Pressable onPress={onClose} hitSlop={12} style={s.side}>
        <Text style={s.close}>✕</Text>
      </Pressable>
      <Text style={s.title} numberOfLines={1}>{title ?? ''}</Text>
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
    title: { flex: 1, textAlign: 'center', fontSize: ty.body, fontWeight: '800', color: c.ink },
    prog: { fontSize: ty.small, color: c.mute, fontWeight: '700' },
  });
