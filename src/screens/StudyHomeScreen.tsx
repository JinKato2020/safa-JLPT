// 試験タブ = 世界観ホーム。全画面イラスト(ヒーロー)＋下端アイコン列。
// 字/文/読/聴 をタップ＝画面遷移せず・背景も動かさず、そのボタンの上に
// CategoryCard(正答率リング＋大問)をトグル表示。✦=今日のオススメ / 試=模試 は遷移(出題フロー)。
import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList, StudyStackParamList } from '../navigation/types';
import { ImmersiveTab, type TabEntry } from '../components/TabScene';
import { useTabBg } from '../data/tabArt';
import CategoryCard from '../components/CategoryCard';
import { useAppState } from '../store/store';
import { examOf } from '../engine/examProfile';
import type { Category } from '../engine/engine';
import { proStatus } from '../pro/entitlement';
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
  const now = Date.now();
  const prof = useMemo(() => examOf(state.settings.targetExam), [state.settings.targetExam]);
  // 模試はProの機能。無料ユーザーはロック→ペイウォールへ誘導(ユーザー指定2026-08-29)。
  // Proは所持チケットで挑戦(暦月ごとに配布・購入も可)=イントロ側でチケット残数を判定。
  const isPro = proStatus(state, now).isPro;
  const bg = useTabBg('exam');

  return (
    <View style={[styles.c, { backgroundColor: c.bg }]}>
      <ImmersiveTab
        source={bg}
        scrim={0.12}
        entries={[
          // 試験タブ=大問別カテゴリ(語彙/文法/読解/聴解)の4アイコンのみ。模試は下の「試験に挑戦する」ボタンへ分離。
          // 旧「全部混ぜ(今日のオススメ)」は統合復習へ移行し撤去(復習はホーム/書斎の入口へ・試験タブに復習は置かない=方針2026-08-01)。
          ...CATS.map((x) => ({ key: x.cat, glyph: x.glyph, label: x.labelKey ? t(x.labelKey) : t(prof.catLabel[x.cat]), accent: x.accent, renderCard: () => <CategoryCard cat={x.cat} /> })),
        ] as TabEntry[]}
        // 「試験に挑戦する」= 模試フローの入口。4カテゴリのアイコンの"真上"に中央配置(ユーザー指定2026-08-29)。
        // デザインはホームの「苦手な単語に挑戦する」ボタンと同じ(濃い青の不透明ピル)。カードを開くと隠れる。
        aboveBar={
          <Pressable
            style={[styles.challenge, !isPro && styles.challengeLocked]}
            onPress={() => { if (isPro) nav.navigate('MockIntro', { full: true }); else nav.navigate('Paywall'); }}
            accessibilityLabel={isPro ? t('test.challenge') : t('test.pro_locked')}
          >
            <Text style={styles.challengeTxt}>{isPro ? `🎯 ${t('test.challenge')}` : `🔒 ${t('test.pro_locked')}`}</Text>
          </Pressable>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1 },
  // 「試験に挑戦する」CTA。4カテゴリのアイコン列のすぐ上・中央。デザインはホームの「苦手な単語に挑戦する」ボタンと統一(濃い青の不透明ピル)。
  challenge: {
    position: 'absolute', left: 32, right: 32, bottom: 84,
    backgroundColor: '#2f62d8', borderRadius: 999, paddingVertical: 14, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 5,
  },
  challengeLocked: { backgroundColor: '#8a93a8', opacity: 0.9 },
  challengeTxt: { color: '#ffffff', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
});
