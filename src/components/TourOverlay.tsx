// 初回ガイドツアー(画面プレビュー型): 実画面を再現したスクショ(assets/tour/*.png)をスマホ枠で見せ、
// 現行の強みを画面ごとに紹介。ホーム/学習/テスト/辞書 ＋ 締め(アプリアイコン)。手書きモック描画は廃止。
import { useState } from 'react';
import { View, Text, Pressable, Image, ScrollView, StyleSheet, type ImageSourcePropType } from 'react-native';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppActions } from '../store/store';
import { useT } from '../i18n';

type Kind = 'home' | 'study' | 'test' | 'dict' | 'settings' | 'cheer';
type Step = { kind: Kind; titleKey: string; bodyKey: string };

const STEPS: Step[] = [
  { kind: 'home', titleKey: 'tour.home_t', bodyKey: 'tour.home_b' },
  { kind: 'study', titleKey: 'tour.study_t', bodyKey: 'tour.study_b' },
  { kind: 'test', titleKey: 'tour.test_t', bodyKey: 'tour.test_b' },
  { kind: 'dict', titleKey: 'tour.dict_t', bodyKey: 'tour.dict_b' },
  { kind: 'settings', titleKey: 'tour.settings_t', bodyKey: 'tour.settings_b' },
  { kind: 'cheer', titleKey: 'tour.cheer_t', bodyKey: 'tour.cheer_b' },
];

// 実画面再現スクショ。ホームは縦長(540x2225)、他は1画面(540x1170)。スマホ枠で表示。
const TOUR_IMAGES: Partial<Record<Kind, ImageSourcePropType>> = {
  home: require('../../assets/tour/home.png'),
  study: require('../../assets/tour/study.png'),
  test: require('../../assets/tour/test.png'),
  dict: require('../../assets/tour/dict.png'),
  settings: require('../../assets/tour/settings.png'),
};

function Preview({ kind }: { kind: Kind }) {
  if (kind === 'cheer') return <Image source={require('../../assets/icon.png')} style={{ width: 104, height: 104, borderRadius: 22 }} resizeMode="contain" />;
  const src = TOUR_IMAGES[kind];
  if (!src) return null;
  const tall = kind === 'home';
  return (
    <View style={[s2.phone, { width: tall ? 124 : 150, aspectRatio: tall ? 540 / 2225 : 540 / 1170 }]}>
      <Image source={src} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
    </View>
  );
}

const s2 = StyleSheet.create({
  phone: {
    borderRadius: 18, overflow: 'hidden',
    borderWidth: 4, borderColor: '#0f172a', backgroundColor: '#0f172a',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
  },
});

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
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollC} showsVerticalScrollIndicator={false}>
          <Text style={s.kicker}>{t('touroverlay.kicker')}</Text>
          <View style={s.illu}><Preview kind={step.kind} /></View>
          <Text style={s.count}>{i + 1} / {STEPS.length}</Text>
          <Text style={s.title}>{t(step.titleKey)}</Text>
          <Text style={s.body}>{t(step.bodyKey)}</Text>
        </ScrollView>
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
      width: '100%', maxWidth: 360, maxHeight: '100%', backgroundColor: c.surface, borderRadius: radius.xl, padding: spacing.lg,
      alignItems: 'center',
      shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 10,
    },
    scroll: { alignSelf: 'stretch', flexGrow: 0, flexShrink: 1 },
    scrollC: { alignItems: 'center', gap: 5 },
    kicker: { fontSize: ty.tiny, fontWeight: '800', color: c.blue, letterSpacing: 1 },
    illu: { alignItems: 'center', justifyContent: 'center', marginVertical: spacing.sm },
    count: { fontSize: ty.tiny, color: c.faint, fontWeight: '700' },
    title: { fontSize: ty.h2, fontWeight: '800', color: c.ink, textAlign: 'center' },
    body: { fontSize: ty.small, color: c.ink2, lineHeight: 19, textAlign: 'center' },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch', marginTop: spacing.md },
    rrow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    skip: { fontSize: ty.small, color: c.faint, fontWeight: '600' },
    back: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
    backTxt: { fontSize: ty.body, color: c.ink2, fontWeight: '700' },
    next: { backgroundColor: c.blue, borderRadius: radius.pill, paddingVertical: spacing.sm, paddingHorizontal: spacing.xl },
    nextTxt: { color: '#ffffff', fontSize: ty.body, fontWeight: '800' },
  });
