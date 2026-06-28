// 初回ガイドツアー: オンボーディング後、各機能を順番に説明。
// 各ステップの見本= アプリ実画面をHTMLで再現→スクショした画像(assets/tour/*.png)。
// 白カード地なのでライト/ダーク両テーマで可読。手書きモック描画はやめ実物の見た目に統一。cheerのみ絵文字。
import { useState } from 'react';
import { View, Text, Pressable, Image, StyleSheet, type ImageSourcePropType } from 'react-native';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppActions } from '../store/store';
import { useT } from '../i18n';

type Kind = 'gauge' | 'growth' | 'rings' | 'today' | 'streak' | 'study' | 'test' | 'dict' | 'cheer';
type Step = { kind: Kind; titleKey: string; bodyKey: string };

const STEPS: Step[] = [
  { kind: 'gauge', titleKey: 'touroverlay.step_gauge_title', bodyKey: 'touroverlay.step_gauge_body' },
  { kind: 'growth', titleKey: 'touroverlay.step_growth_title', bodyKey: 'touroverlay.step_growth_body' },
  { kind: 'rings', titleKey: 'touroverlay.step_rings_title', bodyKey: 'touroverlay.step_rings_body' },
  { kind: 'today', titleKey: 'touroverlay.step_today_title', bodyKey: 'touroverlay.step_today_body' },
  { kind: 'streak', titleKey: 'touroverlay.step_streak_title', bodyKey: 'touroverlay.step_streak_body' },
  { kind: 'study', titleKey: 'touroverlay.step_study_title', bodyKey: 'touroverlay.step_study_body' },
  { kind: 'test', titleKey: 'touroverlay.step_test_title', bodyKey: 'touroverlay.step_test_body' },
  { kind: 'dict', titleKey: 'touroverlay.step_dict_title', bodyKey: 'touroverlay.step_dict_body' },
  { kind: 'cheer', titleKey: 'touroverlay.step_cheer_title', bodyKey: 'touroverlay.step_cheer_body' },
];

// 実画面再現スクショ(白カード=テーマ非依存)。1枚 420x230 比率。
const TOUR_IMAGES: Partial<Record<Kind, ImageSourcePropType>> = {
  gauge: require('../../assets/tour/gauge.png'),
  growth: require('../../assets/tour/growth.png'),
  rings: require('../../assets/tour/rings.png'),
  today: require('../../assets/tour/today.png'),
  streak: require('../../assets/tour/streak.png'),
  study: require('../../assets/tour/study.png'),
  test: require('../../assets/tour/test.png'),
  dict: require('../../assets/tour/dict.png'),
};

function Illustration({ kind }: { kind: Kind }) {
  if (kind === 'cheer') return <Text style={{ fontSize: 64 }}>🌸</Text>;
  const src = TOUR_IMAGES[kind];
  if (!src) return null;
  return <Image source={src} style={{ width: '100%', aspectRatio: 420 / 230 }} resizeMode="contain" />;
}

export default function TourOverlay() {
  const t = useT();
  const c = useColors();
  const s = makeStyles(c);
  const { setSettings } = useAppActions();
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i + 1 >= STEPS.length;
  const finish = () => setSettings({ tourDone: true });

  return (
    <View style={s.overlay} pointerEvents="auto">
      <View style={s.card}>
        <Text style={s.kicker}>{t('touroverlay.kicker')}</Text>
        <View style={s.illu}><Illustration kind={step.kind} /></View>
        <Text style={s.count}>{i + 1} / {STEPS.length}</Text>
        <Text style={s.title}>{t(step.titleKey)}</Text>
        <Text style={s.body}>{t(step.bodyKey)}</Text>
        <View style={s.row}>
          <Pressable onPress={finish} hitSlop={8}><Text style={s.skip}>{t('touroverlay.skip')}</Text></Pressable>
          <View style={s.rrow}>
            {i > 0 && <Pressable onPress={() => setI(i - 1)} hitSlop={8} style={s.back}><Text style={s.backTxt}>{t('touroverlay.back')}</Text></Pressable>}
            <Pressable style={s.next} onPress={() => (last ? finish() : setI(i + 1))}>
              <Text style={s.nextTxt}>{last ? t('touroverlay.start') : t('touroverlay.next')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(8,12,24,0.62)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg,
    },
    card: {
      width: '100%', maxWidth: 380, backgroundColor: c.surface, borderRadius: radius.xl, padding: spacing.lg,
      alignItems: 'center', gap: 6,
      shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 10,
    },
    kicker: { fontSize: ty.tiny, fontWeight: '800', color: c.blue, letterSpacing: 1 },
    illu: { alignSelf: 'stretch', minHeight: 130, alignItems: 'center', justifyContent: 'center', marginVertical: spacing.sm },
    count: { fontSize: ty.tiny, color: c.faint, fontWeight: '700' },
    title: { fontSize: ty.h1, fontWeight: '800', color: c.ink, textAlign: 'center' },
    body: { fontSize: ty.body, color: c.ink2, lineHeight: 22, textAlign: 'center' },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch', marginTop: spacing.md },
    rrow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    skip: { fontSize: ty.small, color: c.faint, fontWeight: '600' },
    back: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
    backTxt: { fontSize: ty.body, color: c.ink2, fontWeight: '700' },
    next: { backgroundColor: c.blue, borderRadius: radius.pill, paddingVertical: spacing.sm, paddingHorizontal: spacing.xl },
    nextTxt: { color: '#ffffff', fontSize: ty.body, fontWeight: '800' },
  });
