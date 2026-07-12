// 試験タブ = 世界観ホーム(全画面背景=試験タブ.PNG)。操作はイラスト下端(ボトムナビの上)の小アイコン列。
// オススメ / 4カテゴリ(文字語彙・文法・読解・聴解) / 模試。カテゴリ→詳細(StudyCategory)。
import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList, StudyStackParamList } from '../navigation/types';
import { TabBackground, PopoverBar, type TabEntry } from '../components/TabScene';
import { useTabBg } from '../data/tabArt';
import { useAppState } from '../store/store';
import { examOf } from '../engine/examProfile';
import type { Category } from '../engine/engine';
import { fullMockLocked } from '../mock/fullMockLock';
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
  const state = useAppState();
  const now = Date.now();
  const prof = useMemo(() => examOf(state.settings.targetExam), [state.settings.targetExam]);
  const isJft = prof.exam === 'jft';
  const lock = fullMockLocked(state.mockHistory ?? [], now);
  const bg = useTabBg('exam');

  return (
    <View style={styles.c}>
      <TabBackground source={bg} scrim={0.12}>
        <PopoverBar entries={[
          { key: 'reco', glyph: '✦', label: t('study.reco'), accent: '#c9a24a', onGo: () => nav.navigate('Quiz', { category: 'all' }) },
          ...CATS.map((x) => ({ key: x.cat, glyph: x.glyph, label: t(prof.catLabel[x.cat]), accent: x.accent, subtitle: t('study.card_ring_hint'), onGo: () => nav.navigate('StudyCategory', { cat: x.cat }) })),
          { key: 'mock', glyph: '試', label: isJft ? t('test.jft_title') : t('test.full_title'), accent: lock.locked ? '#a89a86' : '#b8924a', disabled: lock.locked, subtitle: lock.locked ? t('test.locked_next', lock.next) : undefined, onGo: () => { if (!lock.locked) nav.navigate('Mock', { full: true }); } },
        ] as TabEntry[]} />
      </TabBackground>
    </View>
  );
}

const styles = StyleSheet.create({ c: { flex: 1 } });
