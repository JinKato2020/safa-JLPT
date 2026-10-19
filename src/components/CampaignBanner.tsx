// 地域キャンペーン（完全Pro無料）の周知バナー。campaign が有効な端末だけ表示。
// 「いま無料・将来有料・事前通知」を明示＝有料化時のトラブル(裏切り/低評価)を防ぐ。
// campaignFlag は端末ローカルの外部ストア＝useSyncExternalStore でフラグ変化に即追従。
import { useSyncExternalStore } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useT } from '../i18n';
import { subscribeCampaign, isCampaignProActive } from '../pro/campaignFlag';

export default function CampaignBanner() {
  const active = useSyncExternalStore(subscribeCampaign, isCampaignProActive);
  const c = useColors();
  const s = makeStyles(c);
  const t = useT();
  if (!active) return null;
  return (
    <View style={s.wrap}>
      <Ionicons name="gift-outline" size={18} color={c.blue} style={s.icon} />
      <View style={s.txt}>
        <Text style={s.title}>{t('campaign.free_title')}</Text>
        <Text style={s.note}>{t('campaign.free_note')}</Text>
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: c.blueLight, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm },
  icon: { marginTop: 2 },
  txt: { flex: 1 },
  title: { fontSize: ty.body, fontWeight: '800', color: c.ink, marginBottom: 2 },
  note: { fontSize: ty.small, color: c.mute, lineHeight: 18 },
});
