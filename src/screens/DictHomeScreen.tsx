// 辞書タブ = 没入する図書館。全画面イラスト(ヒーロー)＋下端アイコン列。
// 語/漢/文 をタップ＝そのリストへ「直接遷移」(中間カードを挟まない)。★My単語帳はモーダルへ遷移。
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList, DictStackParamList, Kubun } from '../navigation/types';
import { ImmersiveTab, type TabEntry } from '../components/TabScene';
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

  return (
    <View style={[styles.c, { backgroundColor: c.bg }]}>
      <ImmersiveTab
        source={bg}
        blinkSource={blinkBg}
        scrim={0.1}
        entries={[
          ...DICTS.map((d) => ({ key: d.view, glyph: d.glyph, label: t(d.labelKey), accent: d.accent, onGo: () => nav.navigate('DictList', { view: d.view }) })),
          { key: 'mywords', glyph: '★', label: t('mywords.card'), accent: '#c05580', count: myList?.length ?? 0, onGo: () => nav.navigate('MyWords') },
        ] as TabEntry[]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1 },
});
