// 単語タブ = 世界観ハブ(全画面背景=学習タブ.PNG)。操作はイラスト下端(ボトムナビの上)の小アイコン列。
// 加えて、背景に描かれた掛軸/札にも透明タップ領域を重ねる(任意の没入操作)。
// 語彙/文法/漢字 → 各区分の練習(WordKubun)、今日のオススメ → 横断ドリル(WordDrill mixed)。
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList, WordsStackParamList } from '../navigation/types';
import { TabBackground, BottomIconBar, TabIconButton, Hotspot } from '../components/TabScene';
import { TAB_BG } from '../data/tabArt';
import { useT } from '../i18n';

type Nav = NativeStackNavigationProp<WordsStackParamList & RootStackParamList>;

export default function WordsHubScreen() {
  const nav = useNavigation<Nav>();
  const t = useT();
  const goKubun = (kubun: 'vocab' | 'grammar' | 'kanji') => nav.navigate('WordKubun', { kubun });
  const goReco = () => nav.navigate('WordDrill', { kind: 'mixed' });
  return (
    <View style={styles.c}>
      <TabBackground source={TAB_BG.word}>
        {/* 背景の掛軸/札にも重ねる(任意)。座標は実機で微調整。 */}
        <Hotspot label="語彙" area={{ left: '12%', top: '17%', width: '15%', height: '11%' }} onPress={() => goKubun('vocab')} />
        <Hotspot label="文法" area={{ left: '28%', top: '16%', width: '15%', height: '11%' }} onPress={() => goKubun('grammar')} />
        <Hotspot label="漢字" area={{ left: '42%', top: '17%', width: '15%', height: '11%' }} onPress={() => goKubun('kanji')} />
        <Hotspot label="今日の目標" area={{ left: '2%', top: '38%', width: '38%', height: '17%' }} onPress={goReco} />
        <BottomIconBar>
          <TabIconButton glyph="語" label={t('cards.vocab')} accent="#3f9d5a" onPress={() => goKubun('vocab')} />
          <TabIconButton glyph="文" label={t('cards.grammar')} accent="#7b6bd6" onPress={() => goKubun('grammar')} />
          <TabIconButton glyph="漢" label={t('cards.kanji')} accent="#d9743f" onPress={() => goKubun('kanji')} />
          <TabIconButton glyph="✦" label={t('cards.reco')} accent="#2f80b8" onPress={goReco} />
        </BottomIconBar>
      </TabBackground>
    </View>
  );
}

const styles = StyleSheet.create({ c: { flex: 1 } });
