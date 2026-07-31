// 桜貝ショップ(モーダル)。上=店内イラスト帯／下=アイテム。配色はアプリ共通テーマ(light/dark)に統一。
//  大分類タブ=髪型/筆/民族衣装/道具/仲間。着せ替え・仲間=owned/equipped の状態管理。道具=所持のみ。通貨=桜貝(wallet.points)。
//  背景テーマ・フォントは設定画面へ移設(ここには無い)。
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Image, ImageBackground, Animated, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAppState, useAppActions } from '../store/store';
import { walletPoints, isOwned, isEquipped } from '../store/wallet';
import { mockTicketCount, canBuyMockTicket, MAX_MOCK_TICKETS, MOCK_TICKET_PRICE } from '../store/tickets';
import { SHOP, type ShopItem } from '../data/shop';
import { useColors, type ThemeColors } from '../theme';
import { useT } from '../i18n';

const MOCK_TICKET_ID = 'tool_mock_ticket';

const BANNER = require('../../assets/shop/shop_banner.png');

// ショップのカテゴリタブ。順=髪型/筆/民族衣装/道具/仲間。各タブは単一種別なので小見出しは不要。
const TABS: { key: string; labelKey: string; match: (i: ShopItem) => boolean }[] = [
  { key: 'hair', labelKey: 'shop.tab_hair', match: (i) => i.kind === 'hair' },
  { key: 'brush', labelKey: 'shop.tab_brush', match: (i) => i.kind === 'brush' },
  { key: 'costume', labelKey: 'shop.tab_costume', match: (i) => i.kind === 'costume' },
  { key: 'tool', labelKey: 'shop.tab_tool', match: (i) => i.cat === 'tool' },
  { key: 'companion', labelKey: 'shop.tab_companion', match: (i) => i.cat === 'companion' },
];

export default function ShopScreen() {
  const nav = useNavigation();
  const t = useT();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
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

  // アイテム名はi18n(shop.name_<id>)で解決。未登録キーはデータのnameにフォールバック。
  const nameOf = (i: ShopItem) => { const k = 'shop.name_' + i.id; const v = t(k); return v === k ? i.name : v; };
  const points = walletPoints(state);
  const ownedItem = (i: ShopItem) => isOwned(state, i.id);
  const equippedItem = (i: ShopItem) => isEquipped(state, { id: i.id, kind: i.kind });
  const canBuyItem = (i: ShopItem) => !ownedItem(i) && (devUnlimited || points >= i.price);

  const tickets = mockTicketCount(state);
  const ticketFull = tickets >= MAX_MOCK_TICKETS;
  const canBuyTicket = !ticketFull && (devUnlimited || canBuyMockTicket(state));

  const act = (i: ShopItem) => {
    if (i.id === MOCK_TICKET_ID) {
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
    i.id === MOCK_TICKET_ID ? (ticketFull ? t('shop.st_max') : canBuyTicket ? `🌸 ${MOCK_TICKET_PRICE}` : t('shop.st_insufficient'))
      : equippedItem(i) ? t('shop.st_equipped')
        : ownedItem(i) ? (i.kind === 'tool' ? t('shop.st_owned') : t('shop.st_equip'))
          : i.price === 0 ? t('shop.st_get')
            : canBuyItem(i) ? `🌸 ${i.price}` : t('shop.st_insufficient');
  const disabled = (i: ShopItem) => (i.id === MOCK_TICKET_ID ? !canBuyTicket : equippedItem(i) || (ownedItem(i) && i.kind === 'tool') || (!ownedItem(i) && !canBuyItem(i)));
  const pill = (i: ShopItem) => (i.id === MOCK_TICKET_ID ? (canBuyTicket ? s.pillBuy : ticketFull ? s.pillOwn : s.pillNo) : equippedItem(i) ? s.pillOn : ownedItem(i) ? s.pillOwn : canBuyItem(i) ? s.pillBuy : s.pillNo);
  const pillTxt = (i: ShopItem) => (i.id === MOCK_TICKET_ID ? (canBuyTicket ? s.txtBuy : ticketFull ? s.txtOwn : s.txtNo) : equippedItem(i) ? s.txtOn : ownedItem(i) ? s.txtOwn : canBuyItem(i) ? s.txtBuy : s.txtNo);

  const bannerH = Math.max(280, Math.round(height * 0.40));

  const renderCard = (i: ShopItem) => {
    const dogPct = i.cat === 'companion' && i.homeScale != null ? Math.round(i.homeScale * 95) : null;
    return (
    <View key={i.id} style={s.card}>
      {i.asset ? (
        <View style={[s.prev, s.prevImg, dogPct != null && s.prevDog]}>
          <Image source={i.asset} style={dogPct != null ? { width: `${dogPct}%`, height: `${dogPct}%` } : s.prevInner} resizeMode="contain" />
        </View>
      ) : (
        <View style={[s.prev, s.prevEmoji]}><Text style={s.emoji}>{i.emoji ?? '❔'}</Text></View>
      )}
      <Text style={s.name} numberOfLines={1}>{nameOf(i)}</Text>
      {i.id === MOCK_TICKET_ID ? <Text style={s.remain} numberOfLines={1}>残り {tickets} / {MAX_MOCK_TICKETS}</Text> : null}
      {i.rarity ? <Text style={s.rarity} numberOfLines={1}>{'★'.repeat(i.rarity)}<Text style={s.rarityOff}>{'★'.repeat(5 - i.rarity)}</Text></Text> : null}
      <Pressable disabled={disabled(i)} onPress={() => act(i)} style={[s.btn, pill(i)]}>
        <Text style={[s.btnTxt, pillTxt(i)]}>{statusOf(i)}</Text>
      </Pressable>
    </View>
    );
  };

  return (
    <View style={s.c}>
      <ImageBackground source={BANNER} style={{ height: bannerH }} resizeMode="cover">
        <SafeAreaView edges={['top']}>
          <View style={s.top}>
            <View style={s.bal}><Text style={s.balIco}>🌸</Text><Text style={s.balN}>{points.toLocaleString()}</Text><Text style={s.balL}>{t('shop.points_label')}</Text></View>
            <Pressable onPress={() => nav.goBack()} hitSlop={12} style={s.x}><Text style={s.xTxt}>×</Text></Pressable>
          </View>
        </SafeAreaView>
      </ImageBackground>

      <View style={s.panel}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBar} contentContainerStyle={s.tabs}>
          {TABS.map((x) => (
            <Pressable key={x.key} onPress={() => setCat(x.key)} style={[s.tab, cat === x.key && s.tabOn]}>
              <Text style={[s.tabTxt, cat === x.key && s.tabTxtOn]}>{t(x.labelKey)}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <ScrollView style={s.content} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <View style={s.grid}>{items.map(renderCard)}</View>
        </ScrollView>
      </View>

      {/* 購入演出: 桜が手に入れた筆を持って2秒登場(タップで即閉じ)。 */}
      {celebrate && (
        <Animated.View style={[s.celOverlay, { opacity: celAnim }]}>
          <Pressable style={s.celFill} onPress={() => setCelebrate(null)}>
            <Text style={s.celGot}>{t('shop.got')}</Text>
            <Animated.Image
              source={celebrate.celebrate!}
              resizeMode="contain"
              style={[s.celImg, { transform: [{ scale: celAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]}
            />
            <Text style={s.celName}>{nameOf(celebrate)}</Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    c: { flex: 1, backgroundColor: c.bg },
    top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 8 },
    // 残高ピル=テーマのカード色。バナー画像の上でも読めるよう影を少し。
    bal: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 13, shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
    balIco: { fontSize: 15 }, balN: { fontWeight: '900', color: c.ink, fontSize: 16, fontVariant: ['tabular-nums'] }, balL: { fontSize: 10, color: c.mute, fontWeight: '700' },
    x: { width: 36, height: 36, borderRadius: 999, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
    xTxt: { color: c.ink, fontSize: 22, fontWeight: '700', marginTop: -2 },
    // 下パネル=アプリの背景色。バナーに少し重ねて角丸(店内→棚のつながり)。
    panel: { flex: 1, marginTop: -20, borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: c.bg, paddingTop: 14 },
    // タブ帯=内容の高さに縮める(flexGrow:0)。これが無いと横ScrollViewが縦に伸び、行の既定alignItems:stretchで
    // タブが帯高いっぱいに引き伸ばされて選択カテゴリごとに縦長/潰れが起きていた(2026-07-31修正)。
    tabBar: { flexGrow: 0, flexShrink: 0 },
    content: { flex: 1 }, // 残りの縦領域はこちらが占有=タブ帯を押し伸ばさない
    // alignItems:'center'=タブを自然な高さ(中身)に固定し縦伸びを止める。
    tabs: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingBottom: 12 },
    tab: { height: 40, paddingHorizontal: 16, borderRadius: 999, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
    tabOn: { backgroundColor: c.blue, borderColor: c.blue },
    // lineHeight=20＋includeFontPadding既定。以前の includeFontPadding:false は CJK(髪/型/装 等)の下端を約1/3切っていた。
    tabTxt: { fontSize: 13, lineHeight: 20, fontWeight: '800', color: c.ink2 }, tabTxtOn: { color: '#fff' },
    scroll: { paddingHorizontal: 14, paddingBottom: 28 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    card: { width: '46.5%', backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 10, overflow: 'hidden' },
    prev: { width: '100%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    prevInner: { width: '72%', height: '72%' },
    prevDog: { justifyContent: 'flex-end', paddingBottom: '4%' },
    prevEmoji: { backgroundColor: c.bgSoft, alignItems: 'center', justifyContent: 'center' }, emoji: { fontSize: 40 },
    prevImg: { backgroundColor: c.bgSoft },
    name: { marginTop: 10, marginBottom: 4, fontWeight: '800', color: c.ink, fontSize: 14 },
    remain: { marginBottom: 6, fontSize: 12, color: c.mute, fontWeight: '800' },
    rarity: { marginBottom: 6, fontSize: 12, color: c.amber, letterSpacing: 1 },
    rarityOff: { color: c.line },
    // ボタン=角丸ピル(縦長ブロックにしない)。状態で色分け=購入(青)/装備可(淡青)/装備中(緑)/不可(灰)。
    btn: { alignSelf: 'stretch', borderRadius: 999, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
    btnTxt: { fontWeight: '800', fontSize: 13, letterSpacing: 0.3 },
    pillOn: { backgroundColor: c.okBg, borderWidth: 1, borderColor: c.okBorder }, txtOn: { color: c.green },
    pillOwn: { backgroundColor: c.blueLight }, txtOwn: { color: c.blueDark },
    pillBuy: { backgroundColor: c.blue }, txtBuy: { color: '#fff' },
    pillNo: { backgroundColor: c.bgSoft }, txtNo: { color: c.faint },
    celOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 20 },
    celFill: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,23,42,0.66)', gap: 8 },
    celGot: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: 2, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 },
    celImg: { width: '72%', height: '50%', alignSelf: 'center' },
    celName: { color: '#fff', fontSize: 18, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 },
  });
