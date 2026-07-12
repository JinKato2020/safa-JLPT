// 世界観タブの共通部品:
//  - TabBackground: 全画面背景イラスト(cover・はみ出さない)＋任意スクリム。
//  - SceneTitle: イラスト上部中央の見出し。
//  - BottomIconBar / TabIconButton: イラスト下端(ボトムナビの上)に置く小アイコンの操作列。
//  - Hotspot: 背景の描き込み要素に重ねる透明タップ領域(必要時)。
import React, { useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet, type DimensionValue, type ImageSourcePropType } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useT } from '../i18n';

export const IMMERSIVE = {
  card: 'rgba(255,251,244,0.88)',
  bar: 'rgba(255,250,242,0.82)',
  gold: 'rgba(184,146,74,0.8)',
  goldStrong: '#b8924a',
};

// 全画面背景。overflow:hidden で画面外へはみ出さない。scrim>0 で暗幕。
export function TabBackground({ source, scrim = 0, children }: { source: ImageSourcePropType; scrim?: number; children?: React.ReactNode }) {
  return (
    <View style={styles.fill}>
      <Image source={source} style={styles.bg} resizeMode="cover" />
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

// タブ下端の操作: 各アイコンをタップすると、その上に「カード」(ポップオーバー)が出て、
// タイトル＋開くボタンを表示する。カード外/同じアイコン再タップで閉じる。
export type TabEntry = {
  key: string;
  glyph?: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  label: string;        // ボタンのラベル兼カード見出し
  accent: string;
  count?: number;       // ボタンの件数バッジ(任意)
  subtitle?: string;    // カードの一言説明(任意)
  disabled?: boolean;   // 開くを無効化(例: 模試ロック中)
  onGo: () => void;     // カードの「開く」で実行
};

export function PopoverBar({ entries }: { entries: TabEntry[] }) {
  const t = useT();
  const [open, setOpen] = useState<string | null>(null);
  const activeIdx = entries.findIndex((e) => e.key === open);
  const active = activeIdx >= 0 ? entries[activeIdx] : null;
  return (
    <>
      {active ? (
        <>
          {/* カード外タップで閉じる透明スクリム(ボトムバーは覆わない=再タップで閉じられる) */}
          <Pressable style={styles.popScrim} onPress={() => setOpen(null)} accessibilityLabel={t('nav.close')} />
          <View style={styles.popWrap} pointerEvents="box-none">
            <View style={styles.popCard}>
              <View style={[styles.popIcon, { borderColor: active.accent }]}>
                {active.icon ? <Ionicons name={active.icon} size={24} color={active.accent} /> : <Text style={[styles.popGlyph, { color: active.accent }]}>{active.glyph}</Text>}
              </View>
              <View style={styles.popText}>
                <Text style={styles.popTitle} numberOfLines={1}>{active.label}</Text>
                {active.subtitle ? <Text style={styles.popSub} numberOfLines={2}>{active.subtitle}</Text> : null}
              </View>
              <Pressable
                disabled={active.disabled}
                onPress={() => { setOpen(null); active.onGo(); }}
                style={[styles.popBtn, { backgroundColor: active.accent }, active.disabled && styles.popBtnOff]}
              >
                <Text style={styles.popBtnTxt}>{t('nav.open')}</Text>
              </Pressable>
            </View>
            {/* 選択中ボタンの真上を指す小さな三角 */}
            <View style={[styles.popTail, { left: `${((activeIdx + 0.5) / entries.length) * 100}%` }]} />
          </View>
        </>
      ) : null}
      <BottomIconBar>
        {entries.map((e) => (
          <TabIconButton
            key={e.key}
            glyph={e.glyph}
            icon={e.icon}
            label={e.label}
            accent={e.accent}
            count={e.count}
            active={open === e.key}
            onPress={() => setOpen(open === e.key ? null : e.key)}
          />
        ))}
      </BottomIconBar>
    </>
  );
}

export type Area = { left: DimensionValue; top: DimensionValue; width: DimensionValue; height: DimensionValue };
export function Hotspot({ area, onPress, label }: { area: Area; onPress: () => void; label?: string }) {
  return <Pressable onPress={onPress} accessibilityLabel={label} style={({ pressed }) => [{ position: 'absolute', ...area, borderRadius: 14 }, pressed && styles.hotPressed]} />;
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
  glyph: { fontSize: 23, fontWeight: '900', fontFamily: 'ShipporiMincho-Bold' },
  btnLabel: { fontSize: 10.5, fontWeight: '800', color: '#fff', textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  badge: { position: 'absolute', top: -4, right: -6, minWidth: 16, fontSize: 10, fontWeight: '800', color: '#fff', borderRadius: 8, paddingHorizontal: 4, textAlign: 'center', overflow: 'hidden' },
  // ポップオーバー(タップしたアイコンの上に出るカード)。
  popScrim: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 82 },
  popWrap: { position: 'absolute', left: 10, right: 10, bottom: 84 },
  popCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,251,244,0.96)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(184,146,74,0.55)',
    paddingVertical: 12, paddingHorizontal: 14,
    shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 10,
  },
  popIcon: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  popGlyph: { fontSize: 25, fontWeight: '900', fontFamily: 'ShipporiMincho-Bold' },
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
