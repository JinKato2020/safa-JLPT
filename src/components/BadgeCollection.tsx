// バッジコレクション閲覧モーダル: 10段のバッジを一覧。取得済み=カラー / 未取得=グレー(デザインだけ確認)。
// 大リング(pass)・カバー率(cover)の両方から同じUIで開く。収集意欲を促す。
import { Modal, View, Text, Image, Pressable, ScrollView, StyleSheet } from 'react-native';
import { BADGE_IMAGES, badgeTierIndex, type BadgeSet, type BadgeMetric } from '../data/badges';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useT } from '../i18n';

// 段位称号のi18nキー(0-9)。cover=学習称号 / pass=合格称号(natural時は花の精称号)。
function titleKey(metric: BadgeMetric, set: BadgeSet, i: number): string {
  if (metric === 'cover') return 'home.coverTier' + i;
  return (set === 'natural' ? 'home.natPassTitle' : 'home.passTitle') + i;
}

export default function BadgeCollection({ visible, onClose, set, metric, pct }: {
  visible: boolean;
  onClose: () => void;
  set: BadgeSet;
  metric: BadgeMetric;
  pct: number | null;
}) {
  const c = useColors();
  const t = useT();
  const s = makeStyles(c);
  const images = BADGE_IMAGES[set][metric];
  const currentTier = pct === null ? -1 : badgeTierIndex(pct); // -1=まだ何も取得していない
  const doneCount = currentTier + 1;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={s.head}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{t('badges.collection_title')}</Text>
              <Text style={s.sub}>{t('badges.collection_sub', { done: doneCount })}</Text>
            </View>
            <Pressable hitSlop={10} onPress={onClose} style={s.closeBtn}>
              <Text style={s.closeTxt}>✕</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={s.grid}>
            {images.map((src, i) => {
              const unlocked = i <= currentTier;
              return (
                <View key={i} style={[s.cell, unlocked ? s.cellOn : s.cellOff]}>
                  <Image source={src} style={[s.badgeImg, !unlocked && s.badgeLocked]} />
                  <Text style={[s.tierTitle, !unlocked && s.tierTitleLocked]} numberOfLines={1}>
                    {t(titleKey(metric, set, i))}
                  </Text>
                  <Text style={[s.tierNo, !unlocked && s.tierNoLocked]}>Lv{i + 1}</Text>
                </View>
              );
            })}
          </ScrollView>
          <Text style={s.foot}>{t('badges.collection_hint')}</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  sheet: { width: '100%', maxWidth: 440, maxHeight: '86%', backgroundColor: c.bg, borderRadius: radius.xl, padding: spacing.lg },
  head: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md },
  title: { fontSize: ty.h2, fontWeight: '800', color: c.ink },
  sub: { fontSize: ty.small, color: c.mute, marginTop: 2, fontWeight: '700' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bgSoft },
  closeTxt: { fontSize: 16, color: c.ink2, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.sm },
  cell: { width: '30%', alignItems: 'center', borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: 2, marginBottom: spacing.xs },
  cellOn: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.line },
  cellOff: { backgroundColor: c.bgSoft, borderWidth: 1, borderColor: c.bgSoft },
  badgeImg: { width: 66, height: 66, resizeMode: 'contain' },
  badgeLocked: { opacity: 0.22 }, // 未取得=グレー(RNはネイティブgrayscale不可のためdimで表現・デザインは視認可)
  tierTitle: { fontSize: 10, fontWeight: '800', color: c.ink2, marginTop: 3, textAlign: 'center' },
  tierTitleLocked: { color: c.faint },
  tierNo: { fontSize: 9, fontWeight: '700', color: c.blue, marginTop: 1 },
  tierNoLocked: { color: c.trace },
  foot: { fontSize: ty.tiny, color: c.faint, textAlign: 'center', marginTop: spacing.md, lineHeight: 15 },
});
