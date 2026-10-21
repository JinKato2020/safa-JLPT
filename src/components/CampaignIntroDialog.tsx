// 無料キャンペーン対象地域で、初回に1回だけ出す告知ダイアログ（ハレーション防止）。
// 「いまだけ無料・将来は有料・切り替え前に必ず事前通知」を最初に明示合意してもらう。
// 端末ローカルで1回だけ（AsyncStorage）。キャンペーンが有効な端末のみ表示（campaignFlag に即追従）。
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useT } from '../i18n';
import { subscribeCampaign, isCampaignProActive } from '../pro/campaignFlag';

const SEEN_KEY = 'campaign_intro_seen_v1';

export default function CampaignIntroDialog() {
  const t = useT();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const active = useSyncExternalStore(subscribeCampaign, isCampaignProActive);
  const [seen, setSeen] = useState<boolean | null>(null); // null=未判定(AsyncStorage読込中)

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(SEEN_KEY)
      .then((v) => { if (alive) setSeen(v === '1'); })
      .catch(() => { if (alive) setSeen(false); });
    return () => { alive = false; };
  }, []);

  const dismiss = () => {
    setSeen(true); // 二度と出さない（端末ローカル）
    AsyncStorage.setItem(SEEN_KEY, '1').catch(() => { /* 失敗しても体験は止めない */ });
  };

  if (!active || seen !== false) return null; // 対象地域＆未読のときだけ出す

  return (
    <View style={s.backdrop}>
      <View style={s.card}>
        <View style={s.iconWrap}><Ionicons name="gift" size={32} color={c.blue} /></View>
        <Text style={s.title}>{t('campaign.intro_title')}</Text>
        <Text style={s.body}>{t('campaign.intro_body')}</Text>
        <Pressable style={s.cta} onPress={dismiss}>
          <Text style={s.ctaTxt}>{t('campaign.intro_ok')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg, zIndex: 60 },
    card: { width: '100%', maxWidth: 380, backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: spacing.lg, alignItems: 'center', gap: spacing.sm },
    iconWrap: { width: 60, height: 60, borderRadius: 30, backgroundColor: c.blueLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
    title: { fontSize: ty.h2, fontWeight: '800', color: c.ink, textAlign: 'center' },
    body: { fontSize: ty.body, color: c.ink2, textAlign: 'center', lineHeight: 22 },
    cta: { alignSelf: 'stretch', marginTop: spacing.sm, backgroundColor: c.blue, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
    ctaTxt: { fontSize: ty.body, fontWeight: '800', color: '#fff' },
  });
