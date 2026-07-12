// 単語タブ = 世界観ハブ。上部=全画面イラスト(ヒーロー)＋下端アイコン列。
// アイコンをタップ＝画面遷移せず、下に そのボタンのカード(KubunCard=成長バッジ/バー/リスト/聞き取り/書き取り 等)を表示。
import { useRef, useState } from 'react';
import { View, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList, WordsStackParamList, Kubun } from '../navigation/types';
import { TabBackground, PopoverBar, Hotspot, type TabEntry } from '../components/TabScene';
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
  const { height } = useWindowDimensions();
  const [sel, setSel] = useState<Kubun>('kanji');
  const scrollRef = useRef<ScrollView>(null);
  const heroH = height * 0.82;
  const pick = (k: Kubun) => { setSel(k); requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: heroH * 0.62, animated: true })); };
  const goReco = () => nav.navigate('WordDrill', { kind: 'mixed' });

  return (
    <View style={[styles.c, { backgroundColor: c.bg }]}>
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}>
        <View style={{ height: heroH }}>
          <TabBackground source={bg} blinkSource={blinkBg}>
            <Hotspot label={t('cards.vocab')} area={{ left: '12%', top: '17%', width: '15%', height: '11%' }} onPress={() => pick('vocab')} />
            <Hotspot label={t('cards.grammar')} area={{ left: '28%', top: '16%', width: '15%', height: '11%' }} onPress={() => pick('grammar')} />
            <Hotspot label={t('cards.kanji')} area={{ left: '42%', top: '17%', width: '15%', height: '11%' }} onPress={() => pick('kanji')} />
            <PopoverBar entries={[
              { key: 'vocab', glyph: '語', label: t('cards.vocab'), accent: '#3f9d5a', onGo: () => pick('vocab') },
              { key: 'grammar', glyph: '文', label: t('cards.grammar'), accent: '#7b6bd6', onGo: () => pick('grammar') },
              { key: 'kanji', glyph: '漢', label: t('cards.kanji'), accent: '#d9743f', onGo: () => pick('kanji') },
              { key: 'reco', glyph: '✦', label: t('cards.reco'), accent: '#2f80b8', onGo: goReco },
            ] as TabEntry[]} />
          </TabBackground>
        </View>
        <View style={styles.cardArea}>
          <KubunCard kubun={sel} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1 },
  cardArea: { padding: 16, paddingBottom: 40 },
});
