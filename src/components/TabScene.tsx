// 世界観タブの共通部品:
//  - TabBackground: 全画面背景イラスト(cover・はみ出さない)＋任意スクリム。
//  - SceneTitle: イラスト上部中央の見出し。
//  - BottomIconBar / TabIconButton: イラスト下端(ボトムナビの上)に置く小アイコンの操作列。
//  - Hotspot: 背景の描き込み要素に重ねる透明タップ領域(必要時)。
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, Animated, Pressable, ScrollView, StyleSheet, useWindowDimensions, type DimensionValue, type ImageSourcePropType } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const IMMERSIVE = {
  card: 'rgba(255,251,244,0.88)',
  bar: 'rgba(255,250,242,0.82)',
  gold: 'rgba(184,146,74,0.8)',
  goldStrong: '#b8924a',
};

// 全画面背景。overflow:hidden で画面外へはみ出さない。scrim>0 で暗幕。
// blinkSource=「閉じ目版」の全画面画像(元絵と目以外は完全同一)を渡すと、その画像を背景に重ねて
// 透明度を 2回/6秒 で 0→1→0 させる=目だけが閉じて見える(他は同一なのでチラつかない)。
export function TabBackground({ source, blinkSource, scrim = 0, children }: { source: ImageSourcePropType; blinkSource?: ImageSourcePropType; scrim?: number; children?: React.ReactNode }) {
  const blink = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!blinkSource) return;
    const once = () => Animated.sequence([
      Animated.timing(blink, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(blink, { toValue: 0, duration: 95, useNativeDriver: true }),
    ]);
    // 6秒周期で2回まばたき
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(2500), once(), Animated.delay(180), once(), Animated.delay(2870),
    ]));
    loop.start();
    return () => loop.stop();
  }, [blinkSource, blink]);
  return (
    <View style={styles.fill}>
      <Image source={source} style={styles.bg} resizeMode="cover" />
      {blinkSource ? <Animated.Image source={blinkSource} style={[styles.bg, { opacity: blink }]} resizeMode="cover" /> : null}
      {scrim > 0 ? <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${scrim})` }]} /> : null}
      {children}
    </View>
  );
}

export function SceneTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

// イラスト下端(ボトムナビの上)に固定する小アイコンの操作列。和紙調の細い帯に載せる。
export function BottomIconBar({ children }: { children: React.ReactNode }) {
  return <View style={styles.bar}>{children}</View>;
}

// 小アイコンボタン: 丸縁(区分色)＋グリフ or Ionicon＋極小ラベル。任意で件数バッジ。
// active=そのボタンのカード(ポップオーバー)が開いている時のハイライト。
export function TabIconButton({ glyph, icon, label, accent, count, active, onPress }: {
  glyph?: string; icon?: React.ComponentProps<typeof Ionicons>['name']; label: string; accent: string; count?: number; active?: boolean; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]} accessibilityLabel={label}>
      <View style={[styles.circle, { borderColor: accent }, active && { borderWidth: 3, backgroundColor: '#fff', transform: [{ translateY: -3 }] }]}>
        {icon ? <Ionicons name={icon} size={20} color={accent} /> : <Text style={[styles.glyph, { color: accent }]}>{glyph}</Text>}
        {count != null && count > 0 ? <Text style={[styles.badge, { backgroundColor: accent }]}>{count}</Text> : null}
      </View>
      <Text style={styles.btnLabel} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

// タブ下端の操作列のエントリ。
//  - renderCard を持つボタン = タップでそのカードを「ボタンの上」にトグル表示(画面遷移も背景スクロールも無し)。
//  - renderCard が無いボタン = 従来どおり onGo() を実行(出題・一覧などのフローへ遷移)。
export type TabEntry = {
  key: string;
  glyph?: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  label: string;        // ボタンのラベル
  accent: string;
  count?: number;       // ボタンの件数バッジ(任意)
  disabled?: boolean;   // 無効化(例: 模試ロック中)
  hidden?: boolean;     // 下端の操作列には出さない(背景の桜ホットスポット等からのみ開くカード用)
  onGo?: () => void;    // タップで実行(遷移系ボタン)。renderCard があるボタンでは不要
  renderCard?: () => React.ReactNode; // タップでボタン上に出すカード(遅延生成)
};

export function PopoverBar({ entries }: { entries: TabEntry[] }) {
  return (
    <BottomIconBar>
      {entries.filter((e) => !e.hidden).map((e) => (
        <TabIconButton
          key={e.key}
          glyph={e.glyph}
          icon={e.icon}
          label={e.label}
          accent={e.accent}
          count={e.count}
          onPress={() => { if (!e.disabled) e.onGo?.(); }}
        />
      ))}
    </BottomIconBar>
  );
}

// 没入タブの統合部品: 全画面背景イラスト＋下端ボタン列＋「ボタン上トグル・ポップオーバー」。
//  - renderCard を持つボタンをタップ = その区分カードをボタン列の"すぐ上"にフロート表示。
//    画面遷移せず、背景イラストも動かさない。再タップ or 背景の薄暗幕タップで閉じる(開くのは常に1枚)。
//  - カードは maxHeight でキャップし、超過分はカード内スクロール。初期は何も開かない(イラストが主役)。
//  - hotspots = 背景の描き込み要素に重ねる透明タップ領域。対応する key のカードをトグルする。
export function ImmersiveTab({ source, blinkSource, scrim = 0, title, entries, hotspots }: {
  source: ImageSourcePropType;
  blinkSource?: ImageSourcePropType;
  scrim?: number;
  title?: React.ReactNode;
  entries: TabEntry[];
  hotspots?: { key: string; area: Area; label?: string }[];
}) {
  const { height } = useWindowDimensions();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const activeEntry = entries.find((e) => e.key === openKey && e.renderCard);

  const handle = (e: TabEntry) => {
    if (e.disabled) return;
    if (e.renderCard) setOpenKey((k) => (k === e.key ? null : e.key));
    else { setOpenKey(null); e.onGo?.(); }
  };
  const toggleKey = (key: string) => {
    const e = entries.find((x) => x.key === key);
    if (e) handle(e);
  };

  return (
    <View style={styles.fill}>
      <TabBackground source={source} blinkSource={blinkSource} scrim={scrim}>
        {title != null ? <SceneTitle>{title}</SceneTitle> : null}
        {hotspots?.map((h) => (
          <Hotspot key={h.key} area={h.area} label={h.label} onPress={() => toggleKey(h.key)} />
        ))}
        {activeEntry ? (
          <>
            <Pressable style={styles.popScrim} onPress={() => setOpenKey(null)} accessibilityLabel="close" />
            <View style={styles.popWrap} pointerEvents="box-none">
              <ScrollView
                style={{ maxHeight: height * 0.62 }}
                contentContainerStyle={styles.popScrollContent}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                {activeEntry.renderCard!()}
              </ScrollView>
            </View>
          </>
        ) : null}
        <BottomIconBar>
          {entries.filter((e) => !e.hidden).map((e) => (
            <TabIconButton
              key={e.key}
              glyph={e.glyph}
              icon={e.icon}
              label={e.label}
              accent={e.accent}
              count={e.count}
              active={openKey === e.key && !!e.renderCard}
              onPress={() => handle(e)}
            />
          ))}
        </BottomIconBar>
      </TabBackground>
    </View>
  );
}

export type Area = { left: DimensionValue; top: DimensionValue; width: DimensionValue; height: DimensionValue };
export function Hotspot({ area, onPress, label }: { area: Area; onPress: () => void; label?: string }) {
  return <Pressable onPress={onPress} accessibilityLabel={label} style={({ pressed }) => [{ position: 'absolute', ...area, borderRadius: 14 }, pressed && styles.hotPressed]} />;
}

// 桜(背景ホットスポット)から開く「はじめる」確認カード。ボタン列のすぐ上にフロート表示。
// 即遷移せず、まず見出し＋[はじめる]ボタンのカードを出し、押して初めてフローへ入る。
export function StartCard({ glyph, accent, title, cta, onStart }: {
  glyph: string; accent: string; title: string; cta: string; onStart: () => void;
}) {
  return (
    <View style={styles.popCard}>
      <View style={[styles.popIcon, { borderColor: accent }]}>
        <Text style={[styles.popGlyph, { color: accent }]}>{glyph}</Text>
      </View>
      <View style={styles.popText}>
        <Text style={styles.popTitle} numberOfLines={2}>{title}</Text>
      </View>
      <Pressable style={[styles.popBtn, { backgroundColor: accent }]} onPress={onStart} accessibilityLabel={cta}>
        <Text style={styles.popBtnTxt}>{cta}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, overflow: 'hidden' },
  bg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  hotPressed: { backgroundColor: 'rgba(255,255,255,0.22)' },
  title: {
    fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: 6, textAlign: 'center', marginTop: 10,
    textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 8,
  },
  // 下端の操作列(ボトムナビの上)。枠なし=イラストを隠さない。ボタン(丸アイコン)だけを並べる。
  bar: {
    position: 'absolute', left: 8, right: 8, bottom: 10,
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end',
    paddingHorizontal: 2,
  },
  btn: { flex: 1, alignItems: 'center', gap: 3, paddingHorizontal: 2 },
  btnPressed: { transform: [{ scale: 0.93 }], opacity: 0.85 },
  circle: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  glyph: { fontSize: 23, fontWeight: '900' },
  btnLabel: { fontSize: 10.5, fontWeight: '800', color: '#fff', textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  badge: { position: 'absolute', top: -4, right: -6, minWidth: 16, fontSize: 10, fontWeight: '800', color: '#fff', borderRadius: 8, paddingHorizontal: 4, textAlign: 'center', overflow: 'hidden' },
  // ポップオーバー(タップしたアイコンの上に出るカード)。
  // popScrim=カードの外側全面をタップで閉じる薄暗幕(ボタン列の上まで)。
  popScrim: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 82, backgroundColor: 'rgba(0,0,0,0.18)' },
  popWrap: { position: 'absolute', left: 10, right: 10, bottom: 84 },
  popScrollContent: { paddingBottom: 2 },
  popCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,251,244,0.96)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(184,146,74,0.55)',
    paddingVertical: 12, paddingHorizontal: 14,
    shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 10,
  },
  popIcon: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  popGlyph: { fontSize: 25, fontWeight: '900' },
  popText: { flex: 1 },
  popTitle: { fontSize: 16, fontWeight: '900', color: '#3a2f22' },
  popSub: { fontSize: 11.5, fontWeight: '600', color: '#7a6a52', marginTop: 2, lineHeight: 15 },
  popBtn: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 12 },
  popBtnOff: { opacity: 0.4 },
  popBtnTxt: { color: '#fff', fontWeight: '900', fontSize: 13 },
  popTail: {
    position: 'absolute', bottom: -6, width: 14, height: 14, marginLeft: -7,
    backgroundColor: 'rgba(255,251,244,0.96)', borderRightWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(184,146,74,0.55)',
    transform: [{ rotate: '45deg' }],
  },
});
