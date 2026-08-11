// 試験タブ = 世界観ホーム。全画面イラスト(ヒーロー)＋下端アイコン列。
// 字/文/読/聴 をタップ＝画面遷移せず・背景も動かさず、そのボタンの上に
// CategoryCard(正答率リング＋大問)をトグル表示。✦=今日のオススメ / 試=模試 は遷移(出題フロー)。
import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList, StudyStackParamList } from '../navigation/types';
import { ImmersiveTab, type TabEntry } from '../components/TabScene';
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
  // 【開発用】「全モードを解禁」ONのときはフル模試の月1ロックも外す(繰り返しテスト用)。
  const mockLocked = lock.locked && state.settings.devUnlockAll !== true;
  const bg = useTabBg('exam');

  return (
    <View style={[styles.c, { backgroundColor: c.bg }]}>
      <ImmersiveTab
        source={bg}
        scrim={0.12}
        entries={[
          // 試験タブ=大問別(字/文/読/聴)＋模試のみ。旧「全部混ぜ(今日のオススメ)」は統合復習へ移行し撤去(復習は
          // ホーム/書斎の入口へ。試験タブには復習を置かない=ユーザー方針2026-08-01)。
          ...CATS.map((x) => ({ key: x.cat, glyph: x.glyph, label: t(prof.catLabel[x.cat]), accent: x.accent, renderCard: () => <CategoryCard cat={x.cat} /> })),
          { key: 'mock', glyph: '試', label: isJft ? t('test.jft_title') : t('test.full_title'), accent: mockLocked ? '#a89a86' : '#b8924a', disabled: mockLocked, onGo: () => { if (!mockLocked) nav.navigate('MockIntro', { full: true }); } },
        ] as TabEntry[]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1 },
});
