// 辞書タブ = 没入する図書館。全画面イラスト(ヒーロー)＋下端アイコン列。
// 語/漢/文 をタップ＝そのリストへ「直接遷移」(中間カードを挟まない)。★My単語帳はモーダルへ遷移。
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList, DictStackParamList, Kubun } from '../navigation/types';
import { ImmersiveTab, StartCard, type TabEntry } from '../components/TabScene';
import { useTabBg, useTabBlink } from '../data/tabArt';
import { useAppState } from '../store/store';
import { useColors } from '../theme';
import { useT } from '../i18n';

type Nav = NativeStackNavigationProp<DictStackParamList & RootStackParamList>;
// 表示順=漢字→語彙→文法(my単語帳と同じ並び。ユーザー指定)。
const DICTS: { view: Kubun; glyph: string; labelKey: string; accent: string }[] = [
  { view: 'kanji', glyph: '漢', labelKey: 'browse.kanji', accent: '#d9743f' },
  { view: 'vocab', glyph: '語', labelKey: 'browse.vocab', accent: '#3f9d5a' },
  { view: 'grammar', glyph: '文', labelKey: 'browse.grammar', accent: '#7b6bd6' },
];

export default function DictHomeScreen() {
  const nav = useNavigation<Nav>();
  const t = useT();
  const c = useColors();
  const { myList } = useAppState();
  const bg = useTabBg('dict');
  const blinkBg = useTabBlink('dict');
  // 復習対象=my単語帳に保存した語彙＋漢字のid(VOCAB/KANJIに無いidはFlashcard側で自動除外)。
  const reviewIds = (myList ?? []).filter((r) => r.type === 'vocab' || r.type === 'kanji').map((r) => r.id);

  return (
    <View style={[styles.c, { backgroundColor: c.bg }]}>
      <ImmersiveTab
        source={bg}
        blinkSource={blinkBg}
        scrim={0.1}
        entries={[
          ...DICTS.map((d) => ({ key: d.view, glyph: d.glyph, label: t(d.labelKey), accent: d.accent, onGo: () => nav.navigate('DictList', { view: d.view }) })),
          { key: 'mywords', glyph: '★', label: t('mywords.card'), accent: '#c05580', count: myList?.length ?? 0, onGo: () => nav.navigate('MyWords') },
          // 桜(図書館の机に座るキャラ)タップ=my単語帳の復習を「はじめる」確認カード。保存が無ければ単語帳へ誘導。
          { key: 'review', hidden: true, label: t('mywords.review'), accent: '#c05580',
            renderCard: () => <StartCard glyph="復" accent="#c05580" title={t('mywords.review')} cta={t('cards.reco_start')}
              onStart={() => { if (reviewIds.length) nav.navigate('Flashcard', { ids: reviewIds }); else nav.navigate('MyWords'); }} /> },
        ] as TabEntry[]}
        hotspots={[{ key: 'review', label: t('mywords.review'), area: { left: '37%', top: '46%', width: '28%', height: '22%' } }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1 },
});
