// 汎用の軽量プルダウン(インライン展開・自己完結スタイル)。押すと直下に選択肢を開き、選ぶと閉じる。
// レベル選択などの単純な単一選択に使う。透明Modalに頼らず通常フローで展開するので確実に表示される。
import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { spacing, radius, type as ty, shadow, useColors, type ThemeColors } from '../theme';

export default function Dropdown<T extends string>({ value, options, labelFor, onSelect }: {
  value: T;
  options: readonly T[];
  labelFor: (v: T) => string;
  onSelect: (v: T) => void;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const [open, setOpen] = useState(false);
  return (
    <View style={s.wrap}>
      <Pressable style={({ pressed }) => [s.trigger, pressed && s.pressed]} onPress={() => setOpen((o) => !o)}>
        <Text style={s.triggerTxt}>{labelFor(value)}</Text>
        <Text style={s.caret}>{open ? '▲' : '▼'}</Text>
      </Pressable>
      {open ? (
        <View style={s.menu}>
          {options.map((opt) => (
            <Pressable key={opt} style={({ pressed }) => [s.item, pressed && s.pressed]} onPress={() => { onSelect(opt); setOpen(false); }}>
              <Text style={[s.itemTxt, value === opt && s.itemTxtOn]}>{labelFor(opt)}</Text>
              {value === opt ? <Text style={s.check}>✓</Text> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  wrap: { alignSelf: 'flex-start' },
  trigger: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: c.line, borderRadius: radius.md, backgroundColor: c.surface, paddingVertical: spacing.xs + 2, paddingHorizontal: spacing.md },
  triggerTxt: { fontSize: ty.body, fontWeight: '700', color: c.ink },
  caret: { fontSize: 10, color: c.mute },
  menu: { marginTop: 4, minWidth: 130, borderWidth: 1, borderColor: c.line, borderRadius: radius.md, backgroundColor: c.surface, overflow: 'hidden', ...shadow(1) },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  itemTxt: { fontSize: ty.body, color: c.ink2, fontWeight: '600' },
  itemTxtOn: { color: c.blueDark, fontWeight: '800' },
  check: { color: c.blue, fontWeight: '800' },
  pressed: { opacity: 0.85, backgroundColor: c.bgSoft },
});
