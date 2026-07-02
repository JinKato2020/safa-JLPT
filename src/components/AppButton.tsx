// 洗練された共通ボタン。primary(塗り)/secondary(薄色)/ghost(枠)の3種。
// 押下で少し沈む(scale)＋影が弱まるタクタイルな反応。角丸pill・柔らかい影で今風に。
import { Pressable, Text, StyleSheet, View, type ViewStyle } from 'react-native';
import { spacing, radius, type as ty, shadow, useColors, type ThemeColors } from '../theme';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'md' | 'lg';

export default function AppButton({
  label, onPress, variant = 'primary', size = 'lg', icon, disabled, full = true, style,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  icon?: string;
  disabled?: boolean;
  full?: boolean;
  style?: ViewStyle;
}) {
  const c = useColors();
  const s = makeStyles(c);
  const pad = size === 'lg' ? { paddingVertical: spacing.md + 2, paddingHorizontal: spacing.xl }
                           : { paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.lg };
  const base: ViewStyle[] = [s.base, pad, full && s.full, style as ViewStyle].filter(Boolean) as ViewStyle[];
  const variantStyle = variant === 'primary' ? s.primary : variant === 'secondary' ? s.secondary : s.ghost;
  const txt = variant === 'primary' ? s.txtPrimary : variant === 'ghost' ? s.txtGhost : s.txtSecondary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        ...base,
        variantStyle,
        variant !== 'ghost' && shadow(pressed ? 1 : 2),
        pressed && s.pressed,
        disabled && s.disabled,
      ]}
    >
      <View style={s.row}>
        {icon ? <Text style={[txt, s.icon]}>{icon}</Text> : null}
        <Text style={[txt, s.label, size === 'lg' && s.labelLg]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    base: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
    full: { alignSelf: 'stretch' },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    primary: { backgroundColor: c.blue },
    secondary: { backgroundColor: c.blueLight },
    ghost: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: c.line },
    pressed: { transform: [{ scale: 0.97 }], opacity: 0.95 },
    disabled: { opacity: 0.45 },
    label: { fontSize: ty.body, fontWeight: '800', letterSpacing: 0.3 },
    labelLg: { fontSize: ty.h2 },
    icon: { fontSize: ty.h2, fontWeight: '800' },
    txtPrimary: { color: '#ffffff' },
    txtSecondary: { color: c.blueDark },
    txtGhost: { color: c.ink2 },
  });
