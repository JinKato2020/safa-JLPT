// 書斎タブの学習モードが解禁された時の「おめでとう」演出。全体カバー率がしきい値に達すると1度だけ表示。
// 解禁モード専用の縦長立ち絵(桜)を全面に出し、その中央(桜の上)に「◯◯ 解禁」を重ねる。
import { useEffect, useRef } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, Image, Animated, type ImageSourcePropType } from 'react-native';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useT } from '../i18n';
import type { UnlockKey } from '../store/unlocks';

// 解禁モード→専用画像(全体カバー率 5/10/15/20% の立ち絵)。
const IMG: Record<UnlockKey, ImageSourcePropType> = {
  listening: require('../../assets/afterstudy/unlock_listening.jpg'),
  kakitori_kanji: require('../../assets/afterstudy/unlock_kakitori.jpg'),
  vproduce: require('../../assets/afterstudy/unlock_vproduce.jpg'),
  gbuild: require('../../assets/afterstudy/unlock_gbuild.jpg'),
};

export default function UnlockCelebration({ visible, unlockKey, modeLabel, need, onClose }: {
  visible: boolean; unlockKey: UnlockKey | null; modeLabel: string; need: number; onClose: () => void;
}) {
  const c = useColors();
  const t = useT();
  const s = makeStyles(c);
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) { anim.setValue(0); Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 6, tension: 70 }).start(); }
  }, [visible, anim]);
  const img = unlockKey ? IMG[unlockKey] : null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Animated.View style={[s.card, { transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }]}>
          {/* 立ち絵(桜)は上寄せ表示。絵に描かれた上部のモード名を必ず残し、はみ出す下側だけ切る。「◯◯解禁」は画像に重ねず下のテキストへ。 */}
          <View style={s.hero}>
            {img ? <Image source={img} style={s.img} resizeMode="cover" /> : null}
          </View>
          <Text style={s.reached}>{t('unlock.reached', { pct: String(need) })}</Text>
          <Text style={s.unlockLine}>{t('unlock.mode_unlocked', { mode: modeLabel })}</Text>
          <Text style={s.praise}>{t('unlock.praise')}</Text>
          <Pressable style={s.cta} onPress={onClose}><Text style={s.ctaTxt}>{t('unlock.ok')}</Text></Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.72)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: { width: '100%', maxWidth: 340, backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: spacing.md, alignItems: 'center', gap: spacing.sm },
  // 枠は従来サイズ(760/1000)。絵(素材=760×1350)を「上寄せ」で置き、はみ出す下側だけ切る=上部の描き文字(モード名)を必ず残す。
  //  img.height='135%'(=1350/1000)で枠より縦に長くし top:0 で上端そろえ。幅100%×高さ135%=素材と同比のため cover でも拡大されない。
  hero: { width: '100%', aspectRatio: 760 / 1000, borderRadius: radius.md, overflow: 'hidden', backgroundColor: c.bgSoft },
  img: { position: 'absolute', top: 0, left: 0, width: '100%', height: '135%' },
  reached: { fontSize: ty.body, fontWeight: '900', color: c.green, marginTop: 2 },
  unlockLine: { fontSize: ty.h1, fontWeight: '900', color: c.amber, textAlign: 'center' },
  praise: { fontSize: ty.small, color: c.mute, textAlign: 'center' },
  cta: { alignSelf: 'stretch', backgroundColor: c.blue, borderRadius: radius.md, paddingVertical: spacing.sm + 2, alignItems: 'center', marginTop: 2 },
  ctaTxt: { color: '#fff', fontSize: ty.body, fontWeight: '800' },
});
