// 購入画面(Paywall)。ストアに登録した価格を RevenueCat 経由で受け取って表示する(アプリに金額を書かない)。
// Apple審査の必須要素: 各商品の価格・期間・自動更新の明示 / 「購入を復元」 / 規約・プライバシーへの導線。
// キー未設定・商品未登録のうちは offering=null → 「まもなく提供」を出して閉じるだけ(壊れない)。
import { useEffect, useRef, useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert, Linking, Animated, PanResponder } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PACKAGE_TYPE, type PurchasesOffering, type PurchasesPackage } from 'react-native-purchases';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import type { RootStackParamList } from '../navigation/types';
import { useT, useUiLang } from '../i18n';
import { legalUrl } from '../config/legal';
import { useAppActions } from '../store/store';
import { getCurrentOffering, purchase, restore, syncEntitlement } from '../pro/purchases';

// 画面上部のバナー(桜が書斎で迎えるイラスト)。course/UIアセットなのでassets配下にASCII名で配置。
const BANNER = require('../../assets/pro/subscribe.jpg');

/** パッケージ種別 → 期間ラベルのi18nキー。無ければ商品タイトルを使う。 */
function periodKey(t: PACKAGE_TYPE): string | null {
  switch (t) {
    case PACKAGE_TYPE.ANNUAL: return 'paywall.period_year';
    case PACKAGE_TYPE.MONTHLY: return 'paywall.period_month';
    case PACKAGE_TYPE.SIX_MONTH: return 'paywall.period_6month';
    case PACKAGE_TYPE.THREE_MONTH: return 'paywall.period_3month';
    case PACKAGE_TYPE.LIFETIME: return 'paywall.period_lifetime';
    default: return null;
  }
}

// 画面の表示順を固定(12ヶ月→6ヶ月→3ヶ月→1ヶ月)。RevenueCatのオファリング内の並びに依存しない。
const PERIOD_RANK: Partial<Record<PACKAGE_TYPE, number>> = {
  [PACKAGE_TYPE.ANNUAL]: 0,
  [PACKAGE_TYPE.SIX_MONTH]: 1,
  [PACKAGE_TYPE.THREE_MONTH]: 2,
  [PACKAGE_TYPE.MONTHLY]: 3,
};

export default function PaywallScreen() {
  const c = useColors();
  const t = useT();
  const uiLang = useUiLang();
  const s = styles(c);
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { setPurchaseActive } = useAppActions();

  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // 下スワイプで閉じる(上部の帯をドラッグ)。× は常時右上に表示。iOSはmodalの標準スワイプにも対応。
  const dragY = useRef(new Animated.Value(0)).current;
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,                                   // タップ(×)は奪わない
    onMoveShouldSetPanResponder: (_e, g) => g.dy > 4 && g.dy > Math.abs(g.dx),    // 下方向のドラッグだけ拾う
    onPanResponderMove: (_e, g) => { if (g.dy > 0) dragY.setValue(g.dy); },
    onPanResponderRelease: (_e, g) => {
      if (g.dy > 110 || g.vy > 0.6) Animated.timing(dragY, { toValue: 900, duration: 200, useNativeDriver: true }).start(() => nav.goBack());
      else Animated.spring(dragY, { toValue: 0, bounciness: 4, useNativeDriver: true }).start();
    },
  })).current;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const off = await getCurrentOffering();
      if (!cancelled) { setOffering(off); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  async function onBuy(pkg: PurchasesPackage) {
    if (busy) return;
    setBusy(true);
    const ok = await purchase(pkg);
    if (ok) {
      setPurchaseActive(true);
      Alert.alert(t('paywall.thanks'));
      nav.goBack();
    } else {
      // キャンセルも false。静かに戻すだけ(失敗メッセージは通信/在庫エラー時のみに寄せない=誤タップ配慮)
      setBusy(false);
    }
  }

  async function onRestore() {
    if (busy) return;
    setBusy(true);
    const ok = await restore();
    // 復元後に念のため最新化して保存
    const active = ok ? true : await syncEntitlement();
    if (typeof active === 'boolean') setPurchaseActive(active);
    setBusy(false);
    Alert.alert(ok ? t('paywall.restored') : t('paywall.no_restore'));
    if (ok) nav.goBack();
  }

  const packages = [...(offering?.availablePackages ?? [])].sort(
    (a, b) => (PERIOD_RANK[a.packageType] ?? 99) - (PERIOD_RANK[b.packageType] ?? 99),
  );

  return (
    <SafeAreaView style={s.c}>
      <Animated.View style={[s.sheet, { transform: [{ translateY: dragY }] }]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* 画面上部: 桜のイラストバナー */}
        <Image source={BANNER} style={s.banner} resizeMode="cover" />
        <Text style={s.title}>{t('paywall.title')}</Text>
        <Text style={s.subtitle}>{t('paywall.subtitle')}</Text>

        <View style={s.benefits}>
          <Text style={s.benefit}>{t('paywall.benefit_unlimited')}</Text>
          <Text style={s.benefit}>{t('paywall.benefit_mock')}</Text>
          <Text style={s.benefit}>{t('paywall.benefit_noads')}</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={c.blue} style={{ marginVertical: spacing.xl }} />
        ) : packages.length === 0 ? (
          <Text style={s.soon}>{t('paywall.soon')}</Text>
        ) : (
          packages.map((pkg) => {
            const pk = periodKey(pkg.packageType);
            const period = pk ? t(pk) : pkg.product.title;
            return (
              <Pressable
                key={pkg.identifier}
                style={[s.pkg, busy && s.pkgBusy]}
                onPress={() => onBuy(pkg)}
                disabled={busy}
                hitSlop={4}
              >
                <View style={s.pkgTxt}>
                  <Text style={s.pkgPeriod}>{`Pro ${period}`}</Text>
                  <Text style={s.pkgPrice}>{pkg.product.priceString}</Text>
                </View>
                <Text style={s.pkgGo}>{'›'}</Text>
              </Pressable>
            );
          })
        )}

        {/* 自動更新の明示(Apple審査で必須) */}
        <Text style={s.legal}>{t('paywall.legal_note')}</Text>

        <Pressable style={s.restore} onPress={onRestore} disabled={busy} hitSlop={8}>
          <Text style={s.restoreTxt}>{t('paywall.restore')}</Text>
        </Pressable>

        <View style={s.links}>
          <Pressable onPress={() => Linking.openURL(legalUrl('terms', uiLang))} hitSlop={8}>
            <Text style={s.linkTxt}>{t('paywall.terms')}</Text>
          </Pressable>
          <Text style={s.linkSep}>·</Text>
          <Pressable onPress={() => Linking.openURL(legalUrl('privacy', uiLang))} hitSlop={8}>
            <Text style={s.linkTxt}>{t('paywall.privacy')}</Text>
          </Pressable>
        </View>

        <Pressable style={s.close} onPress={() => nav.goBack()} hitSlop={8}>
          <Text style={s.closeTxt}>{t('paywall.close')}</Text>
        </Pressable>
      </ScrollView>
        {/* 上部の下スワイプ帯(バナーに重ねる)=下へドラッグで閉じる。グラブバーで“つかめる”ことを示す。 */}
        <View style={s.swipeZone} {...pan.panHandlers}><View style={s.grabber} /></View>
        {/* 右上×(常に最前面)=タップで閉じる。 */}
        <Pressable style={s.xBtn} onPress={() => nav.goBack()} hitSlop={12} accessibilityLabel={t('paywall.close')}><Text style={s.xTxt}>×</Text></Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = (c: ThemeColors) => StyleSheet.create({
  c: { flex: 1, backgroundColor: c.bg },
  sheet: { flex: 1 },
  swipeZone: { position: 'absolute', top: 0, left: 0, right: 0, height: 72, alignItems: 'center', paddingTop: 8, zIndex: 20 },
  grabber: { width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.92)' },
  xBtn: { position: 'absolute', top: 10, right: 12, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.38)', zIndex: 30 },
  xTxt: { fontSize: 22, lineHeight: 24, color: '#fff', fontWeight: '700' },
  scroll: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  // 上部ヒーロー: 画面幅いっぱい＋上/左右を余白の外まで出す(edge-to-edge)＝映える大きな一枚。画像は3:2でトリミング無し。
  banner: { alignSelf: 'stretch', marginTop: -spacing.lg, marginHorizontal: -spacing.lg, aspectRatio: 3 / 2, backgroundColor: c.surface },
  title: { fontSize: ty.h1, fontWeight: '800', color: c.ink, textAlign: 'center' },
  subtitle: { fontSize: ty.body, color: c.ink2, textAlign: 'center', lineHeight: 22 },
  benefits: { gap: spacing.sm, marginVertical: spacing.md },
  benefit: { fontSize: ty.body, color: c.ink, textAlign: 'center' },
  soon: { fontSize: ty.body, color: c.mute, textAlign: 'center', marginVertical: spacing.xl },
  pkg: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.blueLight,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
  },
  pkgBusy: { opacity: 0.5 },
  pkgTxt: { flex: 1 },
  pkgPeriod: { fontSize: ty.body, fontWeight: '700', color: c.ink },
  pkgPrice: { fontSize: ty.small, color: c.ink2, marginTop: 2 },
  pkgGo: { fontSize: ty.h1, color: c.blue },
  legal: { fontSize: ty.small, color: c.mute, textAlign: 'center', lineHeight: 18, marginTop: spacing.sm },
  restore: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.sm },
  restoreTxt: { fontSize: ty.body, fontWeight: '700', color: c.blue },
  links: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.sm },
  linkTxt: { fontSize: ty.small, color: c.ink2, textDecorationLine: 'underline' },
  linkSep: { fontSize: ty.small, color: c.mute },
  close: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.sm },
  closeTxt: { fontSize: ty.body, color: c.mute },
});
