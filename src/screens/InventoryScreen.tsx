// アイテム(所持品)一覧。上部バーの袋アイコンから開く。
//  ・道具(模試チケット等)/持ち物(着せ替え・仲間の購入品)/称号バッジ(合格・学習の獲得段位)を一覧。
//  ・購入は桜貝ショップ。ここは所持の確認と、装備中の把握・バッジコレクションの入口。
import { useMemo, useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useT } from '../i18n';
import { useAppState, useAppActions } from '../store/store';
import { isEquipped, type ShopKind } from '../store/wallet';
import { SHOP, SHOP_BY_ID, KIND_LABEL, type ShopItem } from '../data/shop';
import { mockTicketCount, MAX_MOCK_TICKETS } from '../store/tickets';
import { homeStatus } from '../home/homeStatus';
import { coverageBars } from '../store/selectors';
import Badge from '../components/Badge';
import BadgeCollection from '../components/BadgeCollection';
import { badgeTierIndex, type BadgeMetric } from '../data/badges';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// 持ち物はカテゴリー(kind)別に並べる。順=SHOPカタログ順(筆=レベル順で天の霊筆が最後、各カテゴリのnoneが先頭)。
const SHOP_ORDER: Record<string, number> = Object.fromEntries(SHOP.map((it, idx) => [it.id, idx]));
const KIND_ORDER: ShopKind[] = ['hair', 'brush', 'costume', 'companion'];

export default function InventoryScreen() {
  const t = useT();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const nav = useNavigation<Nav>();
  const state = useAppState();
  const { equipItem } = useAppActions();
  const now = Date.now();

  const owned = (state.owned ?? []).map((id) => SHOP_BY_ID[id]).filter(Boolean) as ShopItem[];
  const tools = owned.filter((i) => i.cat === 'tool' && i.id !== 'tool_mock_ticket'); // 模試チケットは枚数管理で別表示
  const ticketItem = SHOP_BY_ID['tool_mock_ticket'];
  const tickets = mockTicketCount(state);
  const belongings = owned.filter((i) => i.cat === 'dressup' || i.cat === 'companion');

  const status = useMemo(() => homeStatus(state, now), [state]); // eslint-disable-line react-hooks/exhaustive-deps
  const bars = useMemo(() => coverageBars(state, now), [state]); // eslint-disable-line react-hooks/exhaustive-deps
  const totalLearned = bars.reduce((a, b) => a + b.learned, 0);
  const totalItems = bars.reduce((a, b) => a + b.total, 0);
  const coverPct = totalItems > 0 ? Math.round((totalLearned / totalItems) * 100) : 0;
  const passPct = status.passPct;
  const badgeSet = state.settings.badgeSet ?? 'gorgeous';
  const [coll, setColl] = useState<{ metric: BadgeMetric; pct: number } | null>(null);

  const card = (i: ShopItem) => {
    const equipped = isEquipped(state, { id: i.id, kind: i.kind });
    const equippable = i.kind !== 'tool';
    return (
      <Pressable
        key={i.id}
        style={[s.card, equipped && s.cardOn]}
        disabled={!equippable || equipped}
        onPress={() => equipItem({ id: i.id, kind: i.kind })}
      >
        {i.asset ? (
          <View style={[s.prev, s.prevImg]}><Image source={i.asset} style={s.prevInner} resizeMode="contain" /></View>
        ) : (
          <View style={[s.prev, s.prevEmoji]}><Text style={s.emoji}>{i.emoji ?? '❔'}</Text></View>
        )}
        <Text style={s.cardName} numberOfLines={1}>{i.name}</Text>
        {i.rarity ? <Text style={s.rarity}>{'★'.repeat(i.rarity)}<Text style={s.rarityOff}>{'★'.repeat(5 - i.rarity)}</Text></Text> : null}
        {equipped ? <Text style={s.equipped}>{t('inventory.equipped')}</Text>
          : equippable ? <Text style={s.equipHint}>{t('inventory.equip')}</Text> : null}
      </Pressable>
    );
  };

  const emptyHint = (
    <Pressable style={s.empty} onPress={() => nav.navigate('Shop')}>
      <Text style={s.emptyTxt}>{t('inventory.empty')}</Text>
      <Text style={s.emptyLink}>{t('inventory.to_shop')} ›</Text>
    </Pressable>
  );

  const badgeRow = (metric: BadgeMetric, pct: number, titleKey: string) => {
    const done = badgeTierIndex(pct) + 1; // 獲得段位数(1-10)
    return (
      <Pressable style={s.badgeRow} onPress={() => setColl({ metric, pct })}>
        <Badge set={badgeSet} metric={metric} pct={pct} size={58} />
        <View style={s.badgeMeta}>
          <Text style={s.badgeTitle}>{t(titleKey)}</Text>
          <Text style={s.badgeCount}>{t('inventory.badge_count', { done })}</Text>
        </View>
        <Text style={s.chev}>›</Text>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={s.c} edges={['top']}>
      <View style={s.head}>
        <Text style={s.title}>{t('inventory.title')}</Text>
        <Pressable onPress={() => nav.goBack()} hitSlop={12}><Text style={s.closeX}>✕</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <Text style={s.section}>{t('inventory.tools')}</Text>
        <View style={s.grid}>
          <View style={s.card}>
            <View style={[s.prev, s.prevEmoji]}><Text style={s.emoji}>{ticketItem?.emoji ?? '🎫'}</Text></View>
            <Text style={s.cardName} numberOfLines={1}>{ticketItem?.name ?? '模試チケット'}</Text>
            <Text style={s.ticketN}>{tickets} / {MAX_MOCK_TICKETS}</Text>
          </View>
          {tools.map(card)}
        </View>

        <Text style={s.section}>{t('inventory.items')}</Text>
        {belongings.length ? (
          KIND_ORDER.map((k) => {
            const items = belongings
              .filter((i) => i.kind === k)
              .sort((a, b) => (SHOP_ORDER[a.id] ?? 999) - (SHOP_ORDER[b.id] ?? 999));
            if (!items.length) return null;
            return (
              <View key={k}>
                <Text style={s.subSection}>{KIND_LABEL[k]}</Text>
                <View style={s.grid}>{items.map(card)}</View>
              </View>
            );
          })
        ) : emptyHint}

        <Text style={s.section}>{t('inventory.badges')}</Text>
        {badgeRow('pass', passPct, badgeSet === 'natural' ? 'inventory.badge_pass_nat' : 'inventory.badge_pass')}
        {badgeRow('cover', coverPct, 'inventory.badge_cover')}
      </ScrollView>
      <BadgeCollection
        visible={coll !== null}
        onClose={() => setColl(null)}
        set={badgeSet}
        metric={coll?.metric ?? 'pass'}
        pct={coll?.pct ?? null}
      />
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    c: { flex: 1, backgroundColor: c.bg },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs },
    title: { fontSize: ty.h1, fontWeight: '800', color: c.ink },
    closeX: { fontSize: ty.h2, color: c.mute, fontWeight: '700' },
    body: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.xs },
    section: { fontSize: ty.small, fontWeight: '800', color: c.ink2, marginTop: spacing.md, marginBottom: spacing.sm },
    subSection: { fontSize: ty.tiny, fontWeight: '800', color: c.mute, letterSpacing: 1, marginTop: spacing.sm, marginBottom: spacing.xs },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    card: { width: '31%', backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: spacing.sm, alignItems: 'center', overflow: 'hidden' },
    cardOn: { borderColor: c.blue, backgroundColor: c.blueLight },
    equipHint: { marginTop: 2, fontSize: ty.tiny, fontWeight: '700', color: c.mute },
    prev: { width: '100%', aspectRatio: 1, borderRadius: radius.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    prevInner: { width: '72%', height: '72%' }, // カード内に余白を残して収める
    prevImg: { backgroundColor: '#f7efe0' },
    prevEmoji: { backgroundColor: c.bgSoft, alignItems: 'center', justifyContent: 'center' }, emoji: { fontSize: 34 },
    cardName: { marginTop: spacing.xs, fontSize: ty.tiny, fontWeight: '800', color: c.ink, textAlign: 'center' },
    rarity: { fontSize: 11, color: '#e0a63c', letterSpacing: 1, marginTop: 1 }, rarityOff: { color: c.line },
    equipped: { marginTop: 2, fontSize: ty.tiny, fontWeight: '800', color: c.blue },
    ticketN: { marginTop: 2, fontSize: ty.small, fontWeight: '900', color: c.ink, fontVariant: ['tabular-nums'] },
    empty: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, borderStyle: 'dashed', padding: spacing.md, alignItems: 'center', gap: 4 },
    emptyTxt: { fontSize: ty.small, color: c.mute },
    emptyLink: { fontSize: ty.small, color: c.blue, fontWeight: '800' },
    badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: spacing.md, marginBottom: spacing.sm },
    badgeMeta: { flex: 1 },
    badgeTitle: { fontSize: ty.body, fontWeight: '800', color: c.ink },
    badgeCount: { fontSize: ty.small, color: c.mute, marginTop: 2 },
    chev: { fontSize: ty.h2, color: c.trace, fontWeight: '700' },
  });
