// 受信箱(ホーム上部の🔔から開く) = 「運営からのお知らせ」＋「友だちからの応援」の統合表示。
//  ・運営のお知らせ(全員一律・未ログインでも表示)を上に、友だちの応援を下に並べる。
//  ・開いた時点で両方を既読化(バッジが消える)。応援=サーバー既読 / お知らせ=端末ローカル既読。
//  ・応援は固定種+自由文。送り主を通報できる(UGC対策 Apple 1.2)。運営のお知らせは通報不可(公式)。
import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { cheerInbox, cheerMarkRead, friendReport, type CheerInboxItem } from '../plaza/friendsClient';
import { fetchAnnouncements, pickAnnounce, announceReadAtMs, markAnnounceRead, type Announcement } from '../plaza/announceClient';
import { useColors, type ThemeColors } from '../theme';
import { useT, useUiLang } from '../i18n';

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
  const lang = useUiLang();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const [items, setItems] = useState<CheerInboxItem[] | null>(null);     // 友だちの応援
  const [anns, setAnns] = useState<Announcement[] | null>(null);          // 運営のお知らせ
  const [readAt, setReadAt] = useState(0);                                // 開いた時点の既読基準(お知らせの未読ハイライト用)

  useEffect(() => {
    let alive = true;
    (async () => {
      const prevRead = await announceReadAtMs();                          // 既読化する前の基準を控える
      const [a, list] = await Promise.all([fetchAnnouncements(), cheerInbox()]);
      if (!alive) return;
      setReadAt(prevRead);
      setAnns(a);
      setItems(list);
      cheerMarkRead();   // 応援を既読化(結果は待たない・未ログインは no-op)
      markAnnounceRead(); // お知らせを既読化(端末ローカル)
    })();
    return () => { alive = false; };
  }, []);

  // 通報(この送り主を報告＝サーバー記録＋即ブロック)。以後この人からのメッセージは届かない。UGC対策(Apple 1.2)。
  const onReport = (it: CheerInboxItem) => {
    Alert.alert(t('town.report_title'), t('town.report_body', { nick: it.from_nick ?? t('town.friend') }), [
      { text: t('town.cancel'), style: 'cancel' },
      { text: t('town.report_do'), style: 'destructive', onPress: () => {
        void friendReport(it.from_user);
        setItems((xs) => (xs ?? []).filter((x) => x.from_user !== it.from_user)); // この人の受信をその場で全て隠す
      } },
    ]);
  };

  const loading = items === null || anns === null;
  const empty = !loading && (anns?.length ?? 0) === 0 && (items?.length ?? 0) === 0;

  return (
    <SafeAreaView style={s.wrap} edges={['top', 'bottom']}>
      <View style={s.head}>
        <Text style={s.title}>{t('inbox.title')}</Text>
        <Pressable onPress={() => nav.goBack()} hitSlop={12} style={s.close}><Ionicons name="close" size={22} color={c.ink} /></Pressable>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={c.blue} /></View>
      ) : empty ? (
        <View style={s.center}>
          <Text style={s.emptyEmoji}>📭</Text>
          <Text style={s.emptyT}>{t('inbox.empty')}</Text>
          <Text style={s.emptySub}>{t('cheerinbox.empty_sub')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
          {/* 運営からのお知らせ(公式・通報不可) */}
          {(anns?.length ?? 0) > 0 && (
            <>
              <Text style={s.sectionH}>{t('inbox.section_official')}</Text>
              {anns!.map((a) => {
                const { title, body } = pickAnnounce(a, lang);
                const unread = Date.parse(a.created_at) > readAt;
                return (
                  <View key={'ann:' + a.id} style={[s.row, s.annRow, unread && s.rowUnread]}>
                    {/* 運営が絵文字を指定した時だけそれを表示。既定はシンプルな線アイコン(旧: 金のラッパ 📣 を廃止)。 */}
                    {a.emoji ? <Text style={s.emoji}>{a.emoji}</Text> : <Ionicons name="information-circle-outline" size={26} color={c.mute} style={s.emojiIcon} />}
                    <View style={{ flex: 1 }}>
                      <View style={s.annTop}>
                        <Text style={s.annBadge}>{t('inbox.official_tag')}</Text>
                        <Text style={s.annTitle} numberOfLines={2}>{title}</Text>
                      </View>
                      <Text style={s.annBody}>{body}</Text>
                    </View>
                    <Text style={s.time}>{ago(a.created_at, t)}</Text>
                  </View>
                );
              })}
            </>
          )}

          {/* 友だちからの応援 */}
          {(items?.length ?? 0) > 0 && (
            <>
              <Text style={s.sectionH}>{t('inbox.section_cheer')}</Text>
              {items!.map((it) => {
                // 自由メッセージ(body有)はその本文を表示。定型は6種の絵文字＋ラベル。
                const custom = (it.body ?? '').trim();
                const emoji = custom ? '💬' : (CHEER_EMOJI[it.cheer_key] ?? '🌸');
                const unread = !it.read_at;
                return (
                  <View key={'cheer:' + it.id} style={[s.row, unread && s.rowUnread]}>
                    <Text style={s.emoji}>{emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.name} numberOfLines={1}>{it.from_nick ?? t('town.friend')}</Text>
                      <Text style={s.msg} numberOfLines={2}>{custom || t('town.cheer.' + it.cheer_key)}</Text>
                    </View>
                    <Text style={s.time}>{ago(it.created_at, t)}</Text>
                    <Pressable onPress={() => onReport(it)} hitSlop={8} style={s.report} accessibilityLabel={t('town.report_title')}>
                      <Ionicons name="flag-outline" size={16} color={c.mute} />
                    </Pressable>
                  </View>
                );
              })}
            </>
          )}
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
  sectionH: { fontSize: 12, fontWeight: '900', color: c.mute, marginTop: 8, marginBottom: 2, letterSpacing: 0.3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line },
  rowUnread: { borderColor: c.blue, backgroundColor: c.blueLight },
  // 運営のお知らせ: 本文が長いので上寄せ。公式タグを付ける。
  annRow: { alignItems: 'flex-start' },
  annTop: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  annBadge: { fontSize: 10, fontWeight: '900', color: '#fff', backgroundColor: c.blue, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, overflow: 'hidden' },
  annTitle: { fontSize: 15, fontWeight: '900', color: c.ink, flexShrink: 1 },
  annBody: { fontSize: 13, color: c.ink, marginTop: 4, fontWeight: '600', lineHeight: 19 },
  emoji: { fontSize: 28 },
  emojiIcon: { width: 30, textAlign: 'center' },
  name: { fontSize: 15, fontWeight: '900', color: c.ink },
  msg: { fontSize: 13, color: c.mute, marginTop: 2, fontWeight: '700' },
  time: { fontSize: 12, color: c.mute, fontWeight: '700' },
  report: { padding: 4, marginLeft: 2 },
});
