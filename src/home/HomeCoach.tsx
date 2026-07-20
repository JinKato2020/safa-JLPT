// ホーム中央に案内キャラ「桜」を常駐。吹き出しアドバイスは廃止。
//  ・桜は常に表示(ふわふわ浮遊＋まばたき)。装備中の筆/民族衣装を表示。
//  ・桜をタップ→アイテム一覧が下からスワイプで表示(髪型、民族衣装、筆、道具の順)。
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Image, Animated, Pressable, StyleSheet, useWindowDimensions, Modal, ScrollView, Dimensions } from 'react-native';
import { useT } from '../i18n';
import { useAppState, useAppActions } from '../store/store';
import { SHOP_BY_ID, SHOP } from '../data/shop';
import type { HomeStatus } from './homeStatus';

const OPEN = require('../../assets/mywords/guide_open.png');
const BLINK = require('../../assets/mywords/guide_blink.png');

export default function HomeCoach({ status, learned }: { status: HomeStatus; learned: number }) {
  const t = useT();
  const { width } = useWindowDimensions();
  const state = useAppState();
  const { equipItem } = useAppActions();
  // 装備中の筆があれば、その「桜が筆を背負う絵」で出現。髪型がショートなら短髪版・標準はロング版。
  const eqBrush = state.equipped?.brush;
  const isShort = state.equipped?.hair === 'hair_short';
  const bItem = eqBrush ? SHOP_BY_ID[eqBrush] : undefined;
  const brushImg = bItem ? (isShort ? bItem.homeShort : bItem.homeLong) : undefined;
  // 民族衣装を装備中はその全身アバターを優先表示(髪型/筆より上位)。桜が各国の衣装をまとう。
  const eqCostume = state.equipped?.costume;
  const costumeImg = eqCostume ? SHOP_BY_ID[eqCostume]?.asset : undefined;
  const charImg = costumeImg ?? brushImg; // 優先: 民族衣装 > 筆(背負い) > 既定の案内キャラ
  const [showShop, setShowShop] = useState(false);
  const [eyesClosed, setEyesClosed] = useState(false);
  const bob = useRef(new Animated.Value(0)).current;

  // 常時: ふわふわ浮遊＋まばたき。
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 2000, useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 2000, useNativeDriver: true }),
    ]));
    loop.start();
    let bAlive = true;
    const bt: ReturnType<typeof setTimeout>[] = [];
    const blink = () => {
      if (!bAlive) return;
      setEyesClosed(true);
      bt.push(setTimeout(() => setEyesClosed(false), 130));
      bt.push(setTimeout(blink, 2600 + Math.random() * 3200));
    };
    bt.push(setTimeout(blink, 1600));
    return () => { loop.stop(); bAlive = false; bt.forEach(clearTimeout); };
  }, [bob]);

  // 民族衣装/背負い筆の全身絵は縦長(≒864x1184)なので少し大きめ＋縦横比を変える。既定の案内キャラはほぼ正方形。
  const charW = Math.round(width * (charImg ? 0.60 : 0.40));
  const charH = Math.round(charW * (charImg ? 1.370 : 1.12));
  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -9] });

  // アイテム一覧(髪型、民族衣装、筆、道具の順)
  const itemsByKind = {
    hair: SHOP.filter((item) => item.kind === 'hair'),
    costume: SHOP.filter((item) => item.kind === 'costume'),
    brush: SHOP.filter((item) => item.kind === 'brush'),
    tool: SHOP.filter((item) => item.cat === 'tool'),
  };

  const onTapItem = (itemId: string) => {
    const item = SHOP_BY_ID[itemId];
    if (!item) return;
    equipItem({ id: itemId, kind: item.kind });
  };

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Animated.View style={{ transform: [{ translateY: bobY }] }}>
        <Pressable onPress={() => setShowShop(true)} hitSlop={4}>
          <Image source={charImg ?? (eyesClosed ? BLINK : OPEN)} style={{ width: charW, height: charH }} resizeMode="contain" />
        </Pressable>
      </Animated.View>
      <Modal visible={showShop} transparent animationType="slide" onRequestClose={() => setShowShop(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowShop(false)} />
        <View style={styles.modalContent}>
          <View style={styles.modalHandle} />
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.shopList}>
            {/* 髪型 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('shop_hair') ?? '髪型'}</Text>
              <View style={styles.itemGrid}>
                {itemsByKind.hair.map((item) => (
                  <Pressable key={item.id} style={[styles.itemCard, state.equipped?.hair === item.id && styles.itemCardSelected]} onPress={() => { onTapItem(item.id); setShowShop(false); }}>
                    {item.asset ? <Image source={item.asset} style={styles.itemImage} resizeMode="contain" /> : <Text style={styles.itemEmoji}>{item.emoji}</Text>}
                    <Text style={styles.itemName}>{item.name}</Text>
                    {item.price > 0 && <Text style={styles.itemPrice}>{item.price}</Text>}
                  </Pressable>
                ))}
              </View>
            </View>
            {/* 民族衣装 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('shop_costume') ?? '民族衣装'}</Text>
              <View style={styles.itemGrid}>
                {itemsByKind.costume.map((item) => (
                  <Pressable key={item.id} style={[styles.itemCard, state.equipped?.costume === item.id && styles.itemCardSelected]} onPress={() => { onTapItem(item.id); setShowShop(false); }}>
                    {item.asset ? <Image source={item.asset} style={styles.itemImage} resizeMode="contain" /> : <Text style={styles.itemEmoji}>{item.emoji}</Text>}
                    <Text style={styles.itemName}>{item.name}</Text>
                    {item.price > 0 && <Text style={styles.itemPrice}>{item.price}</Text>}
                  </Pressable>
                ))}
              </View>
            </View>
            {/* 筆 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('shop_brush') ?? '筆'}</Text>
              <View style={styles.itemGrid}>
                {itemsByKind.brush.map((item) => (
                  <Pressable key={item.id} style={[styles.itemCard, state.equipped?.brush === item.id && styles.itemCardSelected]} onPress={() => { onTapItem(item.id); setShowShop(false); }}>
                    {item.asset ? <Image source={item.asset} style={styles.itemImage} resizeMode="contain" /> : <Text style={styles.itemEmoji}>{item.emoji}</Text>}
                    <Text style={styles.itemName}>{item.name}</Text>
                    {item.price > 0 && <Text style={styles.itemPrice}>{item.price}</Text>}
                  </Pressable>
                ))}
              </View>
            </View>
            {/* 道具 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('shop_tool') ?? '道具'}</Text>
              <View style={styles.itemGrid}>
                {itemsByKind.tool.map((item) => (
                  <Pressable key={item.id} style={[styles.itemCard, state.equipped?.companion === item.id && styles.itemCardSelected]} onPress={() => { onTapItem(item.id); setShowShop(false); }}>
                    {item.asset ? <Image source={item.asset} style={styles.itemImage} resizeMode="contain" /> : <Text style={styles.itemEmoji}>{item.emoji}</Text>}
                    <Text style={styles.itemName}>{item.name}</Text>
                    {item.price > 0 && <Text style={styles.itemPrice}>{item.price}</Text>}
                  </Pressable>
                ))}
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 60, alignItems: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 20, maxHeight: Dimensions.get('window').height * 0.8 },
  modalHandle: { height: 4, width: 40, borderRadius: 2, backgroundColor: '#ccc', alignSelf: 'center', marginTop: 10, marginBottom: 16 },
  shopList: { paddingHorizontal: 16, gap: 24 },
  section: { gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#333' },
  itemGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  itemCard: { flex: 1, minWidth: '30%', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: 2, borderColor: '#eee', backgroundColor: '#fafafa' },
  itemCardSelected: { borderColor: '#2f7bf6', backgroundColor: '#eff4ff' },
  itemImage: { width: 60, height: 60 },
  itemEmoji: { fontSize: 32 },
  itemName: { fontSize: 12, fontWeight: '700', color: '#333', textAlign: 'center' },
  itemPrice: { fontSize: 11, color: '#f59e0b' },
});
