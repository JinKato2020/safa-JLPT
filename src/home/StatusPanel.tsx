// ホームのゲーム風ステータスパネル(レイヤー合成)。
// Layer0=和風フレーム素材(藍×金＋金の稲妻)、中央の暗色和紙に:
//  ヘッダー(巫女＋ランク/継続日数/学習時間)／合格Lvメインバー／5区分バー。
// バーは実データに向けてアニメで伸び(イージング)＋数値カウントアップ＋発光。純RN＋Animated(ネイティブ依存なし)。
import { useEffect, useRef, useState } from 'react';
import { View, Text, Image, Animated, Easing, StyleSheet } from 'react-native';
import { useT } from '../i18n';
import { GUIDE } from '../data/mywordsArt';
import { studyHM, type HomeStatus } from './homeStatus';

const FRAME = require('../../assets/tabs/status_frame.png');
const FRAME_ASPECT = 720 / 987; // 素材の縦横比(横/縦)
const RAMP = ['#37d6a0', '#7fd94a', '#f2c14e', '#ef7a4a', '#e85f86'];
const rampColor = (f: number) => RAMP[Math.min(RAMP.length - 1, Math.max(0, Math.round(f * (RAMP.length - 1))))];

// 段(タリー)の目盛りを重ねる装飾オーバーレイ。
function Ticks({ n }: { n: number }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {Array.from({ length: n }).map((_, i) => (
          <View key={i} style={{ flex: 1, borderRightWidth: i < n - 1 ? 1 : 0, borderRightColor: 'rgba(8,6,4,0.55)' }} />
        ))}
      </View>
    </View>
  );
}

function AnimBar({ pct, progress, height, segs, gradient }: { pct: number; progress: Animated.Value; height: number; segs: number; gradient?: boolean }) {
  const w = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${Math.max(0, Math.min(100, pct))}%`] });
  return (
    <View style={[styles.track, { height }]}>
      <Animated.View style={[styles.fill, { width: w }]}>
        {gradient ? (
          <View style={StyleSheet.absoluteFill}>
            {RAMP.map((col, i) => (<View key={i} style={{ flex: 1, backgroundColor: col }} />))}
            <View style={StyleSheet.absoluteFill}><View style={{ flex: 1, flexDirection: 'row' }}>{RAMP.map((_, i) => <View key={i} style={{ flex: 1 }} />)}</View></View>
          </View>
        ) : null}
      </Animated.View>
      <Ticks n={segs} />
    </View>
  );
}

export default function StatusPanel({ data, width }: { data: HomeStatus; width: number }) {
  const t = useT();
  const height = width / FRAME_ASPECT;
  const { h, m } = studyHM(data.studySeconds);
  const progress = useRef(new Animated.Value(0)).current;
  const [frac, setFrac] = useState(0); // 数値カウントアップ 0→1

  useEffect(() => {
    const id = progress.addListener(({ value }) => setFrac(value));
    Animated.timing(progress, { toValue: 1, duration: 1000, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => progress.removeListener(id);
  }, [progress]);
  const cu = (n: number) => Math.round(n * frac);

  // 素材フレーム内側(和紙)に収まるパディング。
  const pad = { paddingLeft: width * 0.17, paddingRight: width * 0.14, paddingTop: height * 0.095, paddingBottom: height * 0.085 };

  return (
    <View style={{ width, height }}>
      <Image source={FRAME} style={StyleSheet.absoluteFill} resizeMode="stretch" />
      <View style={[StyleSheet.absoluteFill, pad]}>
        {/* ヘッダー */}
        <View style={styles.phead}>
          <Image source={GUIDE.open} style={styles.portrait} resizeMode="cover" />
          <View style={{ flex: 1 }}>
            <Text style={styles.rank} numberOfLines={1}>{t('status.rank_label')}：{t(data.rankTitleKey)}</Text>
            <Text style={styles.meta}>{t('status.streak_label')}：<Text style={styles.val}>{t('status.days', { n: cu(data.streakDays) })}</Text></Text>
            <Text style={styles.meta}>{t('status.studytime_label')}：<Text style={styles.val}>{h > 0 ? t('status.time_hm', { h, m }) : t('status.time_m', { m })}</Text></Text>
          </View>
        </View>

        {/* 合格Lv(メインバー) */}
        <View style={styles.mainRow}>
          <Text style={styles.mainLbl}>{t('status.pass_level')}</Text>
          <View style={styles.mainBarWrap}>
            <AnimBar pct={data.passPct} progress={progress} height={20} segs={22} gradient />
            <View style={styles.mainPctWrap} pointerEvents="none"><Text style={styles.mainPct}>{t('status.pass_reach', { n: cu(data.passPct) })}</Text></View>
          </View>
        </View>

        {/* 5区分バー */}
        {data.subjects.map((sub) => (
          <View key={sub.key} style={styles.barRow}>
            <Text style={styles.lbl}>{t(sub.labelKey)}</Text>
            <View style={styles.subBarWrap}>
              <SubBar pct={sub.pct} color={sub.color} progress={progress} />
            </View>
            <Text style={styles.pct}>{cu(sub.pct)}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function SubBar({ pct, color, progress }: { pct: number; color: string; progress: Animated.Value }) {
  const w = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${Math.max(0, Math.min(100, pct))}%`] });
  return (
    <View style={[styles.track, { height: 15 }]}>
      <Animated.View style={[styles.fill, { width: w, backgroundColor: color, shadowColor: color }]} />
      <Ticks n={16} />
    </View>
  );
}

const styles = StyleSheet.create({
  phead: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 8 },
  portrait: { width: 46, height: 46, borderRadius: 12, borderWidth: 2, borderColor: '#e7c877', backgroundColor: '#f6cfe0' },
  rank: { color: '#ffe6a3', fontWeight: '900', fontSize: 13.5, fontFamily: 'ShipporiMincho-Bold' },
  meta: { color: '#cdb897', fontSize: 12, marginTop: 1.5 },
  val: { color: '#f3e6cf', fontWeight: '800' },

  mainRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  mainLbl: { color: '#ffe6a3', fontWeight: '800', fontSize: 12.5, fontFamily: 'ShipporiMincho-Bold' },
  mainBarWrap: { flex: 1, position: 'relative' },
  mainPctWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  mainPct: { color: '#fff', fontWeight: '900', fontSize: 11, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3 },

  barRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4 },
  lbl: { width: 28, color: '#f3e6cf', fontWeight: '800', fontSize: 12.5, fontFamily: 'ShipporiMincho-Bold' },
  subBarWrap: { flex: 1 },
  pct: { width: 38, textAlign: 'right', color: '#f3e6cf', fontWeight: '800', fontSize: 12, fontVariant: ['tabular-nums'] },

  track: { position: 'relative', borderRadius: 7, overflow: 'hidden', backgroundColor: 'rgba(10,8,20,0.65)', borderWidth: 1, borderColor: 'rgba(231,200,119,0.25)' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 6, shadowOpacity: 0.8, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
});
