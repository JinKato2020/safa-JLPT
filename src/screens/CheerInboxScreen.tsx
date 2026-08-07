// 受信箱: 友だち(自分が招待して参加してくれた町の住人)から届いた応援の一覧。
//  ・町の上部🔔から開く。開いた時点で未読を既読化(バッジが消える)。
//  ・固定6種の応援のみ(自由入力なし)。送り主のニックネームと種類・時刻を表示。
import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { cheerInbox, cheerMarkRead, type CheerInboxItem } from '../plaza/friendsClient';
import { useColors, type ThemeColors } from '../theme';

const CHEER_INFO: Record<string, { emoji: string; label: string }> = {
  flower: { emoji: '🌷', label: 'お花をおくる' },
  ganbare: { emoji: '💪', label: 'がんばって' },
  sugoi: { emoji: '🎉', label: 'すごい！' },
  issho: { emoji: '🤝', label: '一緒にがんばろう' },
  otsukare: { emoji: '☕', label: 'おつかれさま' },
  nice: { emoji: '🌸', label: 'いいね' },
};

// 相対時刻(◯分前/◯時間前/◯日前)。厳密でなくてよい。
function ago(iso: string): string {
  const t = Date.parse(iso);
  if (isNaN(t)) return '';
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return 'たった今';
  if (s < 3600) return `${Math.floor(s / 60)}分前`;
  if (s < 86400) return `${Math.floor(s / 3600)}時間前`;
  return `${Math.floor(s / 86400)}日前`;
}

export default function CheerInboxScreen() {
  const nav = useNavigation();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const [items, setItems] = useState<CheerInboxItem[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const list = await cheerInbox();
      if (!alive) return;
      setItems(list);
      cheerMarkRead(); // 開いた=既読化(結果は待たない)
    })();
    return () => { alive = false; };
  }, []);

  return (
    <SafeAreaView style={s.wrap} edges={['top', 'bottom']}>
      <View style={s.head}>
        <Text style={s.title}>とどいた応援</Text>
        <Pressable onPress={() => nav.goBack()} hitSlop={12} style={s.close}><Ionicons name="close" size={22} color={c.ink} /></Pressable>
      </View>

      {items === null ? (
        <View style={s.center}><ActivityIndicator color={c.blue} /></View>
      ) : items.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyEmoji}>📭</Text>
          <Text style={s.emptyT}>まだ応援は届いていません</Text>
          <Text style={s.emptySub}>友だちを町に招待して、いっしょに応援し合おう。</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
          {items.map((it) => {
            const info = CHEER_INFO[it.cheer_key] ?? { emoji: '🌸', label: '応援' };
            const unread = !it.read_at;
            return (
              <View key={it.id} style={[s.row, unread && s.rowUnread]}>
                <Text style={s.emoji}>{info.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.name} numberOfLines={1}>{it.from_nick ?? '友だち'}</Text>
                  <Text style={s.msg} numberOfLines={1}>{info.label}</Text>
                </View>
                <Text style={s.time}>{ago(it.created_at)}</Text>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: c.bg },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14 },
  title: { fontSize: 20, fontWeight: '900', color: c.ink },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bgSoft },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 8 },
  emptyEmoji: { fontSize: 48 },
  emptyT: { fontSize: 16, fontWeight: '800', color: c.ink },
  emptySub: { fontSize: 13, color: c.mute, textAlign: 'center', lineHeight: 20 },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line },
  rowUnread: { borderColor: c.blue, backgroundColor: c.blueLight },
  emoji: { fontSize: 28 },
  name: { fontSize: 15, fontWeight: '900', color: c.ink },
  msg: { fontSize: 13, color: c.mute, marginTop: 2, fontWeight: '700' },
  time: { fontSize: 12, color: c.mute, fontWeight: '700' },
});
