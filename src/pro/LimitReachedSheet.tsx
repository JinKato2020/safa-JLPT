// 1日の上限に当たった時に出す画面。「使えない」ではなく「今日はここまで＋いま使えるもの」を見せる。
// 無料ユーザーには「広告を見て、あと1回ふやす」導線(1日2本まで)と、Proへの導線(無制限)を出す。
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useT } from '../i18n';
import type { RootStackParamList } from '../navigation/types';
import { useAppState, useAppActions } from '../store/store';
import { quotaFor, FREE_SESSIONS_PER_DAY } from './dailyQuota';
import { showRewardedAd } from './ads';

export default function LimitReachedSheet({ onClose }: { onClose: () => void }) {
  const c = useColors();
  const t = useT();
  const s = styles(c);
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const state = useAppState();
  const { grantAdBonus } = useAppActions();
  const [busy, setBusy] = useState(false);
  const quota = quotaFor(state, Date.now());

  async function onWatchAd() {
    if (busy) return;
    setBusy(true);
    const earned = await showRewardedAd();
    setBusy(false);
    if (earned) {
      grantAdBonus(); // 今日の回数を+1(1日2本まで)。もう一度「はじめる」で使える。
      Alert.alert(t('limit.ad_earned'), undefined, [{ text: t('limit.close'), onPress: onClose }]);
    } else {
      Alert.alert(t('limit.ad_failed'));
    }
  }

  return (
    <SafeAreaView style={s.c}>
      <View style={s.card}>
        <Text style={s.title}>{t('limit.title')}</Text>
        <Text style={s.body}>{t('limit.body', { n: FREE_SESSIONS_PER_DAY })}</Text>
        <Text style={s.note}>{t('limit.note')}</Text>
        {/* 広告を見て+1回(残り0かつ 今日の広告枠が残っている無料ユーザーだけ) */}
        {quota.canWatchAd && (
          <Pressable style={[s.ad, busy && s.adBusy]} onPress={onWatchAd} disabled={busy} hitSlop={8}>
            <Text style={s.adTxt}>{busy ? t('limit.ad_loading') : t('limit.watch_ad')}</Text>
          </Pressable>
        )}
        {/* Proへの導線(無制限) */}
        <Pressable style={s.upgrade} onPress={() => { onClose(); nav.navigate('Paywall'); }} hitSlop={8}>
          <Text style={s.upgradeTxt}>{t('limit.upgrade')}</Text>
        </Pressable>
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
  ad: { backgroundColor: c.blueLight, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  adBusy: { opacity: 0.6 },
  adTxt: { fontSize: ty.body, fontWeight: '700', color: c.blueDark },
  upgrade: { backgroundColor: c.blue, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  upgradeTxt: { fontSize: ty.body, fontWeight: '700', color: '#fff' },
  btn: { paddingVertical: spacing.md, alignItems: 'center' },
  btnTxt: { fontSize: ty.body, color: c.mute },
});
