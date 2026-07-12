// 辞書タブ = 没入する図書館。上部=全画面イラスト(ヒーロー)＋下端アイコン列。
// 語/漢/文 をタップ＝画面遷移せず、下に その辞書のカード(件数＋リストを開く)を表示。★My単語帳はモーダル。
import { useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList, DictStackParamList, Kubun } from '../navigation/types';
import { TabBackground, PopoverBar, type TabEntry } from '../components/TabScene';
import { useTabBg, useTabBlink } from '../data/tabArt';
import { useAppState } from '../store/store';
import { coverageBars } from '../store/selectors';
import { spacing, radius, type as ty, shadow, useColors, type ThemeColors } from '../theme';
import { useT } from '../i18n';

type Nav = NativeStackNavigationProp<DictStackParamList & RootStackParamList>;
const DICTS: { view: Kubun; glyph: string; labelKey: string; accent: string }[] = [
  { view: 'vocab', glyph: '語', labelKey: 'browse.vocab', accent: '#3f9d5a' },
  { view: 'kanji', glyph: '漢', labelKey: 'browse.kanji', accent: '#d9743f' },
  { view: 'grammar', glyph: '文', labelKey: 'browse.grammar', accent: '#7b6bd6' },
];

export default function DictHomeScreen() {
  const nav = useNavigation<Nav>();
  const t = useT();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const state = useAppState();
  const { myList } = state;
  const now = Date.now();
  const bg = useTabBg('dict');
  const blinkBg = useTabBlink('dict');
  const { height } = useWindowDimensions();
  const [sel, setSel] = useState<Kubun>('vocab');
  const scrollRef = useRef<ScrollView>(null);
  const heroH = height * 0.82;
  const pick = (v: Kubun) => { setSel(v); requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: heroH * 0.62, animated: true })); };

  const cov = useMemo(() => coverageBars(state, now), [state]); // eslint-disable-line react-hooks/exhaustive-deps
  const meta = DICTS.find((d) => d.view === sel)!;
  const b = cov.find((x) => x.key === sel) ?? { learned: 0, total: 0 };

  return (
    <View style={[styles.c, { backgroundColor: c.bg }]}>
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}>
        <View style={{ height: heroH }}>
          <TabBackground source={bg} blinkSource={blinkBg} scrim={0.1}>
            <PopoverBar entries={[
              ...DICTS.map((d) => ({ key: d.view, glyph: d.glyph, label: t(d.labelKey), accent: d.accent, onGo: () => pick(d.view) })),
              { key: 'mywords', glyph: '★', label: t('mywords.card'), accent: '#c05580', count: myList?.length ?? 0, onGo: () => nav.navigate('MyWords') },
            ] as TabEntry[]} />
          </TabBackground>
        </View>
        <View style={styles.cardArea}>
          <View style={s.card}>
            <View style={s.cardHead}>
              <View style={[s.badge, { backgroundColor: meta.accent }]}><Text style={s.badgeTxt}>{meta.glyph}</Text></View>
              <Text style={s.cardTitle}>{t(meta.labelKey)}</Text>
              <Text style={s.count}>{b.total}</Text>
            </View>
            <Pressable style={({ pressed }) => [s.linkBtn, pressed && s.pressed]} onPress={() => nav.navigate('DictList', { view: sel })}>
              <Text style={s.linkTxt}>{t('dict.open_list')}</Text><Text style={s.chevron}>›</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1 },
  cardArea: { padding: 16, paddingBottom: 40 },
});
const makeStyles = (c: ThemeColors) => StyleSheet.create({
  card: { ...shadow(1), backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: spacing.md, gap: spacing.sm },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  badge: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  badgeTxt: { color: '#fff', fontSize: ty.h2, fontWeight: '800' },
  cardTitle: { flex: 1, fontSize: ty.h2, fontFamily: 'ShipporiMincho-Bold', color: c.ink, letterSpacing: 0.5 },
  count: { fontSize: ty.body, fontWeight: '800', color: c.mute },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: c.bgSoft, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md },
  linkTxt: { flex: 1, fontSize: ty.body, fontWeight: '700', color: c.ink2 },
  chevron: { fontSize: 24, color: c.trace, fontWeight: '700' },
  pressed: { backgroundColor: c.bgSoft, opacity: 0.85 },
});
