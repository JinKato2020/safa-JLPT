// ホーム中央のヒーロー: 合格到達度リング。
//  - リング = 到達度(passPct)の段位 badgeTierIndex 0→9 に応じて墨絵リング 01→10 を差し替え(成長で成る)。
//  - リング内(穴の上寄り中央) = 到達度の数字％＋「到達度」ラベル。
//  - その下 = 桜巫女(guide_open)。%は動的・キャラは別レイヤーで差し替え可。
import { View, Text, Image, StyleSheet, type ImageSourcePropType } from 'react-native';
import { useT } from '../i18n';

const RINGS: ImageSourcePropType[] = [
  require('../../assets/pass-ring/01.png'),
  require('../../assets/pass-ring/02.png'),
  require('../../assets/pass-ring/03.png'),
  require('../../assets/pass-ring/04.png'),
  require('../../assets/pass-ring/05.png'),
  require('../../assets/pass-ring/06.png'),
  require('../../assets/pass-ring/07.png'),
  require('../../assets/pass-ring/08.png'),
  require('../../assets/pass-ring/09.png'),
  require('../../assets/pass-ring/10.png'),
];
const GIRL = require('../../assets/mywords/guide_open.png');
const GIRL_AR = 600 / 670; // 元画像の縦横比(w/h)

export default function PassRing({ pct, size }: { pct: number; size: number }) {
  const t = useT();
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  // 主役は常に「完成した黒い墨絵の丸」。到達度で 03(黒い丸)→10(金・桜満開)へ成長。
  // 薄い未完成の段01-02はヒーローに使わない(0%でも丸が見える)。
  const ringNum = 3 + Math.round((p / 100) * 7); // 3..10
  const ring = RINGS[ringNum - 1];
  const girlH = size * 0.48;

  return (
    <View style={{ width: size, height: size }}>
      <Image source={ring} style={{ position: 'absolute', width: size, height: size }} resizeMode="contain" />

      {/* 到達度%(穴の上寄り中央)。背景が多彩なので淡い和紙下地を敷いて可読性を確保。 */}
      <View style={[styles.pctWrap, { top: size * 0.26 }]} pointerEvents="none">
        <View style={[styles.plate, { paddingHorizontal: size * 0.055, paddingVertical: size * 0.014, borderRadius: size * 0.06 }]}>
          <Text style={[styles.pct, { fontSize: size * 0.145 }]}>
            {p}<Text style={{ fontSize: size * 0.082 }}>%</Text>
          </Text>
          <Text style={[styles.lbl, { fontSize: size * 0.04, letterSpacing: size * 0.008 }]}>{t('home.readiness')}</Text>
        </View>
      </View>

      {/* 女の子(％の下・リング内の下側) */}
      <View style={[styles.girlWrap, { bottom: size * 0.04 }]} pointerEvents="none">
        <Image source={GIRL} style={{ width: girlH * GIRL_AR, height: girlH }} resizeMode="contain" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pctWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  plate: { alignItems: 'center', backgroundColor: 'rgba(255,251,244,0.66)' },
  pct: {
    fontWeight: '500', color: '#2b2b2b', lineHeight: undefined,
    textShadowColor: 'rgba(255,255,255,0.55)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6,
  },
  lbl: { fontWeight: '800', color: '#6a5a42', marginTop: 2, textShadowColor: 'rgba(255,255,255,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  girlWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
});
