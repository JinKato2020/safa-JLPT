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
import { useT } from '../i18n';

// 応援キー→絵文字(ラベルは i18n town.cheer.<key> で解決)。旧定型も過去受信の表示用に残す。
const CHEER_EMOJI: Record<string, string> = {
  ganbaro: '📖', homeru: '🎉', // 現行2種
  flower: '🌷', ganbare: '💪', sugoi: '🎉', issho: '🤝', otsukare: '☕', nice: '🌸', // 旧定型
};

// 相対時刻(◯分前/◯時間前/◯日前)。厳密でなくてよい。表示言語は t で解決。
function ago(iso: string, t: (k: string, p?: Record<string, string | number>) => string): string {
  const ts = Date.parse(iso);
  if (isNaN(ts)) return '';
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return t('time.just_now');
  if (s < 3600) return t('time.min_ago', { n: Math.floor(s / 60) });
  if (s < 86400) return t('time.hour_ago', { n: Math.floor(s / 3600) });
  return t('time.day_ago', { n: Math.floor(s / 86400) });
}

export default function CheerInboxScreen() {
  const nav = useNavigation();
  const t = useT();
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
        <Text style={s.title}>{t('cheerinbox.title')}</Text>
        <Pressable onPress={() => nav.goBack()} hitSlop={12} style={s.close}><Ionicons name="close" size={22} color={c.ink} /></Pressable>
      </View>

      {items === null ? (
        <View style={s.center}><ActivityIndicator color={c.blue} /></View>
      ) : items.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyEmoji}>📭</Text>
          <Text style={s.emptyT}>{t('cheerinbox.empty')}</Text>
          <Text style={s.emptySub}>{t('cheerinbox.empty_sub')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
          {items.map((it) => {
            // 自由メッセージ(body有)はその本文を表示。定型は6種の絵文字＋ラベル。
            const custom = (it.body ?? '').trim();
            const emoji = custom ? '💬' : (CHEER_EMOJI[it.cheer_key] ?? '🌸');
            const unread = !it.read_at;
            return (
              <View key={it.id} style={[s.row, unread && s.rowUnread]}>
                <Text style={s.emoji}>{emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.name} numberOfLines={1}>{it.from_nick ?? t('town.friend')}</Text>
                  <Text style={s.msg} numberOfLines={2}>{custom || t('town.cheer.' + it.cheer_key)}</Text>
                </View>
                <Text style={s.time}>{ago(it.created_at, t)}</Text>
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
