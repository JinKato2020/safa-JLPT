// ホームのゲーム風RPGステータスパネル(参考画像 ホームタブ2.png)。
// 木枠＋金トリム＋雷グロー、左端に縦「ステータス」タブ。内側は縦スクロール(将来ステータス追加用)。
// 合格Lv(メインバー=合格率)＋5区分の段組みタリーバー。値は homeStatus(実データ)。純描画はRNのみ(Skia不使用)。
import { View, Text, Image, ScrollView, StyleSheet } from 'react-native';
import { useT } from '../i18n';
import { GUIDE } from '../data/mywordsArt';
import { studyHM, type HomeStatus } from './homeStatus';

const P = {
  wood: '#7a5230', panel1: '#2f2018', panel2: '#241812',
  gold: '#e7c877', gold2: '#b8924a', ink: '#f3e6cf', ink2: '#cdb897', mute: '#a88f6e',
  trackBg: '#160f0b', segOff: '#3a2a1e',
};
const SUBJECT_SEGS = 16;
const MAIN_SEGS = 22;
// メインバー(合格率)の段色ランプ: 緑→黄緑→琥珀→橙→桃。
const RAMP = ['#37d6a0', '#7fd94a', '#f2c14e', '#ef7a4a', '#e85f86'];
function rampColor(frac: number): string {
  const f = Math.max(0, Math.min(1, frac));
  const x = f * (RAMP.length - 1);
  return RAMP[Math.min(RAMP.length - 1, Math.round(x))];
}

function SegBar({ pct, color }: { pct: number; color: string }) {
  const filled = Math.round((Math.max(0, Math.min(100, pct)) / 100) * SUBJECT_SEGS);
  return (
    <View style={styles.track}>
      {Array.from({ length: SUBJECT_SEGS }).map((_, i) => (
        <View key={i} style={[styles.seg, i < filled ? { backgroundColor: color, shadowColor: color } : styles.segOff, i < filled && styles.segGlow]} />
      ))}
    </View>
  );
}

export default function StatusPanel({ data, maxHeight }: { data: HomeStatus; maxHeight: number }) {
  const t = useT();
  const { h, m } = studyHM(data.studySeconds);
  const mainFilled = Math.round((data.passPct / 100) * MAIN_SEGS);
  return (
    <View style={styles.wrap}>
      <View style={[styles.glow, { maxHeight }]}>
        <View style={[styles.panel, { maxHeight }]}>
          <View style={styles.statusTab}><Text style={styles.statusTabTxt}>{t('status.title')}</Text></View>
          <ScrollView style={{ maxHeight: maxHeight - 6 }} contentContainerStyle={styles.body} nestedScrollEnabled showsVerticalScrollIndicator={false}>
            {/* ヘッダー: 巫女ポートレート＋ランク/継続/学習時間 */}
            <View style={styles.phead}>
              <Image source={GUIDE.open} style={styles.portrait} resizeMode="cover" />
              <View style={{ flex: 1 }}>
                <Text style={styles.rank} numberOfLines={1}>{t('status.rank_label')}：{t(data.rankTitleKey)}</Text>
                <Text style={styles.pmeta}>{t('status.streak_label')}：<Text style={styles.pval}>{t('status.days', { n: data.streakDays })}</Text></Text>
                <Text style={styles.pmeta}>{t('status.studytime_label')}：<Text style={styles.pval}>{h > 0 ? t('status.time_hm', { h, m }) : t('status.time_m', { m })}</Text></Text>
              </View>
            </View>

            {/* 合格Lv(メインバー) */}
            <View style={styles.mainRow}>
              <Text style={styles.mainLbl}>{t('status.pass_level')}</Text>
              <View style={styles.mainTrack}>
                {Array.from({ length: MAIN_SEGS }).map((_, i) => (
                  <View key={i} style={[styles.mseg, i < mainFilled ? { backgroundColor: rampColor(i / (MAIN_SEGS - 1)) } : styles.segOff]} />
                ))}
                <View style={styles.mainPctWrap} pointerEvents="none">
                  <Text style={styles.mainPct}>{t('status.pass_reach', { n: data.passPct })}</Text>
                </View>
              </View>
            </View>

            {/* 5区分の正解率バー */}
            {data.subjects.map((sub) => (
              <View key={sub.key} style={styles.barRow}>
                <Text style={styles.lbl}>{t(sub.labelKey)}</Text>
                <SegBar pct={sub.pct} color={sub.color} />
                <Text style={styles.pct}>{sub.pct}%</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'stretch' },
  glow: {
    borderRadius: 20, padding: 3,
    shadowColor: '#8fe6ff', shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 0 }, elevation: 10,
  },
  panel: {
    borderRadius: 16, paddingLeft: 22, paddingRight: 10, paddingVertical: 10,
    backgroundColor: P.panel2, borderWidth: 3, borderColor: P.wood,
  },
  statusTab: {
    position: 'absolute', left: -3, top: 24, width: 22, height: 148, borderRadius: 6, zIndex: 3,
    backgroundColor: '#efd9b4', borderWidth: 1, borderColor: P.gold2, alignItems: 'center', justifyContent: 'center',
  },
  statusTabTxt: { color: '#5a4326', fontFamily: 'ShipporiMincho-Bold', fontWeight: '800', fontSize: 12, width: 148, textAlign: 'center', transform: [{ rotate: '90deg' }] },
  body: { gap: 6, paddingVertical: 2 },
  phead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  portrait: { width: 52, height: 52, borderRadius: 13, borderWidth: 2, borderColor: P.gold, backgroundColor: '#f6cfe0' },
  rank: { color: '#ffe6a3', fontWeight: '900', fontSize: 14, fontFamily: 'ShipporiMincho-Bold' },
  pmeta: { color: P.ink2, fontSize: 12.5, marginTop: 2 },
  pval: { color: P.ink, fontWeight: '800' },

  mainRow: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(231,200,119,0.35)', borderRadius: 11, paddingVertical: 6, paddingHorizontal: 8, marginBottom: 4 },
  mainLbl: { color: '#ffe6a3', fontWeight: '800', fontSize: 13, fontFamily: 'ShipporiMincho-Bold' },
  mainTrack: { flex: 1, flexDirection: 'row', gap: 2, height: 20, backgroundColor: P.trackBg, borderRadius: 10, padding: 2, borderWidth: 1, borderColor: '#100e0c' },
  mseg: { flex: 1, borderRadius: 2 },
  mainPctWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  mainPct: { color: '#1a1208', fontWeight: '900', fontSize: 11.5, textShadowColor: 'rgba(255,255,255,0.4)', textShadowRadius: 1 },

  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lbl: { width: 30, color: P.ink, fontWeight: '800', fontSize: 13, fontFamily: 'ShipporiMincho-Bold', flexShrink: 0 },
  pct: { width: 42, textAlign: 'right', color: P.ink, fontWeight: '800', fontSize: 12.5, fontVariant: ['tabular-nums'], flexShrink: 0 },
  track: { flex: 1, flexDirection: 'row', gap: 2, height: 15, backgroundColor: P.trackBg, borderRadius: 8, padding: 2, borderWidth: 1, borderColor: '#12100e' },
  seg: { flex: 1, borderRadius: 1.5 },
  segOff: { backgroundColor: P.segOff },
  segGlow: { shadowOpacity: 0.9, shadowRadius: 3, shadowOffset: { width: 0, height: 0 } },
});
