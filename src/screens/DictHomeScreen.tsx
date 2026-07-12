// 辞書タブ = 没入する図書館(全画面背景=図書館.PNG)。操作はイラスト下端(ボトムナビの上)の小アイコン列。
// 語彙/漢字/文法辞書 → DictList(BrowseScreen)、My単語帳 → RootStackのMyWords。
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList, DictStackParamList, Kubun } from '../navigation/types';
import { TabBackground, PopoverBar, type TabEntry } from '../components/TabScene';
import { useTabBg, useTabBlink } from '../data/tabArt';
import { useAppState } from '../store/store';
import { useT } from '../i18n';

type Nav = NativeStackNavigationProp<DictStackParamList & RootStackParamList>;

export default function DictHomeScreen() {
  const nav = useNavigation<Nav>();
  const t = useT();
  const { myList } = useAppState();
  const bg = useTabBg('dict');
  const blinkBg = useTabBlink('dict');
  return (
    <View style={styles.c}>
      <TabBackground source={bg} blinkSource={blinkBg} scrim={0.1}>
        <PopoverBar entries={[
          { key: 'vocab', glyph: '語', label: t('browse.vocab'), accent: '#3f9d5a', onGo: () => nav.navigate('DictList', { view: 'vocab' as Kubun }) },
          { key: 'kanji', glyph: '漢', label: t('browse.kanji'), accent: '#d9743f', onGo: () => nav.navigate('DictList', { view: 'kanji' as Kubun }) },
          { key: 'grammar', glyph: '文', label: t('browse.grammar'), accent: '#7b6bd6', onGo: () => nav.navigate('DictList', { view: 'grammar' as Kubun }) },
          { key: 'mywords', glyph: '★', label: t('mywords.card'), accent: '#c05580', count: myList?.length ?? 0, onGo: () => nav.navigate('MyWords') },
        ] as TabEntry[]} />
      </TabBackground>
    </View>
  );
}

const styles = StyleSheet.create({ c: { flex: 1 } });
