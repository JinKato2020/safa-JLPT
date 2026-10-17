// 通知(モーダル) = 上部のベルから開く。現状の「通知」概念＝毎日の学習リマインドの状態表示＋受信箱(空)。
// リマインド管理は設定へ導線。将来お知らせ等が増えたらこの受信箱に並べる。
import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState } from '../store/store';
import { useT } from '../i18n';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function NotificationsScreen() {
  const nav = useNavigation<Nav>();
  const c = useColors();
  const t = useT();
  const s = useMemo(() => makeStyles(c), [c]);
  const reminder = useAppState().settings.reminder;

  return (
    <SafeAreaView style={s.c} edges={['top']}>
      <View style={s.head}>
        <Text style={s.title}>{t('notif.title')}</Text>
        <Pressable onPress={() => nav.goBack()} hitSlop={12} accessibilityLabel={t('nav.close')}>
          <Text style={s.close}>×</Text>
        </Pressable>
      </View>
      <View style={s.body}>
        {/* 学習リマインドの状態 */}
        <View style={s.card}>
          <Ionicons name="alarm-outline" size={22} color={c.blue} />
          <Text style={s.cardTxt}>{reminder ? t('notif.reminder_on', { t: reminder }) : t('notif.reminder_off')}</Text>
          <Pressable style={s.manage} hitSlop={8} onPress={() => nav.navigate('Settings')}>
            <Text style={s.manageTxt}>{t('notif.manage')}</Text>
            <Text style={s.chev}>›</Text>
          </Pressable>
        </View>
        {/* 受信箱(現状は空) */}
        <View style={s.empty}>
          <Ionicons name="notifications-off-outline" size={30} color={c.faint} />
          <Text style={s.emptyTxt}>{t('notif.empty')}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  c: { flex: 1, backgroundColor: c.bg },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { fontSize: ty.h1, fontWeight: '800', color: c.ink },
  close: { fontSize: 30, color: c.mute, fontWeight: '700', paddingHorizontal: spacing.xs },
  body: { paddingHorizontal: spacing.lg, gap: spacing.md },
  card: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: spacing.md, gap: spacing.sm, alignItems: 'flex-start' },
  cardTxt: { fontSize: ty.body, fontWeight: '700', color: c.ink },
  manage: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: spacing.xs },
  manageTxt: { fontSize: ty.small, fontWeight: '700', color: c.blue },
  chev: { fontSize: ty.body, color: c.blue, fontWeight: '700' },
  empty: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.xl * 1.5 },
  emptyTxt: { fontSize: ty.body, color: c.mute },
});
