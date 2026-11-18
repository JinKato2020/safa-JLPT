import { Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStudyColors } from './StudyPresentation';

export default function StudyAudioButton({ label, onPress, playing = false, disabled = false, study = true }: {
  label: string; onPress: () => void; playing?: boolean; disabled?: boolean; study?: boolean;
}) {
  const c = useStudyColors(study);
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled}
    onPress={onPress} style={({ pressed }) => [styles.button, { backgroundColor: c.blue, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 }]}>
    <Ionicons name={playing ? 'volume-high' : 'play'} size={22} color="#fff" />
    <Text style={styles.label}>{label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { minHeight: 54, borderRadius: 12, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  label: { color: '#fff', fontSize: 16, fontWeight: '700', flexShrink: 1, textAlign: 'center' },
});
