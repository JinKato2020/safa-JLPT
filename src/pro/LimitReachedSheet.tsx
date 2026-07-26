// 1日の上限に当たった時に出す画面。「使えない」ではなく「今日はここまで＋いま使えるもの」を見せる。
// Phase 0 では購入導線も広告導線もまだ無いので、閉じるボタンのみ。
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useT } from '../i18n';
import { FREE_SESSIONS_PER_DAY } from './dailyQuota';

export default function LimitReachedSheet({ onClose }: { onClose: () => void }) {
  const c = useColors();
  const t = useT();
  const s = styles(c);
  return (
    <SafeAreaView style={s.c}>
      <View style={s.card}>
        <Text style={s.title}>{t('limit.title')}</Text>
        <Text style={s.body}>{t('limit.body', { n: FREE_SESSIONS_PER_DAY })}</Text>
        <Text style={s.note}>{t('limit.note')}</Text>
        <Pressable style={s.btn} onPress={onClose} hitSlop={8}>
          <Text style={s.btnTxt}>{t('limit.close')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = (c: ThemeColors) => StyleSheet.create({
  c: { flex: 1, backgroundColor: c.bg, justifyContent: 'center', padding: spacing.lg },
  card: {
    backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line,
    padding: spacing.lg, gap: spacing.md,
  },
  title: { fontSize: ty.h1, fontWeight: '700', color: c.ink, textAlign: 'center' },
  body: { fontSize: ty.body, color: c.ink2, textAlign: 'center', lineHeight: 22 },
  note: { fontSize: ty.small, color: c.mute, textAlign: 'center' },
  btn: { backgroundColor: c.blue, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  btnTxt: { fontSize: ty.body, fontWeight: '700', color: '#fff' },
});
