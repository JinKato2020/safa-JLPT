// 試験タブ = 世界観ホーム。上部=全画面イラスト(ヒーロー)＋下端アイコン列。
// 字/文/読/聴 をタップ＝画面遷移せず、下に そのカテゴリのカード(CategoryCard=正答率リング＋大問)を表示。
// ✦=今日のオススメ(Quiz) / 試=模試 は従来どおり遷移(出題フローのため)。
import { useMemo, useRef, useState } from 'react';
import { View, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList, StudyStackParamList } from '../navigation/types';
import { TabBackground, PopoverBar, type TabEntry } from '../components/TabScene';
import { useTabBg } from '../data/tabArt';
import CategoryCard from '../components/CategoryCard';
import { useAppState } from '../store/store';
import { examOf } from '../engine/examProfile';
import type { Category } from '../engine/engine';
import { fullMockLocked } from '../mock/fullMockLock';
import { useColors } from '../theme';
import { useT } from '../i18n';

type Nav = NativeStackNavigationProp<StudyStackParamList & RootStackParamList>;

const CATS: { cat: Category; glyph: string; accent: string }[] = [
  { cat: 'moji_goi', glyph: '字', accent: '#3f9d5a' },
  { cat: 'bunpou', glyph: '文', accent: '#7b6bd6' },
  { cat: 'dokkai', glyph: '読', accent: '#2f80b8' },
  { cat: 'choukai', glyph: '聴', accent: '#d9743f' },
];

export default function StudyHomeScreen() {
  const nav = useNavigation<Nav>();
  const t = useT();
  const c = useColors();
  const state = useAppState();
  const now = Date.now();
  const prof = useMemo(() => examOf(state.settings.targetExam), [state.settings.targetExam]);
  const isJft = prof.exam === 'jft';
  const lock = fullMockLocked(state.mockHistory ?? [], now);
  const bg = useTabBg('exam');
  const { height } = useWindowDimensions();
  const [sel, setSel] = useState<Category>('moji_goi');
  const scrollRef = useRef<ScrollView>(null);
  const heroH = height * 0.82;
  const pick = (cat: Category) => { setSel(cat); requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: heroH * 0.62, animated: true })); };

  return (
    <View style={[styles.c, { backgroundColor: c.bg }]}>
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}>
        <View style={{ height: heroH }}>
          <TabBackground source={bg} scrim={0.12}>
            <PopoverBar entries={[
              { key: 'reco', glyph: '✦', label: t('study.reco'), accent: '#c9a24a', onGo: () => nav.navigate('Quiz', { category: 'all' }) },
              ...CATS.map((x) => ({ key: x.cat, glyph: x.glyph, label: t(prof.catLabel[x.cat]), accent: x.accent, onGo: () => pick(x.cat) })),
              { key: 'mock', glyph: '試', label: isJft ? t('test.jft_title') : t('test.full_title'), accent: lock.locked ? '#a89a86' : '#b8924a', disabled: lock.locked, onGo: () => { if (!lock.locked) nav.navigate('Mock', { full: true }); } },
            ] as TabEntry[]} />
          </TabBackground>
        </View>
        <View style={styles.cardArea}>
          <CategoryCard cat={sel} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1 },
  cardArea: { padding: 16, paddingBottom: 40 },
});
