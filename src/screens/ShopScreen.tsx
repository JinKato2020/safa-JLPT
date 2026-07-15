// 桜貝ショップ(モーダル)。上=店内イラスト帯／下=アイテム。
//  大分類タブ=着せ替え/仲間/道具。着せ替えは髪型/服/筆の小見出しで整理。
//  着せ替え・仲間=owned/equipped の状態管理。道具=所持のみ(効果は順次)。通貨=桜貝(wallet.points)。
//  背景テーマ・フォントは設定画面へ移設(ここには無い)。
import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Image, ImageBackground, Animated, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAppState, useAppActions } from '../store/store';
import { walletPoints, isOwned, isEquipped } from '../store/wallet';
import { mockTicketCount, canBuyMockTicket, MAX_MOCK_TICKETS, MOCK_TICKET_PRICE } from '../store/tickets';
import { SHOP, type ShopItem } from '../data/shop';

const MOCK_TICKET_ID = 'tool_mock_ticket';

const BANNER = require('../../assets/shop/shop_banner.png');

// ショップのカテゴリタブ。順=髪型/筆/民族衣装/道具/仲間(服は廃止)。各タブは単一種別なので小見出しは不要。
const TABS: { key: string; label: string; match: (i: ShopItem) => boolean }[] = [
  { key: 'hair', label: '髪型', match: (i) => i.kind === 'hair' },
  { key: 'brush', label: '筆', match: (i) => i.kind === 'brush' },
  { key: 'costume', label: '民族衣装', match: (i) => i.kind === 'costume' },
  { key: 'tool', label: '道具', match: (i) => i.cat === 'tool' },
  { key: 'companion', label: '仲間', match: (i) => i.cat === 'companion' },
];

export default function ShopScreen() {
  const nav = useNavigation();
  const { height } = useWindowDimensions();
  const state = useAppState();
  const { buyItem, equipItem, addPoints, buyMockTicket } = useAppActions();
  const devUnlimited = state.settings.devUnlimitedPoints === true;
  const [cat, setCat] = useState<string>('hair');
  // 購入直後の演出(桜が筆を持つ絵を2秒表示)。
  const [celebrate, setCelebrate] = useState<ShopItem | null>(null);
  const celAnim = useRef(new Animated.Value(0)).current;
  const celTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (celTimer.current) clearTimeout(celTimer.current); }, []);
  const showCelebrate = (i: ShopItem) => {
    setCelebrate(i);
    celAnim.setValue(0);
    Animated.spring(celAnim, { toValue: 1, useNativeDriver: true, friction: 6, tension: 80 }).start();
    if (celTimer.current) clearTimeout(celTimer.current);
    celTimer.current = setTimeout(() => setCelebrate(null), 2000);
  };
  const items = SHOP.filter((TABS.find((tb) => tb.key === cat) ?? TABS[0]).match);

  const points = walletPoints(state);
  const ownedItem = (i: ShopItem) => isOwned(state, i.id);
  const equippedItem = (i: ShopItem) => isEquipped(state, { id: i.id, kind: i.kind });
  const canBuyItem = (i: ShopItem) => !ownedItem(i) && (devUnlimited || points >= i.price);

  const tickets = mockTicketCount(state);
  const ticketFull = tickets >= MAX_MOCK_TICKETS;
  const canBuyTicket = !ticketFull && (devUnlimited || canBuyMockTicket(state));

  const act = (i: ShopItem) => {
    if (i.id === MOCK_TICKET_ID) {
      // 模試チケット=スタック式(所持数で管理・上限3)。買うたびに+1。
      if (!canBuyTicket) return;
      if (devUnlimited && points < MOCK_TICKET_PRICE) addPoints(1_000_000);
      buyMockTicket();
      return;
    }
    if (!ownedItem(i)) {
      if (canBuyItem(i)) {
        if (devUnlimited && points < i.price) addPoints(1_000_000); // 【開発用】無限ポイント: 残高を確保して必ず購入
        buyItem(i);
        if (i.celebrate) showCelebrate(i);
      }
      return; // 未所持(無料含む)→取得。演出あり品は2秒表示
    }
    if (i.kind === 'tool') return;                                 // 道具=所持のみ
    if (equippedItem(i)) return;                                   // 装備中→何もしない
    equipItem({ id: i.id, kind: i.kind });                         // 着せ替え/仲間=装備
  };
  const statusOf = (i: ShopItem) =>
    i.id === MOCK_TICKET_ID ? (ticketFull ? '最大3枚' : canBuyTicket ? `🌸 ${MOCK_TICKET_PRICE}` : '足りない')
      : equippedItem(i) ? '装備中'
        : ownedItem(i) ? (i.kind === 'tool' ? '購入済み' : '装備する')
          : i.price === 0 ? '手に入れる'
            : canBuyItem(i) ? `🌸 ${i.price}` : '足りない';
  const disabled = (i: ShopItem) => (i.id === MOCK_TICKET_ID ? !canBuyTicket : equippedItem(i) || (ownedItem(i) && i.kind === 'tool') || (!ownedItem(i) && !canBuyItem(i)));
  const pill = (i: ShopItem) => (i.id === MOCK_TICKET_ID ? (canBuyTicket ? s.pillBuy : ticketFull ? s.pillOwn : s.pillNo) : equippedItem(i) ? s.pillOn : ownedItem(i) ? s.pillOwn : canBuyItem(i) ? s.pillBuy : s.pillNo);
  const pillTxt = (i: ShopItem) => (i.id === MOCK_TICKET_ID ? (canBuyTicket ? s.txtBuy : ticketFull ? s.txtOwn : s.txtNo) : equippedItem(i) ? s.txtOn : ownedItem(i) ? s.txtOwn : canBuyItem(i) ? s.txtBuy : s.txtNo);

  const bannerH = Math.max(280, Math.round(height * 0.40));

  const renderCard = (i: ShopItem) => (
    <View key={i.id} style={s.card}>
      {i.asset ? (
        <View style={[s.prev, s.prevImg]}><Image source={i.asset} style={s.prevInner} resizeMode="contain" /></View>
      ) : (
        <View style={[s.prev, s.prevEmoji]}><Text style={s.emoji}>{i.emoji ?? '❔'}</Text></View>
      )}
      <Text style={s.name} numberOfLines={1}>{i.name}</Text>
      {i.id === MOCK_TICKET_ID ? <Text style={s.remain} numberOfLines={1}>残り {tickets} / {MAX_MOCK_TICKETS}</Text> : null}
      {i.rarity ? <Text style={s.rarity} numberOfLines={1}>{'★'.repeat(i.rarity)}<Text style={s.rarityOff}>{'★'.repeat(5 - i.rarity)}</Text></Text> : null}
      <Pressable disabled={disabled(i)} onPress={() => act(i)} style={[s.btn, pill(i)]}>
        <Text style={[s.btnTxt, pillTxt(i)]}>{statusOf(i)}</Text>
      </Pressable>
    </View>
  );

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
          {TABS.map((x) => (
            <Pressable key={x.key} onPress={() => setCat(x.key)} style={[s.tab, cat === x.key && s.tabOn]}>
              <Text style={[s.tabTxt, cat === x.key && s.tabTxtOn]}>{x.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <View style={s.grid}>{items.map(renderCard)}</View>
        </ScrollView>
      </View>

      {/* 購入演出: 桜が手に入れた筆を持って2秒登場(タップで即閉じ)。 */}
      {celebrate && (
        <Animated.View style={[s.celOverlay, { opacity: celAnim }]}>
          <Pressable style={s.celFill} onPress={() => setCelebrate(null)}>
            <Text style={s.celGot}>手に入れた！</Text>
            <Animated.Image
              source={celebrate.celebrate!}
              resizeMode="contain"
              style={[s.celImg, { transform: [{ scale: celAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]}
            />
            <Text style={s.celName}>{celebrate.name}</Text>
          </Pressable>
        </Animated.View>
      )}
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
  tab: { paddingVertical: 10, paddingHorizontal: 15, borderRadius: 999, backgroundColor: '#fff8ec', borderWidth: 1, borderColor: 'rgba(180,140,80,0.4)' },
  tabOn: { backgroundColor: '#c8894a', borderColor: '#c8894a' },
  // 日本語の下端(はらい)が切れないよう lineHeight を確保し、Android の余白詰めを無効化。
  tabTxt: { fontSize: 13, lineHeight: 18, fontWeight: '800', color: '#8a5a2a', includeFontPadding: false, textAlignVertical: 'center' }, tabTxtOn: { color: '#fff' },
  scroll: { paddingHorizontal: 14, paddingBottom: 28 },
  group: { marginBottom: 6 },
  kindHead: { fontSize: 13, fontWeight: '900', color: '#a5732f', marginTop: 6, marginBottom: 8, letterSpacing: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { width: '46.5%', backgroundColor: '#fffdf7', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(180,140,80,0.35)', padding: 10, overflow: 'hidden' },
  prev: { width: '100%', aspectRatio: 1, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  prevInner: { width: '72%', height: '72%' }, // カード内に余白(約14%)を残して収める
  prevEmoji: { backgroundColor: '#f3ead9', alignItems: 'center', justifyContent: 'center' }, emoji: { fontSize: 40 },
  prevImg: { backgroundColor: '#f7efe0' },
  name: { marginTop: 8, marginBottom: 4, fontWeight: '800', color: '#5a3d22', fontSize: 14 },
  remain: { marginBottom: 6, fontSize: 12, color: '#7a4a1e', fontWeight: '800' },
  rarity: { marginBottom: 6, fontSize: 12, color: '#e0a63c', letterSpacing: 1 },
  rarityOff: { color: '#e2d4b8' },
  btn: { alignSelf: 'stretch', borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  btnTxt: { fontWeight: '800', fontSize: 13 },
  pillOn: { backgroundColor: '#efe3c8', borderWidth: 1, borderColor: '#d8b96a' }, txtOn: { color: '#8a6a2a' },
  pillOwn: { backgroundColor: '#eaf1fb', borderWidth: 1, borderColor: '#a9c6f2' }, txtOwn: { color: '#3f7fd6' },
  pillBuy: { backgroundColor: '#3f7fd6' }, txtBuy: { color: '#fff' },
  pillNo: { backgroundColor: '#eee' }, txtNo: { color: '#aaa' },
  celOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 20 },
  celFill: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(30,20,12,0.62)', gap: 8 },
  celGot: { color: '#ffe9c2', fontSize: 22, fontWeight: '900', letterSpacing: 2, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 },
  celImg: { width: '72%', height: '50%', alignSelf: 'center' },
  celName: { color: '#fff', fontSize: 18, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 },
});
