// ダウンロード画面(設定の2段階目)。設定タブの「一括ダウンロード」ボタンから開くモーダル。
// 旧・設定タブに分かれていた「聴解音声(レベル別)」カードと「コンテンツ更新」カードをここに統合＝設定画面をシンプルに保つ。
// 流れ: 設定 →[一括ダウンロード]→ この画面でレベルを選んで聴解音声をDL / 問題・翻訳を更新。
import { useMemo, useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useT } from '../i18n';
import type { Level } from '../engine/engine';
import ListeningDownloadGate from '../components/ListeningDownloadGate';
import { listeningAudioIdsFor } from '../data';
import { LISTENING_CACHEABLE, listeningReady, listeningBytesEstimate } from '../data/listeningAudio';
import { syncContent } from '../data/content/ota';
import * as Updates from 'expo-updates';

const LEVELS: Level[] = ['N5', 'N4', 'N3'];

// 聴解音声の「レベル別・一括ダウンロード」1行。そのレベルがDL済みなら「✓ ダウンロード済」、未DLなら[一括ダウンロード]ボタン。
// refreshKey が変わるたびに端末キャッシュの有無を再判定する(DL完了直後に済表示へ更新)。
function LevelAudioRow({ level, refreshKey, onDownload, s, t }: {
  level: Level; refreshKey: number; onDownload: (lv: Level) => void;
  s: ReturnType<typeof makeStyles>; t: ReturnType<typeof useT>;
}) {
  const ids = useMemo(() => listeningAudioIdsFor(level), [level]);
  const mb = Math.max(1, Math.round(listeningBytesEstimate(ids) / 1048576));
  const [ready, setReady] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    if (!LISTENING_CACHEABLE) { setReady(true); return () => { alive = false; }; }
    listeningReady(ids).then((r) => { if (alive) setReady(r); }).catch(() => { if (alive) setReady(false); });
    return () => { alive = false; };
  }, [ids, refreshKey]);
  return (
    <View style={s.dlRow}>
      <View style={{ flex: 1 }}>
        <Text style={s.dlLevel}>{level}</Text>
        <Text style={s.dlSize}>{mb} MB</Text>
      </View>
      {ready ? (
        <Text style={s.dlDone}>✓ {t('profile.audioDownloaded')}</Text>
      ) : (
        <Pressable style={s.dlBtn} onPress={() => onDownload(level)}>
          <Text style={s.dlBtnTxt}>{t('profile.listeningAudio_download')}</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function DownloadScreen() {
  const t = useT();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const nav = useNavigation();
  // 聴解音声のDL: レベルごとに独立(N5/N4/N3)。dlLevel=モーダルで開いているレベル。dlRefresh=完了後に各行の済/未を再判定。
  const [dlLevel, setDlLevel] = useState<Level | null>(null);
  const [dlRefresh, setDlRefresh] = useState(0);
  // 問題・翻訳の手動更新(聞いてからDL)。DL後は反映のため再読み込みを提案。
  const [updating, setUpdating] = useState(false);
  const onUpdateContent = async () => {
    if (updating) return;
    setUpdating(true);
    try {
      const n = await syncContent();
      if (n > 0) {
        Alert.alert(t('content.update_title'), t('content.update_done', { n }), [
          { text: t('content.update_later'), style: 'cancel' },
          { text: t('content.update_reload'), onPress: () => { Updates.reloadAsync().catch(() => {}); } },
        ]);
      } else {
        Alert.alert(t('content.update_title'), t('content.update_latest'));
      }
    } catch {
      Alert.alert(t('content.update_title'), t('content.update_fail'));
    } finally { setUpdating(false); }
  };

  return (
    <SafeAreaView style={s.c} edges={['top']}>
      <View style={s.head}>
        <Text style={s.title}>{t('download.section')}</Text>
        <Pressable onPress={() => nav.goBack()} hitSlop={12} accessibilityLabel={t('nav.close')}>
          <Text style={s.close}>×</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.hint}>{t('download.hint')}</Text>

        {/* 聴解音声のダウンロード(レベル別・一括)。各レベルを独立して端末に保存=オフライン再生。 */}
        <Text style={s.sectionH}>{t('profile.listeningAudio')}</Text>
        <View style={s.card}>
          <Text style={s.subtle}>{t('profile.listeningAudioHint_download')}</Text>
          {LEVELS.map((lv) => (
            <LevelAudioRow key={lv} level={lv} refreshKey={dlRefresh} onDownload={setDlLevel} s={s} t={t} />
          ))}
        </View>

        {/* コンテンツ更新(問題・翻訳の追加ダウンロード)。自動同期はWi-Fiのみ・ここは手動で今すぐ取得。 */}
        <Text style={s.sectionH}>{t('content.section')}</Text>
        <View style={s.card}>
          <Pressable style={s.linkRow} onPress={onUpdateContent} disabled={updating}>
            <Text style={s.linkTxt}>{updating ? t('content.updating') : t('content.updateContent')}</Text>
            <Text style={s.chev}>›</Text>
          </Pressable>
          <Text style={s.updNote}>{t('content.updateWifiNote')}</Text>
        </View>
      </ScrollView>
      {dlLevel ? (
        <View style={StyleSheet.absoluteFill}>
          <ListeningDownloadGate level={dlLevel} allowSkip manual autoStart onComplete={() => { setDlLevel(null); setDlRefresh((x) => x + 1); }} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  c: { flex: 1, backgroundColor: c.bg },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { fontSize: ty.h1, fontWeight: '800', color: c.ink },
  close: { fontSize: 30, color: c.mute, fontWeight: '700', paddingHorizontal: spacing.xs },
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
  hint: { fontSize: ty.small, color: c.mute, marginBottom: spacing.xs },
  sectionH: { fontSize: ty.small, fontWeight: '800', color: c.ink2, marginTop: spacing.md },
  card: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: spacing.md, gap: spacing.sm },
  subtle: { fontSize: ty.small, color: c.mute },
  dlRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dlLevel: { fontSize: ty.body, fontWeight: '800', color: c.ink },
  dlSize: { fontSize: ty.small, color: c.mute },
  dlDone: { fontSize: ty.small, fontWeight: '700', color: c.green },
  dlBtn: { backgroundColor: c.blue, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  dlBtnTxt: { fontSize: ty.small, fontWeight: '800', color: '#fff' },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  linkTxt: { fontSize: ty.body, fontWeight: '700', color: c.blue },
  chev: { fontSize: ty.body, color: c.blue, fontWeight: '700' },
  updNote: { fontSize: ty.small, color: c.mute },
});
