// 結果カード共有: 予想得点リング＋この7日の伸び＋紹介コード/QR/CTA を縦9:16のカードに描き、
// react-native-view-shot で画像化 → expo-sharing で共有する。入口=AIコーチ(上部の共有アイコン)。
// ネイティブ依存(view-shot/qrcode-svg)ゆえ OTA では届かず、次のネイティブビルドで反映される。
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Image, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import QRCode from 'react-native-qrcode-svg';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useT } from '../i18n';
import { useAppState } from '../store/store';
import { homeStatus } from '../home/homeStatus';
import { weekGain } from '../home/growthStats';
import { dayStr } from '../store/state';
import { avatarOf } from '../plaza/avatars';
import { getMyCode } from '../referral/referralClient';
import RingGauge from '../components/RingGauge';

// 紹介ランディング(GitHub Pages)。web/r/index.html を build-jlpt.yml が /r/ へ配置。
// QR/リンク=このURL＋?code=<自分の紹介コード>。既存の招待ページ(/invite/)と同じ流儀。
const REF_BASE = 'https://jinkato2020.github.io/safa-JLPT/r/';

export default function ShareCardScreen() {
  const t = useT();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const nav = useNavigation();
  const state = useAppState();
  const { width: SW } = useWindowDimensions();

  // カードは縦9:16固定。画面幅に収めつつ最大340pxで、撮影時に1080×1920へ拡大する。
  const cardW = Math.min(SW - spacing.lg * 2, 340);
  const cardH = Math.round((cardW * 16) / 9);

  const cardRef = useRef<View>(null);
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 自分の紹介コードを取得(無ければ採番)。取得できるまで共有ボタンは待たせる。
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try { const cd = await getMyCode(); if (!cancelled) setCode(cd || ''); }
      catch { if (!cancelled) setCode(''); }
    })();
    return () => { cancelled = true; };
  }, []);

  const d = useMemo(() => {
    const now = Date.now();
    const st = homeStatus(state, now);
    const wg = weekGain(state, dayStr(now), 7);
    return { st, wg };
  }, [state]);

  const { st, wg } = d;
  const levelLabel = (state.settings.targetExam ?? 'jlpt') === 'jft' ? 'JFT' : state.settings.level;
  const scorePct = st.predMax > 0 ? Math.round((st.predScore / st.predMax) * 100) : 0;
  const goalPct = st.predMax > 0 ? Math.round((st.passTotal / st.predMax) * 100) : 50;
  const cleared = st.predScore >= st.passTotal && st.passTotal > 0;
  const scoreColor = cleared ? c.green : c.amber;
  const myAvatar = avatarOf(state.settings.avatar).image;
  const refUrl = REF_BASE + '?code=' + encodeURIComponent(code ?? '');

  const onShare = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // カードViewを1080×1920のPNGへ焼き、共有シートを開く。
      const uri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile', width: 1080, height: 1920 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: t('share.dialog'), UTI: 'public.png' });
      }
    } catch {
      // 共有シートを閉じただけ等は無視
    } finally {
      setBusy(false);
    }
  };

  const codeReady = code !== null && code !== '';

  return (
    <SafeAreaView style={s.c} edges={['top', 'bottom']}>
      <View style={s.head}>
        <Text style={s.headTitle}>{t('share.title')}</Text>
        <Pressable onPress={() => nav.goBack()} hitSlop={12}><Ionicons name="close" size={24} color={c.mute} /></Pressable>
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        {/* ▼ここから下(cardRef)が画像として焼かれる。地色は必ず不透明にする。 */}
        <View ref={cardRef} collapsable={false} style={[s.card, { width: cardW, height: cardH }]}>
          {/* ブランド */}
          <View style={s.brandRow}>
            <View style={s.sigil}><Ionicons name="sparkles" size={13} color="#fff" /></View>
            <Text style={s.brandT}>まいにちJLPT</Text>
          </View>

          {/* 見出し */}
          <Text style={s.eyebrow}>{t('share.eyebrow')}</Text>

          {/* 主役=予想得点リング。左横に自分のアバター。｜印=合格ライン。 */}
          <View style={s.ringRow}>
            {myAvatar != null && <Image source={myAvatar} style={s.avatar} resizeMode="contain" />}
            <RingGauge value={scorePct} color={scoreColor} size={Math.round(cardW * 0.44)} stroke={12} mark={goalPct}>
              <View style={[s.ringLevel, { backgroundColor: scoreColor }]}><Text style={s.ringLevelT}>{levelLabel}</Text></View>
              <Text style={[s.ringBig, { color: scoreColor }]}>{st.predScore}<Text style={s.ringPct}>/{st.predMax}</Text></Text>
              <Text style={s.ringCap}>{t('share.pred_score')}</Text>
            </RingGauge>
          </View>
          <Text style={s.passLine}>{t('share.pass_line', { n: st.passTotal })}</Text>

          {/* この7日の伸び(＋点)。伸びていなければ継続の一言。 */}
          <View style={s.growth}>
            <Ionicons name={wg > 0 ? 'trending-up' : 'flame'} size={16} color={wg > 0 ? c.green : c.amber} />
            <Text style={s.growthT}>{wg > 0 ? t('share.week_gain', { n: wg }) : t('share.steady')}</Text>
          </View>

          <View style={s.spacer} />

          {/* 下部=紹介ブロック。コード＋QR＋CTA。 */}
          <View style={s.refBlock}>
            <Text style={s.refLead}>{t('share.ref_lead')}</Text>
            <View style={s.refRow}>
              <View style={s.refLeft}>
                <Text style={s.refCodeLabel}>{t('share.your_code')}</Text>
                <Text style={s.refCode}>{code || '····'}</Text>
                <Text style={s.refScan}>{t('share.scan_hint')}</Text>
              </View>
              <View style={s.qrBox}>
                {codeReady
                  ? <QRCode value={refUrl} size={Math.round(cardW * 0.24)} color={c.ink} backgroundColor="#ffffff" />
                  : <ActivityIndicator color={c.blue} />}
              </View>
            </View>
          </View>
        </View>
        {/* ▲ここまでが画像。以下は撮影されない操作ボタン。 */}

        <Pressable
          style={({ pressed }) => [s.shareBtn, (!codeReady || busy) && s.shareOff, pressed && { opacity: 0.9 }]}
          onPress={onShare}
          disabled={!codeReady || busy}
        >
          {busy
            ? <ActivityIndicator color="#fff" />
            : <><Ionicons name="share-outline" size={18} color="#fff" /><Text style={s.shareTxt}>{t('share.cta_share')}</Text></>}
        </Pressable>
        {!codeReady && <Text style={s.codeLoading}>{t('share.code_loading')}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    c: { flex: 1, backgroundColor: c.bg },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
    headTitle: { fontSize: ty.h2, fontWeight: '800', color: c.ink },
    body: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },

    // カード(焼き付け対象)
    card: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, alignItems: 'center', overflow: 'hidden' },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    sigil: { width: 22, height: 22, borderRadius: 11, backgroundColor: c.blue, alignItems: 'center', justifyContent: 'center' },
    brandT: { fontSize: ty.body, fontWeight: '800', color: c.ink },
    eyebrow: { fontSize: ty.small, color: c.mute, fontWeight: '700', marginTop: spacing.sm, marginBottom: spacing.xs, textAlign: 'center' },

    ringRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.xs },
    avatar: { width: 54, height: 54 },
    ringLevel: { paddingHorizontal: 10, paddingVertical: 2, borderRadius: 999, marginBottom: 2 },
    ringLevelT: { color: '#fff', fontSize: ty.small, fontWeight: '900' },
    ringBig: { fontSize: 30, fontWeight: '900' },
    ringPct: { fontSize: ty.body, fontWeight: '800', color: c.mute },
    ringCap: { fontSize: ty.tiny, color: c.mute, fontWeight: '700' },
    passLine: { fontSize: ty.small, color: c.mute, fontWeight: '700', marginTop: spacing.sm, textAlign: 'center' },

    growth: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm, backgroundColor: c.blueLight, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 999 },
    growthT: { fontSize: ty.small, fontWeight: '800', color: c.blueDark },

    spacer: { flex: 1 },

    refBlock: { width: '100%', borderTopWidth: 1, borderTopColor: c.line, paddingTop: spacing.md },
    refLead: { fontSize: ty.small, fontWeight: '800', color: c.ink, textAlign: 'center', marginBottom: spacing.sm },
    refRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
    refLeft: { flex: 1 },
    refCodeLabel: { fontSize: ty.tiny, color: c.mute, fontWeight: '700' },
    refCode: { fontSize: ty.h1, fontWeight: '900', letterSpacing: 3, color: c.blueDark, marginVertical: 2 },
    refScan: { fontSize: ty.tiny, color: c.faint, fontWeight: '600' },
    qrBox: { backgroundColor: '#fff', padding: 6, borderRadius: radius.sm, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },

    // 操作(非撮影)
    shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: c.blue, paddingVertical: 15, borderRadius: 999, marginTop: spacing.lg, width: '100%', maxWidth: 340 },
    shareOff: { opacity: 0.5 },
    shareTxt: { color: '#fff', fontSize: ty.h2, fontWeight: '800' },
    codeLoading: { fontSize: ty.small, color: c.mute, marginTop: spacing.sm },
  });
}
