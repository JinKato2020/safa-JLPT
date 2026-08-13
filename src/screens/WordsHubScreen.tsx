// 単語タブ = 世界観ハブ。全画面イラスト(ヒーロー)＋下端アイコン列。
// アイコン/ホットスポットをタップ＝画面遷移せず・背景も動かさず、そのボタンの上に
// KubunCard(成長バッジ/バー/リスト/聞き取り/書き取り 等)をトグル表示する。✦=オススメは遷移。
import { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList, WordsStackParamList, Kubun } from '../navigation/types';
import { ImmersiveTab, StartCard, type TabEntry } from '../components/TabScene';
import { useTabBg, useTabBlink } from '../data/tabArt';
import KubunCard from '../components/KubunCard';
import UnlockCelebration from '../components/UnlockCelebration';
import { useAppState, useAppActions } from '../store/store';
import { firstUnseenUnlock, currentlyUnlocked, type UnlockKey } from '../store/unlocks';
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

  // 段階解禁の演出: しきい値に達したモードを1度だけお祝い。初回(未定義)は現解禁分を無音seed。
  const state = useAppState();
  const { seedUnlocksSeen, markUnlockSeen } = useAppActions();
  const [celebrate, setCelebrate] = useState<{ key: UnlockKey; labelKey: string; need: number } | null>(null);
  // カバー率スキャン(coverageBars)は state 変化時だけ。初回=seed / 以降=未演出の解禁を1件返す。
  const pending = useMemo(() => {
    const now = Date.now();
    const seed = state.unlocksSeen === undefined ? currentlyUnlocked(state, now) : null;
    return { seed, u: seed ? null : firstUnseenUnlock(state, now) };
  }, [state]);
  useEffect(() => {
    if (pending.seed) { seedUnlocksSeen(pending.seed); return; }
    if (!celebrate && pending.u) setCelebrate({ key: pending.u.key, labelKey: pending.u.labelKey, need: pending.u.need });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, celebrate]);
  const closeCelebrate = () => { if (celebrate) markUnlockSeen(celebrate.key); setCelebrate(null); };

  return (
    <View style={[styles.c, { backgroundColor: c.bg }]}>
      <ImmersiveTab
        source={bg}
        blinkSource={blinkBg}
        entries={[
          { key: 'kanji', glyph: '漢', label: t('cards.kanji'), accent: '#d9743f', renderCard: card('kanji') },
          { key: 'vocab', glyph: '語', label: t('cards.vocab'), accent: '#3f9d5a', renderCard: card('vocab') },
          { key: 'grammar', glyph: '文', label: t('cards.grammar'), accent: '#7b6bd6', renderCard: card('grammar') },
          // 桜(机に座る桜)タップで「試験問題の復習(統合復習)」の開始カード。旧mixedはここへ吸収。
          { key: 'reco', hidden: true, label: t('cards.reco'), accent: '#2f80b8',
            renderCard: () => <StartCard glyph="✦" accent="#2f80b8" title={t('cards.reco')} cta={t('cards.reco_start')} onStart={() => nav.navigate('Quiz', { review: true })} /> },
        ] as TabEntry[]}
        hotspots={[
          { key: 'vocab', label: t('cards.vocab'), area: { left: '12%', top: '17%', width: '15%', height: '11%' } },
          { key: 'grammar', label: t('cards.grammar'), area: { left: '28%', top: '16%', width: '15%', height: '11%' } },
          { key: 'kanji', label: t('cards.kanji'), area: { left: '42%', top: '17%', width: '15%', height: '11%' } },
          // 桜(机に座る桜)=新背景(書斎)では中央やや下。タップでオススメ開始カード。
          { key: 'reco', label: t('cards.reco'), area: { left: '35%', top: '41%', width: '31%', height: '25%' } },
        ]}
      />
      <UnlockCelebration
        visible={celebrate !== null}
        unlockKey={celebrate?.key ?? null}
        modeLabel={celebrate ? t(celebrate.labelKey) : ''}
        need={celebrate?.need ?? 0}
        onClose={closeCelebrate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1 },
});
