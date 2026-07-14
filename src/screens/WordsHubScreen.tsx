// 単語タブ = 世界観ハブ。全画面イラスト(ヒーロー)＋下端アイコン列。
// アイコン/ホットスポットをタップ＝画面遷移せず・背景も動かさず、そのボタンの上に
// KubunCard(成長バッジ/バー/リスト/聞き取り/書き取り 等)をトグル表示する。✦=オススメは遷移。
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList, WordsStackParamList, Kubun } from '../navigation/types';
import { ImmersiveTab, type TabEntry } from '../components/TabScene';
import { useTabBg, useTabBlink } from '../data/tabArt';
import KubunCard from '../components/KubunCard';
import { useColors } from '../theme';
import { useT } from '../i18n';

type Nav = NativeStackNavigationProp<WordsStackParamList & RootStackParamList>;

export default function WordsHubScreen() {
  const nav = useNavigation<Nav>();
  const t = useT();
  const c = useColors();
  const bg = useTabBg('word');
  const blinkBg = useTabBlink('word');
  const card = (k: Kubun) => () => <KubunCard kubun={k} />;

  return (
    <View style={[styles.c, { backgroundColor: c.bg }]}>
      <ImmersiveTab
        source={bg}
        blinkSource={blinkBg}
        entries={[
          { key: 'kanji', glyph: '漢', label: t('cards.kanji'), accent: '#d9743f', renderCard: card('kanji') },
          { key: 'vocab', glyph: '語', label: t('cards.vocab'), accent: '#3f9d5a', renderCard: card('vocab') },
          { key: 'grammar', glyph: '文', label: t('cards.grammar'), accent: '#7b6bd6', renderCard: card('grammar') },
          { key: 'reco', glyph: '✦', label: t('cards.reco'), accent: '#2f80b8', onGo: () => nav.navigate('WordDrill', { kind: 'mixed' }) },
        ] as TabEntry[]}
        hotspots={[
          { key: 'vocab', label: t('cards.vocab'), area: { left: '12%', top: '17%', width: '15%', height: '11%' } },
          { key: 'grammar', label: t('cards.grammar'), area: { left: '28%', top: '16%', width: '15%', height: '11%' } },
          { key: 'kanji', label: t('cards.kanji'), area: { left: '42%', top: '17%', width: '15%', height: '11%' } },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1 },
});
