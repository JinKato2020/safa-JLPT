// 模試イントロ。試験タブの「模試」をタップ→いきなり始めず、まずこの画面で説明。
// 上=ちび和風ファンタジーの試験会場イラスト(虎鶴の金屏風)／下=説明チップ＋[模試を始める]。
import { View, Text, ImageBackground, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppState } from '../store/store';
import { mockTicketCount } from '../store/tickets';
import { useT } from '../i18n';
import type { Level } from '../engine/engine';
import type { RootStackParamList } from '../navigation/types';

const TOP = require('../../assets/mock/mock_intro_top.png');
type Nav = NativeStackNavigationProp<RootStackParamList>;

// 級別の目安(本番JLPTの試験時間=分・合格点)。模試の心構え用の参考値。表示文言はi18n。
const MOCK_INFO: Record<Level, { min: number; pass: string }> = {
  N5: { min: 105, pass: '80/180' },
  N4: { min: 125, pass: '90/180' },
  N3: { min: 140, pass: '95/180' },
};

export default function MockIntroScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'MockIntro'>>();
  const state = useAppState();
  const t = useT();
  const { height } = useWindowDimensions();
  const level = (state.settings.level as Level) ?? 'N5';
  const info = MOCK_INFO[level] ?? MOCK_INFO.N5;
  const tickets = mockTicketCount(state);
  const illusH = Math.round(height * 0.60);

  const chips = [
    { ico: '🗓', label: t('mockintro.chip_pace'), val: t('mockintro.pace_val') },
    { ico: '⏱', label: t('mockintro.chip_time'), val: t('mockintro.time_val', { n: info.min }) },
    { ico: '🎯', label: t('mockintro.chip_pass'), val: info.pass },
  ];

  return (
    <View style={s.c}>
      {/* 上=イラスト */}
      <ImageBackground source={TOP} style={{ height: illusH }} resizeMode="cover">
        <View style={s.fade} />
        <SafeAreaView edges={['top']}>
          <View style={s.head}>
            <Pressable onPress={() => nav.goBack()} hitSlop={12} style={s.x}><Text style={s.xTxt}>×</Text></Pressable>
          </View>
        </SafeAreaView>
        <View style={s.titleWrap}>
          <Text style={s.title}>{t('mockintro.title')}</Text>
          <Text style={s.subt}>{t('mockintro.subtitle')}</Text>
        </View>
      </ImageBackground>

      {/* 下=説明 */}
      <SafeAreaView style={s.info} edges={['bottom']}>
        <View style={s.chips}>
          {chips.map((ch) => (
            <View key={ch.label} style={s.chip}>
              <Text style={s.chipIco}>{ch.ico}</Text>
              <Text style={s.chipLbl}>{ch.label}</Text>
              <Text style={s.chipVal}>{ch.val}</Text>
            </View>
          ))}
        </View>
        <Text style={s.note}>{t('mockintro.note', { level })}</Text>
        <View style={s.ticketRow}>
          <Text style={s.ticketTxt}>{t('mockintro.tickets', { n: tickets })}</Text>
        </View>
        {/* [また今度][模試を始める]を横並びにして下端で見切れないように */}
        <View style={s.btnRow}>
          <Pressable style={s.later} onPress={() => nav.goBack()}><Text style={s.laterTxt}>{t('mockintro.later')}</Text></Pressable>
          <Pressable style={s.start} onPress={() => nav.replace('Mock', { full: route.params?.full ?? true })}>
            <Text style={s.startTxt}>{t('mockintro.start')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const CREAM = '#f5ead6';
const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: CREAM },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 56, backgroundColor: 'transparent' },
  head: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 12, paddingTop: 6 },
  x: { width: 36, height: 36, borderRadius: 999, backgroundColor: 'rgba(30,22,14,0.5)', alignItems: 'center', justifyContent: 'center' },
  xTxt: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: -2 },
  titleWrap: { position: 'absolute', left: 0, right: 0, bottom: 14, alignItems: 'center' },
  title: { color: '#fff', fontSize: 26, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 8 },
  subt: { color: '#fbeede', fontSize: 13, marginTop: 2, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 },
  info: { flex: 1, paddingHorizontal: 18, paddingTop: 12, backgroundColor: CREAM },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1, backgroundColor: '#fffdf7', borderWidth: 1, borderColor: 'rgba(180,140,80,0.35)', borderRadius: 14, paddingVertical: 9, paddingHorizontal: 6, alignItems: 'center' },
  chipIco: { fontSize: 18 },
  chipLbl: { fontSize: 10, color: '#a5732f', fontWeight: '800', marginTop: 2 },
  chipVal: { fontSize: 13, color: '#5a3d22', fontWeight: '900', marginTop: 1, fontVariant: ['tabular-nums'] },
  note: { fontSize: 12.5, color: '#7a5a34', lineHeight: 19, textAlign: 'center', marginTop: 12 },
  ticketRow: { alignSelf: 'center', marginTop: 12, backgroundColor: '#fffdf7', borderWidth: 1, borderColor: 'rgba(180,140,80,0.35)', borderRadius: 999, paddingVertical: 7, paddingHorizontal: 16 },
  ticketTxt: { fontSize: 13, color: '#7a5a34', fontWeight: '800' },
  ticketN: { color: '#c8894a', fontSize: 15, fontWeight: '900', fontVariant: ['tabular-nums'] },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 'auto', paddingTop: 12, paddingBottom: 4, alignItems: 'stretch' },
  start: { flex: 1, backgroundColor: '#c8894a', borderRadius: 16, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', shadowColor: '#a06e32', shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  startTxt: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  later: { paddingHorizontal: 22, borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(180,140,80,0.5)', backgroundColor: '#fffdf7', alignItems: 'center', justifyContent: 'center' },
  laterTxt: { color: '#9a6a3a', fontSize: 14, fontWeight: '800' },
});
