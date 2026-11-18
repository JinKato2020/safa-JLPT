import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useColors } from '../theme';

export type StudyMenuEntry = {
  key: string;
  label: string;
  onPress: () => void;
  badge?: string;
  detail?: { text: string; color: string; accessibilityLabel: string };
};

/** 試験・練習タブで共用するコンパクトな学習メニュー。 */
export default function StudyMenuCard({ title, summary, entries }: {
  title: string;
  summary?: ReactNode;
  entries: StudyMenuEntry[];
}) {
  const c = useColors();
  const { width, fontScale } = useWindowDimensions();
  // 文字が大きい設定では1列にして、翻訳を省略せずに表示する。
  const columns = width >= 300 && fontScale <= 1.35 ? 2 : 1;
  const rows: StudyMenuEntry[][] = [];
  for (let i = 0; i < entries.length; i += columns) {
    rows.push(entries.slice(i, i + columns));
  }

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={[styles.title, { color: c.ink }]}>{title}</Text>
        {summary}
      </View>
      {rows.map((row) => (
        <View key={row[0].key} style={styles.row}>
          {row.map((entry) => (
            <Pressable
              key={entry.key}
              testID={`study-menu-${entry.key}`}
              accessibilityRole="button"
              accessibilityLabel={[entry.label, entry.badge, entry.detail?.accessibilityLabel].filter(Boolean).join(' · ')}
              onPress={entry.onPress}
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: entry.badge ? c.blueLight : c.bgSoft, borderColor: entry.badge ? c.blue : c.line },
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.copy}>
                {entry.badge && <Text style={[styles.badge, { color: c.blueDark }]}>✦ {entry.badge}</Text>}
                <Text style={[styles.label, { color: c.ink2 }]}>{entry.label}</Text>
              </View>
              {entry.detail ? (
                <Text style={[styles.detail, { color: entry.detail.color }]}>{entry.detail.text}</Text>
              ) : (
                <Text style={[styles.chevron, { color: c.mute }]}>›</Text>
              )}
            </Pressable>
          ))}
          {columns === 2 && row.length === 1 && <View style={styles.spacer} />}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 1, padding: 8, gap: 5 },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 6, minHeight: 32, paddingHorizontal: 4 },
  title: { flexShrink: 1, fontSize: 16, fontWeight: '800' },
  row: { flexDirection: 'row', gap: 5 },
  button: {
    flex: 1, minWidth: 0, minHeight: 48, flexDirection: 'row', alignItems: 'center',
    gap: 4, borderRadius: 9, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 4,
  },
  copy: { flex: 1, minWidth: 0 },
  label: { fontSize: 13, fontWeight: '700' },
  badge: { fontSize: 10, fontWeight: '800' },
  detail: { flexShrink: 0, fontSize: 11, fontWeight: '800', fontVariant: ['tabular-nums'] },
  chevron: { fontSize: 18, fontWeight: '700' },
  pressed: { opacity: 0.7 },
  spacer: { flex: 1 },
});
