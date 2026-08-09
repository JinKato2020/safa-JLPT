// 模試イントロ「N◯模試に挑戦」。試験タブの「模試」をタップ→いきなり始めず、1画面で説明してから開始。
//  1画面に: 大きなイラスト(全体表示)＋(試験時間/合格の目安/足切り＋各分野の制限時間)＋チケット残数＋[また今度][模試を始める]。
//  背景・文字・カードはアプリのライト/ダークテーマに統一(useColors)。
import { useMemo } from 'react';
import { View, Text, Image, Pressable, StyleSheet, ScrollView, useWindowDimensions, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppState } from '../store/store';
import { mockTicketCount } from '../store/tickets';
import { useT } from '../i18n';
import { useColors, type ThemeColors } from '../theme';
import type { Level } from '../engine/engine';
import type { RootStackParamList } from '../navigation/types';

const TOP = require('../../assets/mock/mock_intro_top.jpg');
type Nav = NativeStackNavigationProp<RootStackParamList>;

// 級別の目安(本番JLPTの試験時間=分・合格点・各科目の足切り=基準点)。模試の心構え用の参考値。
// 試験時間(min)＝現行(2022年改定後)の合計。各分野(cutoff)の time は試験科目の時間で、合計=min になる。
//  ※N3の「言語知識(30分)/読解(70分)」は試験科目(文字語彙/文法・読解)の時間割り当て。文法の採点は言語知識側。
const MOCK_INFO: Record<Level, { min: number; pass: string; cutoff: { label: string; val: string; time: string }[] }> = {
  N5: { min: 90,  pass: '80/180', cutoff: [{ label: '言語知識・読解', val: '38/120', time: '60分' }, { label: '聴解', val: '19/60', time: '30分' }] },
  N4: { min: 115, pass: '90/180', cutoff: [{ label: '言語知識・読解', val: '38/120', time: '80分' }, { label: '聴解', val: '19/60', time: '35分' }] },
  N3: { min: 140, pass: '95/180', cutoff: [{ label: '言語知識', val: '19/60', time: '30分' }, { label: '読解', val: '19/60', time: '70分' }, { label: '聴解', val: '19/60', time: '40分' }] },
};

export default function MockIntroScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'MockIntro'>>();
  const state = useAppState();
  const t = useT();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const level = (state.settings.level as Level) ?? 'N5';
  const info = MOCK_INFO[level] ?? MOCK_INFO.N5;
  const tickets = mockTicketCount(state);
  const unlimitedMock = state.settings.devUnlimitedMock === true;
  // チケットが無い時は模試を始めさせない(開発用の無制限モードは除く)。
  const begin = () => {
    if (!unlimitedMock && tickets <= 0) { Alert.alert(t('mock.no_ticket_title'), t('mock.no_ticket_body')); return; }
    nav.replace('Mock', { full: route.params?.full ?? true });
  };
  // 模試イラストは「全体表示(トリムなし)」。幅いっぱいの縦横比で出し、画面に収まるよう高さは60%で頭打ち。
  const topSrc = Image.resolveAssetSource(TOP);
  const topAsp = (topSrc?.width && topSrc?.height) ? topSrc.width / topSrc.height : 0.755;
  const imgH = Math.min(Math.round(width / topAsp), Math.round(height * 0.60));
  // アイコンは表示しない(ユーザー要望)。ラベル＋値だけ。
  const chips = [
    { label: t('mockintro.chip_pace'), val: t('mockintro.pace_val') },
    { label: t('mockintro.chip_time'), val: t('mockintro.time_val', { n: info.min }) },
    { label: t('mockintro.chip_pass'), val: info.pass },
  ];

  return (
    <View style={s.c}>
      {/* 模試イラストを全体表示(トリムなし・画面に収まる高さ)。×は画像上に重ねる。 */}
      <View style={s.imgWrap}>
        <Image source={TOP} style={{ width: '100%', height: imgH }} resizeMode="contain" />
        <SafeAreaView edges={['top']} style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <View style={s.head}>
            <Pressable onPress={() => nav.goBack()} hitSlop={12} style={s.x}><Text style={s.xTxt}>×</Text></Pressable>
          </View>
        </SafeAreaView>
      </View>

      {/* 画像以外の情報(チケット残数・ボタン含む)はここをスクロールして表示。 */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.detailBody, { paddingBottom: 20 + insets.bottom }]}>
        <Text style={s.titleC}>{level}{t('mockintro.title')}</Text>
        <Text style={s.subtC}>{t('mockintro.subtitle')}</Text>

        <View style={s.chips}>
          {chips.map((ch) => (
            <View key={ch.label} style={s.chip}>
              <Text style={s.chipLbl}>{ch.label}</Text>
              <Text style={s.chipVal}>{ch.val}</Text>
            </View>
          ))}
        </View>

        {/* 足切り(基準点)＋各分野の制限時間: 合計が足りても1科目でも基準未満なら不合格。 */}
        <View style={s.cutoffCard}>
          <Text style={s.cutoffTitle}>{t('mockintro.cutoff_title')}</Text>
          <View style={s.cutoffRows}>
            <View style={s.cutoffHead}>
              <Text style={s.cutoffHeadL}>分野</Text>
              <Text style={s.cutoffHeadC}>制限時間</Text>
              <Text style={s.cutoffHeadC}>基準点</Text>
            </View>
            {info.cutoff.map((cu) => (
              <View key={cu.label} style={s.cutoffRow}>
                <Text style={s.cutoffLbl}>{cu.label}</Text>
                <Text style={s.cutoffTime}>{cu.time}</Text>
                <Text style={s.cutoffVal}>{cu.val}</Text>
              </View>
            ))}
          </View>
          <Text style={s.cutoffDesc}>{t('mockintro.cutoff_desc')}</Text>
        </View>

        {/* 模試チケット残数は「模試を始める」ボタンのすぐ上に置く(ボタンごとスクロール表示)。 */}
        <Text style={s.ticketAbove}>{unlimitedMock ? '模試チケット：無制限（開発）' : t('mockintro.tickets', { n: tickets })}</Text>
        <View style={s.btnRow}>
          <Pressable style={s.later} onPress={() => nav.goBack()}><Text style={s.laterTxt}>{t('mockintro.later')}</Text></Pressable>
          <Pressable style={s.start} onPress={begin}><Text style={s.startTxt}>{t('mockintro.start')}</Text></Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  c: { flex: 1, backgroundColor: c.bg },
  imgWrap: { width: '100%', backgroundColor: '#2a1f14' }, // 画像の余白(レターボックス)は絵の縁に合う暗色で固定
  head: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 12, paddingTop: 6 },
  x: { width: 36, height: 36, borderRadius: 999, backgroundColor: 'rgba(20,16,10,0.55)', alignItems: 'center', justifyContent: 'center' },
  xTxt: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: -2 },
  detailBody: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 20 },
  titleC: { fontSize: 24, fontWeight: '900', color: c.ink, textAlign: 'center' },
  subtC: { fontSize: 13, color: c.mute, fontWeight: '700', textAlign: 'center', marginTop: 3, marginBottom: 6 },
  chips: { flexDirection: 'row', gap: 8, marginTop: 8 },
  chip: { flex: 1, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center' },
  chipLbl: { fontSize: 10, color: c.mute, fontWeight: '800' },
  chipVal: { fontSize: 13, color: c.ink, fontWeight: '900', marginTop: 2, fontVariant: ['tabular-nums'] },
  cutoffCard: { marginTop: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 16, padding: 14 },
  cutoffTitle: { fontSize: 15, fontWeight: '900', color: c.ink },
  cutoffRows: { marginTop: 10, gap: 6 },
  cutoffHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, marginBottom: 2 },
  cutoffHeadL: { flex: 1, fontSize: 11, color: c.faint, fontWeight: '800' },
  cutoffHeadC: { width: 66, textAlign: 'right', fontSize: 11, color: c.faint, fontWeight: '800' },
  cutoffRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.bgSoft, borderRadius: 9, paddingVertical: 8, paddingHorizontal: 12 },
  cutoffLbl: { flex: 1, fontSize: 13, color: c.ink, fontWeight: '800' },
  cutoffTime: { width: 66, textAlign: 'right', fontSize: 13, color: c.ink2, fontWeight: '800', fontVariant: ['tabular-nums'] },
  cutoffVal: { width: 66, textAlign: 'right', fontSize: 14, color: c.blue, fontWeight: '900', fontVariant: ['tabular-nums'] },
  cutoffDesc: { fontSize: 12.5, color: c.mute, lineHeight: 19, marginTop: 10 },
  ticketAbove: { fontSize: 13, color: c.ink2, fontWeight: '800', textAlign: 'center', marginTop: 18, marginBottom: 8 },
  btnRow: { flexDirection: 'row', gap: 10, paddingTop: 4, paddingBottom: 4, alignItems: 'stretch' },
  start: { flex: 1, backgroundColor: c.blue, borderRadius: 16, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  startTxt: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  later: { paddingHorizontal: 22, borderRadius: 16, borderWidth: 1.5, borderColor: c.line, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' },
  laterTxt: { color: c.ink2, fontSize: 14, fontWeight: '800' },
});
