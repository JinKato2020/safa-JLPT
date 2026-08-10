// 書斎タブの学習モードが解禁された時の「おめでとう」演出。カバー率がしきい値に達すると1度だけ表示。
// 努力をねぎらい成長実感を出す(桜の巫女イラスト＋見出し＋解禁モード名)。画像は当面ご褒美絵を流用(差替可)。
import { useEffect, useRef } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, Image, Animated } from 'react-native';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useT } from '../i18n';

const REWARD_IMG = require('../../assets/afterstudy/reward_day.jpg');

export default function UnlockCelebration({ visible, modeLabel, need, onClose }: {
  visible: boolean; modeLabel: string; need: number; onClose: () => void;
}) {
  const c = useColors();
  const t = useT();
  const s = makeStyles(c);
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) { anim.setValue(0); Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 6, tension: 70 }).start(); }
  }, [visible, anim]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Animated.View style={[s.card, { transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }]}>
          <Text style={s.kicker}>{t('unlock.kicker')}</Text>
          <Text style={s.pct}>{t('unlock.reached', { pct: String(need) })}</Text>
          <Image source={REWARD_IMG} style={s.img} resizeMode="cover" />
          <Text style={s.modeName}>{modeLabel}</Text>
          <Text style={s.unlocked}>{t('unlock.unlocked')}</Text>
          <Text style={s.praise}>{t('unlock.praise')}</Text>
          <Pressable style={s.cta} onPress={onClose}><Text style={s.ctaTxt}>{t('unlock.ok')}</Text></Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.66)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: { width: '100%', maxWidth: 360, backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: spacing.lg, alignItems: 'center', gap: 6 },
  kicker: { fontSize: ty.small, fontWeight: '800', color: c.amber, letterSpacing: 2 },
  pct: { fontSize: ty.h2, fontWeight: '900', color: c.ink },
  img: { width: '100%', aspectRatio: 1.5, borderRadius: radius.md, marginVertical: spacing.sm },
  modeName: { fontSize: ty.h1, fontWeight: '900', color: c.blue, textAlign: 'center' },
  unlocked: { fontSize: ty.body, fontWeight: '800', color: c.green },
  praise: { fontSize: ty.small, color: c.mute, textAlign: 'center', marginTop: 2 },
  cta: { alignSelf: 'stretch', backgroundColor: c.blue, borderRadius: radius.md, paddingVertical: spacing.sm + 2, alignItems: 'center', marginTop: spacing.sm },
  ctaTxt: { color: '#fff', fontSize: ty.body, fontWeight: '800' },
});
