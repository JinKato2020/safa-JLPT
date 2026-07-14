// 模試イントロ。試験タブの「模試」をタップ→いきなり始めず、まずこの画面で説明。
// 背景=模試会場イラスト／中央に案内キャラ(桜巫女)が浮遊しながら、月1回目安・試験時間・合格点目安を案内。
// [模試を始める]で本番(Mock)へ。
import { useEffect, useRef } from 'react';
import { View, Text, ImageBackground, Image, Animated, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppState } from '../store/store';
import type { Level } from '../engine/engine';
import type { RootStackParamList } from '../navigation/types';

const BG = require('../../assets/mock/mock_intro_bg.png');
const GUIDE = require('../../assets/mywords/guide_open.png');

type Nav = NativeStackNavigationProp<RootStackParamList>;

// 級別の目安(本番JLPTの試験時間・合格点)。模試の心構え用の参考値。
const MOCK_INFO: Record<Level, { time: string; pass: string }> = {
  N5: { time: '約105分', pass: '80 / 180点' },
  N4: { time: '約125分', pass: '90 / 180点' },
  N3: { time: '約140分', pass: '95 / 180点' },
};

export default function MockIntroScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'MockIntro'>>();
  const state = useAppState();
  const { width } = useWindowDimensions();
  const level = (state.settings.level as Level) ?? 'N5';
  const info = MOCK_INFO[level] ?? MOCK_INFO.N5;

  // 浮遊(上下ゆらゆら)。
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 1900, useNativeDriver: true }),
      Animated.timing(float, { toValue: 0, duration: 1900, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [float]);
  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [8, -8] });

  const guideW = Math.round(width * 0.44);

  const bullets = [
    { icon: '🗓', label: 'ペース', text: '月に1回くらいがおすすめ。実力の伸びを確認しよう。' },
    { icon: '⏱', label: '試験時間の目安', text: `${level}: ${info.time}(本番相当)` },
    { icon: '🎯', label: '合格点の目安', text: `${info.pass}(180点満点)` },
    { icon: '📋', label: '構成', text: '本番と同じ 文字・語彙／文法／読解／聴解 で採点します。' },
  ];

  return (
    <View style={s.c}>
      <ImageBackground source={BG} style={s.bg} resizeMode="cover">
        <View style={s.scrim} />
        <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
          <View style={s.head}>
            <Pressable onPress={() => nav.goBack()} hitSlop={12}><Text style={s.close}>×</Text></Pressable>
          </View>
          <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
            <Animated.Image source={GUIDE} resizeMode="contain" style={{ width: guideW, height: guideW, transform: [{ translateY }] }} />
            <Text style={s.title}>模試に挑戦</Text>
            <Text style={s.sub}>本番と同じ形式で、いまの実力をチェック。</Text>
            <View style={s.panel}>
              {bullets.map((b) => (
                <View key={b.label} style={s.row}>
                  <Text style={s.icon}>{b.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowLbl}>{b.label}</Text>
                    <Text style={s.rowTxt}>{b.text}</Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
          <View style={s.foot}>
            <Pressable style={s.start} onPress={() => nav.replace('Mock', { full: route.params?.full ?? true })}>
              <Text style={s.startTxt}>模試を始める</Text>
            </Pressable>
            <Pressable style={s.later} onPress={() => nav.goBack()}><Text style={s.laterTxt}>また今度</Text></Pressable>
          </View>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
}

const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: '#0e1424' },
  bg: { flex: 1 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,16,32,0.42)' },
  safe: { flex: 1 },
  head: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 18, paddingTop: 6 },
  close: { fontSize: 32, color: '#ffffff', fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 },
  body: { alignItems: 'center', paddingHorizontal: 22, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: '#ffffff', fontFamily: 'ShipporiMincho-Bold', textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 6, marginTop: 4 },
  sub: { fontSize: 13.5, color: '#eaf0ff', marginTop: 4, marginBottom: 14, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4, textAlign: 'center' },
  panel: { width: '100%', backgroundColor: 'rgba(14,22,44,0.82)', borderWidth: 1, borderColor: 'rgba(190,205,245,0.35)', borderRadius: 18, padding: 16, gap: 12 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  icon: { fontSize: 22, width: 28, textAlign: 'center' },
  rowLbl: { fontSize: 12, fontWeight: '800', color: '#ffd76a', letterSpacing: 0.5 },
  rowTxt: { fontSize: 14, color: '#eef2ff', marginTop: 2, lineHeight: 20 },
  foot: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 8, gap: 8 },
  start: { backgroundColor: '#3f7fd6', borderRadius: 16, paddingVertical: 15, alignItems: 'center', shadowColor: '#3f7fd6', shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  startTxt: { color: '#ffffff', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  later: { alignItems: 'center', paddingVertical: 8 },
  laterTxt: { color: '#dbe4ff', fontSize: 14, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 3 },
});
