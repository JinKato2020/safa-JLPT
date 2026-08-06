// 模試イントロ。試験タブの「模試」をタップ→いきなり始めず、まず2ステップで説明。
//  1) 入口: 大きなイラスト＋チケット残数＋[また今度][模試を始める] だけ(情報は最小)。
//  2) 詳細: 試験時間・合格の目安・足切り(基準点)を伝えてから、本当に開始。
import { useState } from 'react';
import { View, Text, ImageBackground, Pressable, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
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

// 級別の目安(本番JLPTの試験時間=分・合格点・各科目の足切り=基準点)。模試の心構え用の参考値。
const MOCK_INFO: Record<Level, { min: number; pass: string; cutoff: { label: string; val: string }[] }> = {
  N5: { min: 105, pass: '80/180', cutoff: [{ label: '言語知識・読解', val: '38/120' }, { label: '聴解', val: '19/60' }] },
  N4: { min: 125, pass: '90/180', cutoff: [{ label: '言語知識・読解', val: '38/120' }, { label: '聴解', val: '19/60' }] },
  N3: { min: 140, pass: '95/180', cutoff: [{ label: '言語知識', val: '19/60' }, { label: '読解', val: '19/60' }, { label: '聴解', val: '19/60' }] },
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
  const [step, setStep] = useState<'intro' | 'detail'>('intro');
  const begin = () => nav.replace('Mock', { full: route.params?.full ?? true });

  // ── 1) 入口: イラスト＋チケット残数＋2ボタンだけ ──
  if (step === 'intro') {
    const illusH = Math.round(height * 0.62);
    return (
      <View style={s.c}>
        <ImageBackground source={TOP} style={{ height: illusH }} resizeMode="cover">
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

        <SafeAreaView style={s.info} edges={['bottom']}>
          <View style={s.ticketRow}>
            <Text style={s.ticketTxt}>{t('mockintro.tickets', { n: tickets })}</Text>
          </View>
          <View style={s.btnRow}>
            <Pressable style={s.later} onPress={() => nav.goBack()}><Text style={s.laterTxt}>{t('mockintro.later')}</Text></Pressable>
            <Pressable style={s.start} onPress={() => setStep('detail')}>
              <Text style={s.startTxt}>{t('mockintro.start')}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ── 2) 詳細: 試験時間・合格の目安・足切り(基準点)を伝えてから開始 ──
  const chips = [
    { ico: '🗓', label: t('mockintro.chip_pace'), val: t('mockintro.pace_val') },
    { ico: '⏱', label: t('mockintro.chip_time'), val: t('mockintro.time_val', { n: info.min }) },
    { ico: '🎯', label: t('mockintro.chip_pass'), val: info.pass },
  ];
  return (
    <View style={s.c}>
      <SafeAreaView edges={['top']}>
        <View style={s.detailHead}>
          <Pressable onPress={() => setStep('intro')} hitSlop={12} style={s.backBtn}><Text style={s.backTxt}>‹ {t('mockintro.back')}</Text></Pressable>
        </View>
      </SafeAreaView>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.detailBody}>
        <Text style={s.detailTitle}>{t('mockintro.detail_title')}</Text>
        <Text style={s.detailSub}>{t('mockintro.detail_sub')}</Text>

        <View style={s.chips}>
          {chips.map((ch) => (
            <View key={ch.label} style={s.chip}>
              <Text style={s.chipIco}>{ch.ico}</Text>
              <Text style={s.chipLbl}>{ch.label}</Text>
              <Text style={s.chipVal}>{ch.val}</Text>
            </View>
          ))}
        </View>

        {/* 足切り(基準点): 合計が足りても1科目でも基準未満なら不合格 */}
        <View style={s.cutoffCard}>
          <Text style={s.cutoffTitle}>⚠️ {t('mockintro.cutoff_title')}</Text>
          <View style={s.cutoffRows}>
            {info.cutoff.map((cu) => (
              <View key={cu.label} style={s.cutoffRow}>
                <Text style={s.cutoffLbl}>{cu.label}</Text>
                <Text style={s.cutoffVal}>{cu.val}</Text>
              </View>
            ))}
          </View>
          <Text style={s.cutoffDesc}>{t('mockintro.cutoff_desc')}</Text>
        </View>

        <Text style={s.note}>{t('mockintro.note', { level })}</Text>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={{ paddingHorizontal: 18 }}>
        <View style={s.btnRow}>
          <Pressable style={s.later} onPress={() => setStep('intro')}><Text style={s.laterTxt}>{t('mockintro.back')}</Text></Pressable>
          <Pressable style={s.start} onPress={begin}><Text style={s.startTxt}>{t('mockintro.start')}</Text></Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const CREAM = '#f5ead6';
const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: CREAM },
  head: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 12, paddingTop: 6 },
  x: { width: 36, height: 36, borderRadius: 999, backgroundColor: 'rgba(30,22,14,0.5)', alignItems: 'center', justifyContent: 'center' },
  xTxt: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: -2 },
  titleWrap: { position: 'absolute', left: 0, right: 0, bottom: 14, alignItems: 'center' },
  title: { color: '#fff', fontSize: 26, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 8 },
  subt: { color: '#fbeede', fontSize: 13, marginTop: 2, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 },
  info: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 4, backgroundColor: CREAM },
  ticketRow: { alignSelf: 'center', marginBottom: 12, backgroundColor: '#fffdf7', borderWidth: 1, borderColor: 'rgba(180,140,80,0.35)', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 18 },
  ticketTxt: { fontSize: 14, color: '#7a5a34', fontWeight: '800' },
  // 詳細画面
  detailHead: { flexDirection: 'row', paddingHorizontal: 10, paddingTop: 6 },
  backBtn: { paddingVertical: 6, paddingHorizontal: 6 },
  backTxt: { color: '#9a6a3a', fontSize: 15, fontWeight: '800' },
  detailBody: { paddingHorizontal: 18, paddingBottom: 20 },
  detailTitle: { fontSize: 22, fontWeight: '900', color: '#5a3d22', textAlign: 'center', marginTop: 4 },
  detailSub: { fontSize: 13, color: '#9a6a3a', fontWeight: '700', textAlign: 'center', marginTop: 3, marginBottom: 16 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1, backgroundColor: '#fffdf7', borderWidth: 1, borderColor: 'rgba(180,140,80,0.35)', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center' },
  chipIco: { fontSize: 18 },
  chipLbl: { fontSize: 10, color: '#a5732f', fontWeight: '800', marginTop: 2 },
  chipVal: { fontSize: 13, color: '#5a3d22', fontWeight: '900', marginTop: 1, fontVariant: ['tabular-nums'] },
  cutoffCard: { marginTop: 14, backgroundColor: '#fffaf0', borderWidth: 1.5, borderColor: 'rgba(200,137,74,0.5)', borderRadius: 16, padding: 14 },
  cutoffTitle: { fontSize: 15, fontWeight: '900', color: '#a5541f' },
  cutoffRows: { marginTop: 10, gap: 6 },
  cutoffRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fffdf7', borderRadius: 9, paddingVertical: 8, paddingHorizontal: 12 },
  cutoffLbl: { fontSize: 13, color: '#5a3d22', fontWeight: '800' },
  cutoffVal: { fontSize: 14, color: '#c8894a', fontWeight: '900', fontVariant: ['tabular-nums'] },
  cutoffDesc: { fontSize: 12.5, color: '#7a5a34', lineHeight: 19, marginTop: 10 },
  note: { fontSize: 12.5, color: '#7a5a34', lineHeight: 19, textAlign: 'center', marginTop: 16 },
  btnRow: { flexDirection: 'row', gap: 10, paddingTop: 12, paddingBottom: 4, alignItems: 'stretch' },
  start: { flex: 1, backgroundColor: '#c8894a', borderRadius: 16, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', shadowColor: '#a06e32', shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  startTxt: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  later: { paddingHorizontal: 22, borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(180,140,80,0.5)', backgroundColor: '#fffdf7', alignItems: 'center', justifyContent: 'center' },
  laterTxt: { color: '#9a6a3a', fontSize: 14, fontWeight: '800' },
});
