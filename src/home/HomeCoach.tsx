// ホーム中央に案内キャラ「桜」を常駐。左に仲間(柴犬)。吹き出しアドバイスは廃止。
//  ・桜は常に表示(ふわふわ浮遊＋まばたき)。装備中の筆/民族衣装を表示。
//  ・桜をタップ→「購入済み」の着せ替え一覧が下からスワイプ(髪型、民族衣装、筆の順)。未購入・道具はショップで。
//  ・柴犬(仲間)をタップ→「購入済み」の柴だけ並べて交換(着せ替え)。購入はショップの「仲間」タブで。
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Image, Animated, Pressable, StyleSheet, useWindowDimensions, ScrollView } from 'react-native';
import { useT } from '../i18n';
import { useAppState, useAppActions } from '../store/store';
import { SHOP_BY_ID, SHOP, type ShopItem } from '../data/shop';
import { HAIR_NORM, DOG_NORM, COSTUME_NORM, HAIR_REF_CHAR_H, DOG_BASE_SIZE, DOG_BASE_SCALE } from './charNorm';
import SwipeSheet from '../components/SwipeSheet';
import { appArtFor, useAppArt } from '../data/appArtRemote';
import { useColors, type ThemeColors } from '../theme';
import type { HomeStatus } from './homeStatus';

// 既定の桜(案内キャラ)=正面の立ち絵。装備中の髪型(10種)の立ち絵を表示。筆は背負わない(筆キャラは廃止)。
// 髪型未装備時の保険(通常は hair_long が初期装備なので使われない)。
const SAKURA_FALLBACK = require('../../assets/home/hair/hair_long.png');
// 柴1(pet_shiba1)だけ尻尾を振る=尻尾を別レイヤーに切り出し(尻尾=後/胴体=前・付け根を胴体で隠す)。
const SHIBA1_BODY = require('../../assets/shop/companion/shiba1_body.png');
const SHIBA1_TAIL = require('../../assets/shop/companion/shiba1_tail.png');

export default function HomeCoach({ status, learned }: { status: HomeStatus; learned: number }) {
  const t = useT();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { width } = useWindowDimensions();
  const state = useAppState();
  const { equipItem } = useAppActions();
  useAppArt(); // 画像がOTAで差し替わったら描き直す(寸法・実測値も配信版に切替)
  // 筆キャラは廃止。桜は筆を背負わない。装備中の髪型(10種)の立ち絵を表示する。
  const eqHair = state.equipped?.hair;
  const hairImg = (eqHair ? SHOP_BY_ID[eqHair]?.asset : undefined) ?? SAKURA_FALLBACK;
  // 民族衣装を装備中はその全身アバターを優先表示(髪型より上位)。桜が各国の衣装をまとう。
  const eqCostume = state.equipped?.costume;
  const costumeImg = eqCostume ? SHOP_BY_ID[eqCostume]?.asset : undefined;
  const charImg = costumeImg; // 優先: 民族衣装 > 既定の桜(長髪/短髪)
  // 仲間(柴犬): 装備中の1体を桜の左に常駐。番号が上がるほど大きい(homeScale)。
  const eqComp = state.equipped?.companion;
  const compItem = eqComp ? SHOP_BY_ID[eqComp] : undefined;
  const compImg = compItem?.asset;
  const compScale = compItem?.homeScale ?? 0.5;
  // 透過余白を除去したPNGの実寸比(縦/横)で表示枠を作る=枠と絵の隙間(レターボックス)を無くし、犬が枠いっぱい＝左端まで詰まって出る。
  const compSrc = compImg ? Image.resolveAssetSource(compImg) : null;
  const compAspect = compSrc?.width ? compSrc.height / compSrc.width : 1.08;
  const [showShop, setShowShop] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const bob = useRef(new Animated.Value(0)).current;
  const dogSway = useRef(new Animated.Value(0)).current; // 犬: 体を左右にゆらす
  const tailWag = useRef(new Animated.Value(0)).current; // 柴1: 尻尾を振る

  // 常時: ふわふわ浮遊＋まばたき。
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 2000, useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 2000, useNativeDriver: true }),
    ]));
    loop.start();
    // 犬: ゆっくり左右にゆらす(ジャンプ=hopは廃止・体のゆらぎのみ)。
    const sway = Animated.loop(Animated.sequence([
      Animated.timing(dogSway, { toValue: 1, duration: 1600, useNativeDriver: true }),
      Animated.timing(dogSway, { toValue: 0, duration: 1600, useNativeDriver: true }),
    ]));
    sway.start();
    // 柴1: 尻尾を左右にフリフリ(付け根を軸に回転)。
    const wag = Animated.loop(Animated.sequence([
      Animated.timing(tailWag, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(tailWag, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]));
    wag.start();
    return () => { loop.stop(); sway.stop(); wag.stop(); };
  }, [bob, dogSway, tailWag]);

  // 少女版は髪型・民族衣装とも全身の透過PNG。服や髪の余白に関わらず人物の高さを揃える。
  const bundledNorm = (charImg
    ? (eqCostume ? COSTUME_NORM[eqCostume] : undefined)
    : HAIR_NORM[eqHair ?? 'hair_long']) ?? HAIR_NORM.hair_long;
  // OTAで差し替えた絵は、配信時に測った縦横比・人物の高さ割合を使う(同梱の実測値は旧画像のもの)。
  const charOta = appArtFor(charImg ?? hairImg);
  const charNorm = charOta ? { aspect: charOta.width / charOta.height, hfrac: charOta.hfrac ?? bundledNorm.hfrac } : bundledNorm;
  const charH = Math.round((width * HAIR_REF_CHAR_H) / charNorm.hfrac);
  const charW = Math.round(charH * charNorm.aspect);
  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -9] });
  const dogSwayDeg = dogSway.interpolate({ inputRange: [0, 1], outputRange: ['-3deg', '3deg'] });
  // 尻尾は「開いた空間側へ持ち上がる」-方向のみで振る(胴体側へ振ると付け根に隙間が出るため)。
  const tailWagDeg = tailWag.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-9deg'] });
  // 柴1だけ尻尾フリフリ。柴1の絵だけOTAで差し替え、胴体/尻尾レイヤーが同梱のままなら、絵がずれるので1枚絵で出す。
  const isShiba1 = state.equipped?.companion === 'pet_shiba1' && (!appArtFor(compImg) || !!appArtFor(SHIBA1_BODY));
  // 仲間の表示サイズ=柴1を基準にキャラの見かけ「サイズ(面積)」を正規化してから成長倍率をかける。
  //  ・各犬PNGはキャンバス寸法・縦横比がバラバラなので、幅一律スケールだと見かけの大小が崩れる。
  //  ・そこでキャラ面積の幾何平均(sizeFrac)と縦横比(aspect)で、キャラの実効サイズが growth に比例するよう枠高を逆算。
  //  ・growth = homeScale / 柴1のhomeScale(柴1=1.0基準・番号が上がるほど相対的に大きい)。
  const bundledDn = (eqComp ? DOG_NORM[eqComp] : undefined) ?? { aspect: compAspect, sizeFrac: 1 };
  const compOta = appArtFor(compImg);
  const dn = compOta ? { aspect: compOta.width / compOta.height, sizeFrac: compOta.sizeFrac ?? bundledDn.sizeFrac } : bundledDn;
  const growth = compScale / DOG_BASE_SCALE;
  const targetS = width * DOG_BASE_SIZE * growth;           // この犬のキャラ目標サイズ(linear)
  const compH = compImg ? Math.round(targetS / (Math.sqrt(dn.aspect) * dn.sizeFrac)) : 0;
  const compW = Math.round(compH * dn.aspect);
  // 犬は必ず画面内に収める。桜と横並びで画面幅を超える分だけ、桜を犬側へ寄せて重ねる(=犬の尾まで画面内)。
  // 重なる時は犬を前面・桜を後ろにして、犬の全身が隠れないようにする(小さい犬は重ならないので従来どおり)。
  const edgePad = 10; // 画面端の最小余白
  const overflow = Math.max(0, compW + charW - (width - edgePad * 2));
  const compOverlap = 6 + overflow; // 既定の軽い重なり6px + はみ出し分
  const dogInFront = overflow > 0;  // はみ出す(重なる)時だけ犬を前面に

  // 桜タップの着せ替え=「購入済み」の髪型/民族衣装/筆のみ(道具・未購入はショップで確認)。
  const owned = new Set(state.owned ?? []);
  const itemsByKind = {
    hair: SHOP.filter((item) => item.kind === 'hair' && owned.has(item.id)),
    costume: SHOP.filter((item) => item.kind === 'costume' && owned.has(item.id)),
  };
  // 柴タップ=購入済みの仲間(柴犬)だけを並べて着せ替え。
  const ownedCompanions = SHOP.filter((item) => item.cat === 'companion' && owned.has(item.id));

  const onTapItem = (itemId: string) => {
    const item = SHOP_BY_ID[itemId];
    if (!item) return;
    equipItem({ id: itemId, kind: item.kind });
  };
  // 表示名=ショップと同じ多言語解決(shop.name_<id> があれば翻訳・無ければ日本語の既定名)。
  const nameOf = (i: ShopItem) => { const k = 'shop.name_' + i.id; const v = t(k); return v === k ? i.name : v; };

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.row}>
        {/* 仲間(柴犬)=桜の左に常駐。タップで購入済みの柴だけ選べる。 */}
        {compImg ? (
          <Pressable onPress={() => setShowPicker(true)} hitSlop={6} style={[styles.compWrap, { marginRight: -compOverlap, zIndex: dogInFront ? 2 : 0 }]}>
            <Animated.View style={{ transform: [{ rotate: dogSwayDeg }] }}>
              {isShiba1 ? (
                // 柴1: 尻尾レイヤー(後)を付け根(41%,57%)を軸に振る＋胴体(前)で付け根の切れ目を隠す。
                <View style={{ width: compW, height: compH }}>
                  <Animated.Image source={SHIBA1_TAIL} style={[StyleSheet.absoluteFill, { width: compW, height: compH, transformOrigin: '36% 52%', transform: [{ rotate: tailWagDeg }] }]} resizeMode="contain" />
                  <Image source={SHIBA1_BODY} style={{ width: compW, height: compH }} resizeMode="contain" />
                </View>
              ) : (
                <Image source={compImg} style={{ width: compW, height: compH }} resizeMode="contain" />
              )}
            </Animated.View>
          </Pressable>
        ) : null}
        {/* 桜(案内キャラ)=右。タップで購入済みの着せ替え一覧。 */}
        <Animated.View style={{ transform: [{ translateY: bobY }], zIndex: dogInFront ? 1 : 0 }}>
          <Pressable onPress={() => setShowShop(true)} hitSlop={4}>
            <Image source={charImg ?? hairImg} style={{ width: charW, height: charH }} resizeMode="contain" />
          </Pressable>
        </Animated.View>
      </View>
      <SwipeSheet visible={showShop} onClose={() => setShowShop(false)} maxHeightRatio={0.8}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.shopList}>
            {([
              { key: 'hair', title: t('shop.tab_hair'), items: itemsByKind.hair, slot: 'hair' as const },
              { key: 'costume', title: t('shop.tab_costume'), items: itemsByKind.costume, slot: 'costume' as const },
            ]).map((sec) => (
              <View key={sec.key} style={styles.section}>
                <Text style={styles.sectionTitle}>{sec.title}</Text>
                <View style={styles.itemGrid}>
                  {sec.items.map((item) => (
                    <Pressable key={item.id} style={[styles.itemCard, state.equipped?.[sec.slot] === item.id && styles.itemCardSelected]} onPress={() => { onTapItem(item.id); setShowShop(false); }}>
                      {item.asset ? <Image source={item.asset} style={styles.itemImage} resizeMode="contain" /> : <Text style={styles.itemEmoji}>{item.emoji}</Text>}
                      <Text style={styles.itemName}>{nameOf(item)}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
      </SwipeSheet>
      {/* 柴タップ=購入済みの仲間だけを並べて交換(着せ替え)。購入はショップで。 */}
      <SwipeSheet visible={showPicker} onClose={() => setShowPicker(false)} maxHeightRatio={0.8}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.shopList}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('shop.tab_companion')}</Text>
              <View style={styles.itemGrid}>
                {ownedCompanions.map((item) => {
                  // 犬は実寸比(homeScale)で相対表示=小さい犬は小さく・大きい犬は大きく(ショップと同じ・下端そろえ)。
                  const dogPct = Math.round((item.homeScale ?? 0.5) * 95);
                  return (
                  <Pressable key={item.id} style={[styles.itemCard, state.equipped?.companion === item.id && styles.itemCardSelected]} onPress={() => { onTapItem(item.id); setShowPicker(false); }}>
                    <View style={styles.dogBox}>
                      {item.asset ? <Image source={item.asset} style={{ width: `${dogPct}%`, height: `${dogPct}%` }} resizeMode="contain" /> : <Text style={styles.itemEmoji}>{item.emoji}</Text>}
                    </View>
                    <Text style={styles.itemName}>{nameOf(item)}</Text>
                  </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>
      </SwipeSheet>
    </View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  // 桜/犬は画面下部。ただし最下部の「今日のおすすめ」ボタンの上に収まるよう少し持ち上げる。
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 74, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' },
  compWrap: { marginBottom: 2 },
  shopList: { paddingHorizontal: 16, gap: 24 },
  section: { gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: c.ink },
  itemGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  // ショップと同じ左右2列(width 47%+gap12)。旧 flex:1/minWidth30% は項目数で列数が変わり1〜2個だと横長に伸びていた。
  itemCard: { width: '47%', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: 2, borderColor: c.line, backgroundColor: c.bgSoft },
  itemCardSelected: { borderColor: c.blue, backgroundColor: c.blueLight },
  itemImage: { width: 60, height: 60 },
  dogBox: { width: 60, height: 60, justifyContent: 'flex-end', alignItems: 'center' },
  itemEmoji: { fontSize: 32 },
  itemName: { fontSize: 12, fontWeight: '700', color: c.ink, textAlign: 'center' },
  itemPrice: { fontSize: 11, color: c.amber },
});
