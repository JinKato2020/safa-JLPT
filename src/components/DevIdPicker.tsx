// 【開発専用】問題IDの一覧から任意の問題へジャンプするためのモーダル。
// ExamHeader の問題IDをタップすると開く。__DEV__ の画面だけが描画する(製品版には出さない)。
// ids = 同じ大問(小区分)の全問ID。currentId = 今表示中。onPick(id) で画面がその問題へジャンプする。
import { useMemo, useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, TextInput, FlatList } from 'react-native';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';

export default function DevIdPicker({ visible, ids, currentId, onPick, onClose }: {
  visible: boolean; ids: string[]; currentId?: string; onPick: (id: string) => void; onClose: () => void;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const key = q.trim().toLowerCase();
    return key ? ids.filter((id) => id.toLowerCase().includes(key)) : ids;
  }, [ids, q]);
  const curPos = currentId ? ids.indexOf(currentId) : -1;
  const initialIndex = curPos >= 0 ? curPos : 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        {/* 内側タップはモーダルを閉じない */}
        <Pressable style={s.sheet} onPress={() => undefined}>
          <View style={s.head}>
            <Text style={s.title}>問題を選ぶ（開発）</Text>
            <Pressable onPress={onClose} hitSlop={12}><Text style={s.close}>✕</Text></Pressable>
          </View>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="IDで絞り込み（例 0004）"
            placeholderTextColor={c.faint}
            style={s.input}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={s.count}>{filtered.length} / {ids.length} 問</Text>
          <FlatList
            data={filtered}
            keyExtractor={(id) => id}
            style={s.list}
            initialNumToRender={40}
            keyboardShouldPersistTaps="handled"
            // 現在位置あたりから見えるように(絞り込み時は先頭)
            initialScrollIndex={q ? 0 : Math.min(initialIndex, Math.max(0, filtered.length - 1))}
            getItemLayout={(_, index) => ({ length: ROW_H, offset: ROW_H * index, index })}
            onScrollToIndexFailed={() => undefined}
            renderItem={({ item }) => {
              const cur = item === currentId;
              return (
                <Pressable style={[s.row, cur && s.rowCur]} onPress={() => onPick(item)}>
                  <Text style={[s.rowTxt, cur && s.rowTxtCur]} numberOfLines={1}>
                    {item}{cur ? '  ← 今ここ' : ''}
                  </Text>
                </Pressable>
              );
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const ROW_H = 44;
const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: spacing.lg },
    sheet: { backgroundColor: c.bg, borderRadius: radius.lg, maxHeight: '80%', padding: spacing.md, borderWidth: 1, borderColor: c.line },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
    title: { fontSize: ty.body, fontWeight: '800', color: c.ink },
    close: { fontSize: ty.h2, color: c.mute },
    input: { borderWidth: 1, borderColor: c.line, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: c.ink, fontSize: ty.body, backgroundColor: c.bgSoft },
    count: { fontSize: ty.tiny, color: c.faint, fontWeight: '700', marginTop: spacing.xs, marginBottom: spacing.xs },
    list: { flexGrow: 0 },
    row: { height: ROW_H, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.md },
    rowCur: { backgroundColor: c.blueLight },
    rowTxt: { fontSize: ty.body, color: c.ink2, fontWeight: '700' },
    rowTxtCur: { color: c.blueDark, fontWeight: '800' },
  });
