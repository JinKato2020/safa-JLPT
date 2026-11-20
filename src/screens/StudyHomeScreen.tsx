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
import GradientButton, { tabChallengePlacement } from '../components/GradientButton';
import { useAppState } from '../store/store';
import { examOf } from '../engine/examProfile';
import type { Category } from '../engine/engine';
import { useProStatus } from '../pro/useProStatus';
import { useColors } from '../theme';
import { useT } from '../i18n';

type Nav = NativeStackNavigationProp<StudyStackParamList & RootStackParamList>;

// 試験タブの4カテゴリ。アイコン(グリフ＋色)は書斎タブ(WordsHub)と統一:
//  語彙=語/緑(#3f9d5a)・文法=文/紫(#7b6bd6)。moji_goi は漢字を内包するが表示は「語彙」。
const CATS: { cat: Category; glyph: string; accent: string; labelKey?: string }[] = [
  { cat: 'moji_goi', glyph: '語', accent: '#3f9d5a', labelKey: 'cards.vocab' },
  { cat: 'bunpou', glyph: '文', accent: '#7b6bd6' },
  { cat: 'dokkai', glyph: '読', accent: '#2f80b8' },
  { cat: 'choukai', glyph: '聴', accent: '#d9743f' },
];

export default function StudyHomeScreen() {
  const nav = useNavigation<Nav>();
  const t = useT();
  const c = useColors();
  const state = useAppState();
  const prof = useMemo(() => examOf(state.settings.targetExam), [state.settings.targetExam]);
  // 模試はProの機能。無料ユーザーはロック→ペイウォールへ誘導(ユーザー指定2026-08-29)。
  // Proは所持チケットで挑戦(暦月ごとに配布・購入も可)=イントロ側でチケット残数を判定。
  // useProStatus=キャンペーン等のフラグ変化でも再描画（実質Proなのに🔒が残る矛盾を防ぐ）。
  const isPro = useProStatus().isPro;
  const bg = useTabBg('exam');

  return (
    <View style={[styles.c, { backgroundColor: c.bg }]}>
      <ImmersiveTab
        source={bg}
        scrim={0.12}
        entries={[
          ...CATS.map((x) => ({ key: x.cat, glyph: x.glyph, label: x.labelKey ? t(x.labelKey) : t(prof.catLabel[x.cat]), accent: x.accent, renderCard: () => <CategoryCard cat={x.cat} /> })),
        ] as TabEntry[]}
        aboveBar={
          <View style={[tabChallengePlacement, styles.actions]}>
            <GradientButton style={styles.action} label={t('cards.practice_mix')} badge={t('cards.new_feature')}
              onPress={() => nav.navigate('WordDrill', { kind: 'examMix' })} />
            <GradientButton style={styles.action} disabledLook={!isPro}
              label={isPro ? t('test.mock_exam') : `🔒 ${t('test.mock_exam')}`}
              accessibilityLabel={isPro ? t('test.mock_exam') : t('test.pro_locked')}
              onPress={() => { if (isPro) nav.navigate('MockIntro', { full: true }); else nav.navigate('Paywall'); }} />
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1 },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1, minWidth: 0, paddingHorizontal: 8 },
});
