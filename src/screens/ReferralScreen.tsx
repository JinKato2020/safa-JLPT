// 友だち紹介の遷移先画面: 入口イラスト＋「自分の紹介コードを共有する」だけ。
// コード入力(受け取り)はアカウント画面にインライン移設したので、この画面には入力欄を置かない。
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Share, ActivityIndicator, Animated, Image, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useT } from '../i18n';
import { getMyCode } from '../referral/referralClient';

const ENTRANCE = require('../../assets/referral/entrance.jpg'); // 紹介の入口=多様な学習者が一緒に学ぶ絵

export default function ReferralScreen() {
  const t = useT();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const nav = useNavigation();
  const { width: SW } = useWindowDimensions(); // 上端の入口イラストを画面幅いっぱいの大ヒーローで表示

  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 自分の紹介コードをサーバーから取得(無ければ採番)。失敗時は空文字→エラー表示。
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cd = await getMyCode();
      if (!cancelled) { setCode(cd); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  // チケットの淡い発光を呼吸させる(ゆっくり明滅＋ごく僅かな拡大)。
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1600, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 1600, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const glowOp = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.55] });
  const glowSc = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });

  const onShare = async () => {
    if (!code) return;
    try {
      await Share.share({ message: t('referral.share_message', { code }) });
    } catch {
      // 共有シートを閉じただけ等は無視
    }
  };

  return (
    <SafeAreaView style={s.c}>
      <ScrollView contentContainerStyle={s.body}>
        {/* 画像=画面上端いっぱいの大ヒーロー(edge-to-edge)。×は画像に重ねる(まいにちJLPT Pro画面と統一)。 */}
        <Image source={ENTRANCE} style={[s.heroImg, { width: SW, height: SW }]} resizeMode="cover" />
        <View style={s.heroText}>
          <Text style={s.title}>{t('referral.title')}</Text>
          <Text style={s.heroTitle}>{t('referral.headline')}</Text>
          <Text style={s.heroSub}>{t('referral.subhead')}</Text>
        </View>

        {/* 自分の紹介コード=ギフトチケット風＋淡い発光の呼吸。共有ボタン付き。 */}
        <View style={s.ticketWrap}>
          <Animated.View style={[s.ticketGlow, { opacity: glowOp, transform: [{ scale: glowSc }] }]} />
          <View style={s.ticket}>
            <View style={s.ticketTop}><Text style={s.ticketBadge}>🎁 {t('referral.my_code')}</Text></View>
            {loading ? (
              <View style={s.codeLoading}><ActivityIndicator color={c.blue} /><Text style={s.loadingTxt}>{t('referral.code_loading')}</Text></View>
            ) : code ? (
              <>
                <View style={s.codeBox}><Text style={s.codeTxt}>{code}</Text></View>
                <Pressable style={({ pressed }) => [s.shareBtn, pressed && { opacity: 0.9 }]} onPress={onShare}>
                  <Text style={s.shareTxt}>✉️ {t('referral.share')}</Text>
                </Pressable>
              </>
            ) : (
              <Text style={s.errTxt}>{t('referral.code_error')}</Text>
            )}
          </View>
        </View>
      </ScrollView>
      {/* 右上×(画像に重ねる・最前面)=タップで閉じる。Pro画面と統一。 */}
      <Pressable style={s.xBtn} onPress={() => nav.goBack()} hitSlop={12} accessibilityLabel={t('nav.close')}>
        <Text style={s.xTxt}>×</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    c: { flex: 1, backgroundColor: c.bg },
    body: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.lg },
    title: { fontSize: ty.h1, fontWeight: '800', color: c.ink, textAlign: 'center' },
    // 右上×(Pro画面と同じ・画像に重ねる半透明の丸ボタン)。ScrollViewの外・最前面。
    xBtn: { position: 'absolute', top: 10, right: 12, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.38)', zIndex: 30 },
    xTxt: { fontSize: 22, lineHeight: 24, color: '#fff', fontWeight: '700' },

    // 上端ヒーロー: 画面幅いっぱい＋上/左右を余白の外まで出す(edge-to-edge)。実寸(幅=画面幅・正方形)はJSXで指定。
    heroImg: { marginTop: -spacing.lg, marginHorizontal: -spacing.lg, marginBottom: spacing.sm, backgroundColor: c.surface },
    heroText: { alignItems: 'center', gap: 8, marginBottom: spacing.xs },
    heroTitle: { fontSize: ty.h2, fontWeight: '900', color: c.ink, lineHeight: 30, textAlign: 'center' },
    heroSub: { fontSize: ty.body, fontWeight: '700', color: c.ink2, lineHeight: 22, textAlign: 'center' },

    // ギフトチケット＋発光
    ticketWrap: { marginTop: spacing.xs },
    ticketGlow: { position: 'absolute', top: 10, left: 18, right: 18, bottom: 2, borderRadius: radius.lg, backgroundColor: c.blue },
    ticket: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 2, borderColor: c.blue, borderStyle: 'dashed', padding: spacing.md, gap: spacing.sm },
    ticketTop: { alignItems: 'center' },
    ticketBadge: { fontSize: ty.small, fontWeight: '900', color: c.blueDark, letterSpacing: 0.5 },
    codeLoading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, justifyContent: 'center' },
    loadingTxt: { fontSize: ty.small, color: c.mute },
    errTxt: { fontSize: ty.small, color: c.red, lineHeight: 19, textAlign: 'center' },
    codeBox: { alignItems: 'center', paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: c.blueLight },
    codeTxt: { fontSize: ty.h1, fontWeight: '900', letterSpacing: 6, color: c.blueDark },
    shareBtn: { alignItems: 'center', paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: c.blue },
    shareTxt: { fontSize: ty.body, fontWeight: '800', color: '#fff' },
  });
