// 聴解音声のレベル一括ダウンロード・ゲート。
// オンボード(レベル選択時・スキップ可)と聴解開始時に使用。
// 既にキャッシュ済 or 非対応端末(web)は即 onComplete。同意→DL(進捗)→完了/失敗(再試行)。
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { spacing, radius, type as ty, useColors } from '../theme';
import { useT } from '../i18n';
import type { Level } from '../engine/engine';
import { listeningAudioIdsFor } from '../data';
import { LISTENING_CACHEABLE, listeningReady, prefetchListening, listeningBytesEstimate } from '../data/listeningAudio';

// autoStart=true: 事前に方式を選択済み(=一括DL確定)なので、確認画面を出さずそのままDLへ進む。
export default function ListeningDownloadGate({ level, allowSkip, manual, autoStart, onComplete }: { level: Level; allowSkip: boolean; manual?: boolean; autoStart?: boolean; onComplete: () => void }) {
  const c = useColors();
  const t = useT();
  const ids = useMemo(() => listeningAudioIdsFor(level), [level]);
  const [phase, setPhase] = useState<'check' | 'consent' | 'dl' | 'error'>('check');
  const [pct, setPct] = useState(0);
  // DL中の中止(Apple審査 2.1(a)=DLに縛られず中断できること)。ref=ループから同期参照・state=ボタン表示切替。
  const cancelRef = useRef(false);
  const [cancelling, setCancelling] = useState(false);

  const mb = Math.max(1, Math.round(listeningBytesEstimate(ids) / 1048576));
  const start = async () => {
    cancelRef.current = false; setCancelling(false);
    setPhase('dl'); setPct(0);
    try {
      await prefetchListening(
        ids,
        (d, tot) => setPct(tot > 0 ? Math.round((d / tot) * 100) : 0),
        () => cancelRef.current,
      );
      onComplete(); // 完了 or 中止(残りは未取得)いずれもオーバーレイを閉じる。中止時は行が「未DL」のまま=再開可。
    } catch { setPhase('error'); }
  };
  const onCancel = () => { cancelRef.current = true; setCancelling(true); }; // 次クリップ前に prefetch が抜ける

  useEffect(() => {
    let alive = true;
    if (!LISTENING_CACHEABLE) { onComplete(); return; } // web等=ストリーミング、DL不要
    listeningReady(ids).then((r) => {
      if (!alive) return;
      if (r && !manual) { onComplete(); return; }      // 既にDL済み=そのまま完了
      if (autoStart) { void start(); } else { setPhase('consent'); } // 選択済みなら即DL / 未選択なら確認
    }).catch(() => { if (alive) { if (autoStart) void start(); else setPhase('consent'); } });
    return () => { alive = false; };
  }, [ids]); // eslint-disable-line react-hooks/exhaustive-deps

  if (phase === 'check') {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}><ActivityIndicator color={c.blue} /></View>;
  }
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: c.bg }}>
      <Text style={{ fontSize: 44, marginBottom: spacing.md }}>🎧</Text>
      <Text style={{ fontSize: ty.h2, fontWeight: '800', color: c.ink, textAlign: 'center', marginBottom: spacing.sm }}>{t('dl.title')}</Text>
      {phase === 'dl' ? (
        <>
          <Text style={{ fontSize: ty.small, color: c.mute, marginBottom: spacing.md }}>{t('dl.progress', { n: pct })}</Text>
          <View style={{ width: 220, height: 6, borderRadius: 3, backgroundColor: c.bgSoft, overflow: 'hidden' }}>
            <View style={{ width: `${pct}%`, height: '100%', backgroundColor: c.blue }} />
          </View>
          <Pressable onPress={onCancel} disabled={cancelling} hitSlop={8} style={{ marginTop: spacing.lg, opacity: cancelling ? 0.5 : 1 }}>
            <Text style={{ color: c.mute, fontSize: ty.small, fontWeight: '600' }}>{t('dl.cancel')}</Text>
          </Pressable>
        </>
      ) : phase === 'error' ? (
        <>
          <Text style={{ fontSize: ty.small, color: c.red, marginBottom: spacing.lg, textAlign: 'center' }}>{t('dl.fail')}</Text>
          <Pressable onPress={start} style={{ backgroundColor: c.blue, borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.xl }}>
            <Text style={{ color: '#ffffff', fontSize: ty.body, fontWeight: '800' }}>{t('dl.retry')}</Text>
          </Pressable>
          {allowSkip ? <Pressable onPress={onComplete} hitSlop={8} style={{ marginTop: spacing.lg }}><Text style={{ color: c.mute, fontSize: ty.small, fontWeight: '600' }}>{t('dl.later')}</Text></Pressable> : null}
        </>
      ) : (
        <>
          <Text style={{ fontSize: ty.small, color: c.ink2, textAlign: 'center', marginBottom: spacing.lg, lineHeight: 20 }}>{t('dl.body', { size: `${mb} MB` })}</Text>
          <Pressable onPress={start} style={{ backgroundColor: c.blue, borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.xl }}>
            <Text style={{ color: '#ffffff', fontSize: ty.body, fontWeight: '800' }}>{t('dl.now')}</Text>
          </Pressable>
          {allowSkip ? <Pressable onPress={onComplete} hitSlop={8} style={{ marginTop: spacing.lg }}><Text style={{ color: c.mute, fontSize: ty.small, fontWeight: '600' }}>{t('dl.later')}</Text></Pressable> : null}
        </>
      )}
    </View>
  );
}
