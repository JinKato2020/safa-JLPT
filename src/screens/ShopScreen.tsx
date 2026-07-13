// ショップ(モーダル)= 桜貝で着せ替え購入。カテゴリタブ＋商品グリッド＋残高。段階1: 購入/装備の機能実装。
import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState, useAppActions } from '../store/store';
import { walletPoints, isOwned, isEquipped, canBuy } from '../store/wallet';
import { SHOP, type ShopItem } from '../data/shop';
import type { ShopKind } from '../store/wallet';
import { useT } from '../i18n';

const CATS: { kind: ShopKind; labelKey: string }[] = [
  { kind: 'frame', labelKey: 'shop.cat_frame' },
  { kind: 'outfit', labelKey: 'shop.cat_outfit' },
  { kind: 'petal', labelKey: 'shop.cat_petal' },
  { kind: 'theme', labelKey: 'shop.cat_theme' },
  { kind: 'badge', labelKey: 'shop.cat_badge' },
];

export default function ShopScreen() {
  const nav = useNavigation();
  const c = useColors();
  const t = useT();
  const s = useMemo(() => makeStyles(c), [c]);
  const state = useAppState();
  const { buyItem, equipItem } = useAppActions();
  const [cat, setCat] = useState<ShopKind>('frame');
  const items = SHOP.filter((i) => i.kind === cat);

  const act = (item: ShopItem) => {
    if (isOwned(state, item.id)) equipItem(item);
    else if (canBuy(state, item)) buyItem(item);
  };
  const statusOf = (item: ShopItem) =>
    isEquipped(state, item) ? t('shop.equipped')
      : isOwned(state, item.id) ? t('shop.equip')
        : canBuy(state, item) ? t('shop.buy')
          : t('shop.insufficient');
  const disabled = (item: ShopItem) => isEquipped(state, item) || (!isOwned(state, item.id) && !canBuy(state, item));

  return (
    <SafeAreaView style={s.c} edges={['top']}>
      <View style={s.head}>
        <Text style={s.title}>{t('shop.title')}</Text>
        <Text style={s.bal}>🐚 {walletPoints(state)}</Text>
        <Pressable onPress={() => nav.goBack()} hitSlop={12}><Text style={s.close}>×</Text></Pressable>
      </View>
      <View style={s.tabs}>
        {CATS.map((x) => (
          <Pressable key={x.kind} onPress={() => setCat(x.kind)} style={[s.tab, cat === x.kind && s.tabOn]}>
            <Text style={[s.tabTxt, cat === x.kind && s.tabTxtOn]}>{t(x.labelKey)}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView contentContainerStyle={s.grid}>
        {items.length === 0 ? <Text style={s.empty}>{t('shop.empty')}</Text> : null}
        {items.map((item) => (
          <View key={item.id} style={s.card}>
            {item.asset ? <Image source={item.asset} style={s.preview} resizeMode="contain" /> : <View style={s.previewPlaceholder}><Text style={s.emoji}>{item.emoji ?? '❔'}</Text></View>}
            <Text style={s.name} numberOfLines={1}>{t(item.nameKey)}</Text>
            <Text style={s.price}>{item.price === 0 ? t('shop.free') : `🐚 ${item.price}`}</Text>
            <Pressable disabled={disabled(item)} onPress={() => act(item)} style={[s.btn, disabled(item) && s.btnOff]}>
              <Text style={s.btnTxt}>{statusOf(item)}</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  c: { flex: 1, backgroundColor: c.bg },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { flex: 1, fontSize: ty.h1, fontWeight: '800', color: c.ink },
  bal: { fontSize: ty.body, fontWeight: '800', color: c.ink },
  close: { fontSize: 30, color: c.mute, fontWeight: '700' },
  tabs: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.sm, flexWrap: 'wrap' },
  tab: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface },
  tabOn: { backgroundColor: c.blue, borderColor: c.blue },
  tabTxt: { fontSize: ty.small, fontWeight: '800', color: c.ink2 },
  tabTxtOn: { color: '#fff' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, padding: spacing.lg },
  empty: { color: c.mute, fontSize: ty.body, padding: spacing.lg },
  card: { width: '46%', backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: spacing.md, gap: 6, alignItems: 'center' },
  preview: { width: '100%', height: 110, borderRadius: radius.md },
  previewPlaceholder: { width: '100%', height: 110, borderRadius: radius.md, backgroundColor: c.bgSoft, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 44 },
  name: { fontSize: ty.body, fontWeight: '800', color: c.ink, textAlign: 'center' },
  price: { fontSize: ty.small, fontWeight: '700', color: c.mute },
  btn: { alignSelf: 'stretch', backgroundColor: c.blue, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center' },
  btnOff: { backgroundColor: c.line },
  btnTxt: { color: '#fff', fontWeight: '800', fontSize: ty.small },
});
