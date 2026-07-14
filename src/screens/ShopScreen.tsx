// 桜貝ショップ(モーダル)。上=店内イラスト帯／下=アイテム。
//  背景(水彩テーマ)・フォントは「装備」で settings に反映=実際にアプリの見た目が変わる。
//  称号/枠/花びらは owned/equipped の状態管理。通貨=桜貝(wallet.points)。
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Image, ImageBackground, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAppState, useAppActions } from '../store/store';
import { walletPoints, isOwned, isEquipped, type ShopKind } from '../store/wallet';
import { SHOP, SHOP_CATS, type ShopItem } from '../data/shop';

const BANNER = require('../../assets/shop/shop_banner.png');

// 水彩テーマのプレビュー色(サムネ代わり)。
const THEME_SWATCH: Record<string, string> = { sakura: '#f2a6c0', sky: '#8fb8ea', green: '#8fc99a', fuji: '#a98fe0', akane: '#e0906f' };

export default function ShopScreen() {
  const nav = useNavigation();
  const { height } = useWindowDimensions();
  const state = useAppState();
  const { buyItem, equipItem, setSettings } = useAppActions();
  const [cat, setCat] = useState<ShopKind>('theme');
  const items = SHOP.filter((i) => i.kind === cat);

  const points = walletPoints(state);
  const ownedItem = (i: ShopItem) => i.price === 0 || isOwned(state, i.id);
  const equippedItem = (i: ShopItem): boolean => {
    if (i.apply?.theme) return state.settings.theme === i.apply.theme;
    if (i.apply?.font) return (state.settings.font ?? 'maru') === i.apply.font;
    return isEquipped(state, { id: i.id, kind: i.kind });
  };
  const canBuyItem = (i: ShopItem) => !ownedItem(i) && points >= i.price;

  const act = (i: ShopItem) => {
    if (!ownedItem(i)) { if (canBuyItem(i)) buyItem(i); return; }   // 未所持→購入
    if (equippedItem(i)) return;                                    // 装備中→何もしない
    if (i.apply) setSettings(i.apply);                              // 背景/フォント=実反映
    else equipItem({ id: i.id, kind: i.kind });                    // 称号/枠/花びら=状態
  };
  const statusOf = (i: ShopItem) =>
    equippedItem(i) ? '装備中' : ownedItem(i) ? '装備する' : canBuyItem(i) ? `🌸 ${i.price}` : '足りない';
  const disabled = (i: ShopItem) => equippedItem(i) || (!ownedItem(i) && !canBuyItem(i));
  const pill = (i: ShopItem) => (equippedItem(i) ? s.pillOn : ownedItem(i) ? s.pillOwn : canBuyItem(i) ? s.pillBuy : s.pillNo);
  const pillTxt = (i: ShopItem) => (equippedItem(i) ? s.txtOn : ownedItem(i) ? s.txtOwn : canBuyItem(i) ? s.txtBuy : s.txtNo);

  const bannerH = Math.max(280, Math.round(height * 0.40));

  return (
    <View style={s.c}>
      <ImageBackground source={BANNER} style={{ height: bannerH }} resizeMode="cover">
        <SafeAreaView edges={['top']}>
          <View style={s.top}>
            <View style={s.bal}><Text style={s.balIco}>🌸</Text><Text style={s.balN}>{points.toLocaleString()}</Text><Text style={s.balL}>貝殻ポイント</Text></View>
            <Pressable onPress={() => nav.goBack()} hitSlop={12} style={s.x}><Text style={s.xTxt}>×</Text></Pressable>
          </View>
        </SafeAreaView>
      </ImageBackground>

      <View style={s.panel}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
          {SHOP_CATS.map((x) => (
            <Pressable key={x.kind} onPress={() => setCat(x.kind)} style={[s.tab, cat === x.kind && s.tabOn]}>
              <Text style={[s.tabTxt, cat === x.kind && s.tabTxtOn]}>{x.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <ScrollView contentContainerStyle={s.grid} showsVerticalScrollIndicator={false}>
          {items.map((i) => (
            <View key={i.id} style={s.card}>
              {i.asset ? (
                <Image source={i.asset} style={s.prev} resizeMode="cover" />
              ) : i.apply?.theme ? (
                <View style={[s.prev, { backgroundColor: THEME_SWATCH[i.apply.theme] ?? '#eee' }]} />
              ) : (
                <View style={[s.prev, s.prevEmoji]}><Text style={s.emoji}>{i.emoji ?? '❔'}</Text></View>
              )}
              <Text style={s.name} numberOfLines={1}>{i.name}</Text>
              <Pressable disabled={disabled(i)} onPress={() => act(i)} style={[s.btn, pill(i)]}>
                <Text style={[s.btnTxt, pillTxt(i)]}>{statusOf(i)}</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const CREAM = '#f5ead6';
const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: CREAM },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 8 },
  bal: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(255,250,240,0.95)', borderWidth: 1, borderColor: 'rgba(180,140,80,0.5)', borderRadius: 999, paddingVertical: 7, paddingHorizontal: 13 },
  balIco: { fontSize: 15 }, balN: { fontWeight: '900', color: '#7a4a1e', fontSize: 16, fontVariant: ['tabular-nums'] }, balL: { fontSize: 10, color: '#9a6a3a', fontWeight: '700' },
  x: { width: 36, height: 36, borderRadius: 999, backgroundColor: 'rgba(30,22,14,0.6)', alignItems: 'center', justifyContent: 'center' },
  xTxt: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: -2 },
  panel: { flex: 1, marginTop: -20, borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: CREAM, paddingTop: 12, borderTopWidth: 3, borderTopColor: '#b98a4e' },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 10 },
  tab: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 999, backgroundColor: '#fff8ec', borderWidth: 1, borderColor: 'rgba(180,140,80,0.4)' },
  tabOn: { backgroundColor: '#c8894a', borderColor: '#c8894a' },
  tabTxt: { fontSize: 13, fontWeight: '800', color: '#8a5a2a' }, tabTxtOn: { color: '#fff' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 14, paddingBottom: 28 },
  card: { width: '46.5%', backgroundColor: '#fffdf7', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(180,140,80,0.35)', padding: 10 },
  prev: { width: '100%', aspectRatio: 16 / 10, borderRadius: 10 },
  prevEmoji: { backgroundColor: '#f3ead9', alignItems: 'center', justifyContent: 'center' }, emoji: { fontSize: 40 },
  name: { marginTop: 8, marginBottom: 8, fontWeight: '800', color: '#5a3d22', fontSize: 14 },
  btn: { alignSelf: 'stretch', borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  btnTxt: { fontWeight: '800', fontSize: 13 },
  pillOn: { backgroundColor: '#efe3c8', borderWidth: 1, borderColor: '#d8b96a' }, txtOn: { color: '#8a6a2a' },
  pillOwn: { backgroundColor: '#eaf1fb', borderWidth: 1, borderColor: '#a9c6f2' }, txtOwn: { color: '#3f7fd6' },
  pillBuy: { backgroundColor: '#3f7fd6' }, txtBuy: { color: '#fff' },
  pillNo: { backgroundColor: '#eee' }, txtNo: { color: '#aaa' },
});
