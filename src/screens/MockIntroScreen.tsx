// 模試イントロ。試験タブの「模試」をタップ→いきなり始めず、まずこの画面で説明。
// 上=ちび和風ファンタジーの試験会場イラスト(虎鶴の金屏風)／下=説明チップ＋[模試を始める]。
import { View, Text, ImageBackground, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppState } from '../store/store';
import type { Level } from '../engine/engine';
import type { RootStackParamList } from '../navigation/types';

const TOP = require('../../assets/mock/mock_intro_top.png');
type Nav = NativeStackNavigationProp<RootStackParamList>;

// 級別の目安(本番JLPTの試験時間・合格点)。模試の心構え用の参考値。
const MOCK_INFO: Record<Level, { time: string; pass: string }> = {
  N5: { time: '約105分', pass: '80/180' },
  N4: { time: '約125分', pass: '90/180' },
  N3: { time: '約140分', pass: '95/180' },
};

export default function MockIntroScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'MockIntro'>>();
  const state = useAppState();
  const { height } = useWindowDimensions();
  const level = (state.settings.level as Level) ?? 'N5';
  const info = MOCK_INFO[level] ?? MOCK_INFO.N5;
  const illusH = Math.round(height * 0.60);

  const chips = [
    { ico: '🗓', label: 'ペース', val: '月1回' },
    { ico: '⏱', label: '試験時間', val: info.time },
    { ico: '🎯', label: '合格の目安', val: info.pass },
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
          <Text style={s.title}>模試に挑戦</Text>
          <Text style={s.subt}>本番と同じ形式で、いまの実力をチェック</Text>
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
        <Text style={s.note}>本番と同じ構成(文字・語彙／文法／読解／聴解)で採点します。{'\n'}※目安は {level}。級により異なります。</Text>
        <Pressable style={s.start} onPress={() => nav.replace('Mock', { full: route.params?.full ?? true })}>
          <Text style={s.startTxt}>模試を始める</Text>
        </Pressable>
        <Pressable style={s.later} onPress={() => nav.goBack()}><Text style={s.laterTxt}>また今度</Text></Pressable>
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
  start: { marginTop: 'auto', backgroundColor: '#c8894a', borderRadius: 16, paddingVertical: 15, alignItems: 'center', shadowColor: '#a06e32', shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  startTxt: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  later: { alignItems: 'center', paddingVertical: 10 },
  laterTxt: { color: '#9a6a3a', fontSize: 13, fontWeight: '700' },
});
