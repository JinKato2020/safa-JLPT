// ポスター朗読: ポスター画像を表示し、各カードをハイライトしながら母語→日本語の順で音声を連続再生する。
//  ・画像/音声は現在のUI言語(useUiLang)で自動切替(imageL1 / card.l1)。資源はPages配信+端末キャッシュ(posterAssets)。
//  ・下部ドックに現在カードの拡大(ポスターを切り抜き拡大)を表示。タップで再生/停止。
//  ・聞いて話せる日本語 の PosterAudioScreen を移植。再生層を expo-audio → expo-av(Audio.Sound) に書換、
//    多ページ/スワイプ等の未使用機能は削除(パイロット=単一ページ)。
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Image, ScrollView, Pressable, useWindowDimensions, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Audio, type AVPlaybackStatus } from 'expo-av';
import Svg, { Path } from 'react-native-svg';
import { spacing, radius, useColors } from '../theme';
import { useT, useUiLang } from '../i18n';
import { POSTER_LESSONS, type PosterLesson, type PosterCard } from '../data/posterLessons';
import { posterUri, ensurePosterPack, isPosterReady } from '../data/posterAssets';

type QItem = { idx: number; phase: 'ja' | 'l1'; src?: string };

export default function PosterAudioScreen() {
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const c = useColors();
  const t = useT();
  const lang = useUiLang();
  const { width, height } = useWindowDimensions();

  const lessonId: string | undefined = route.params?.lessonId;
  const li = Math.max(0, POSTER_LESSONS.findIndex((l) => l.id === lessonId));
  const lesson: PosterLesson = POSTER_LESSONS[li] || POSTER_LESSONS[0];

  const pickByLang = (m?: Record<string, string>) => (m ? (m[lang] ?? m.en ?? Object.values(m)[0]) : undefined);
  const l1AudioOf = (c2: PosterCard) => pickByLang(c2.l1);
  const lessonImageKey = pickByLang(lesson.imageL1);

  const [ready, setReady] = useState(false);
  const [idx, setIdx] = useState(0);            // 表示中カード
  const [phase, setPhase] = useState<'ja' | 'l1'>('l1');
  const [playing, setPlaying] = useState(false);
  const [lay, setLay] = useState({ cont: 0, dock: 0 });

  const scrollRef = useRef<ScrollView>(null);
  const soundRef = useRef<Audio.Sound | null>(null);   // 再生中のSound
  const qiRef = useRef(0);                              // 再生中のキュー位置
  const tokRef = useRef(0);                             // stale invalidation
  const playingRef = useRef(false);
  const wdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceRef = useRef<() => void>(() => {});

  const PAD = spacing.sm;
  const dispW = width - PAD * 2;

  // 再生キュー: タイトル母語→日 → カード0母語→日 → カード1母語→日 → …(ready後に配信キーをuriへ解決)
  const queue = useMemo<QItem[]>(() => {
    const q: QItem[] = [];
    if (lesson.titleAudio) {
      q.push({ idx: -1, phase: 'l1', src: posterUri(pickByLang(lesson.titleAudio.l1) ?? lesson.titleAudio.ja) });
      q.push({ idx: -1, phase: 'ja', src: posterUri(lesson.titleAudio.ja) });
    }
    lesson.cards.forEach((card, i) => {
      q.push({ idx: i, phase: 'l1', src: posterUri(l1AudioOf(card) ?? card.ja) });
      q.push({ idx: i, phase: 'ja', src: posterUri(card.ja) });
    });
    return q;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, lang, ready]);
  const queueRef = useRef(queue); queueRef.current = queue;

  // 音声モード(マナーモードでも鳴らす)。聴解画面と同方針。
  useEffect(() => { Audio.setAudioModeAsync({ playsInSilentModeIOS: true }).catch(() => {}); }, []);

  // テーマ/言語が変わったらリセット+パックDL。完了で ready=true。
  useEffect(() => {
    let alive = true;
    stop();
    setReady(false); setIdx(0); setPhase('l1');
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    (async () => {
      // ローカル優先: 既にパックが端末に揃っていれば通信を待たず即表示(=毎回のカタログ問い合わせで真っ白になるのを防ぐ)。
      try { if (await isPosterReady(lesson, lang) && alive) setReady(true); } catch {}
      // 最新版チェック/初回DLは裏で。版が同じなら即スキップ、違えば取り直し。完了で(まだなら)ready=true。
      try { await ensurePosterPack(lang); } catch { /* 失敗は握りつぶし(欠落許容) */ }
      if (alive) setReady(true);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, lang]);

  // アンマウントで確実に停止・解放。
  useEffect(() => () => { void unloadCur(); if (wdRef.current) clearTimeout(wdRef.current); }, []);

  async function unloadCur() {
    const s = soundRef.current; soundRef.current = null;
    if (s) { try { await s.stopAsync(); } catch {} try { await s.unloadAsync(); } catch {} }
  }

  // 1クリップ再生(逐次)。終了/取りこぼしで次へ。
  const playClip = async (qi: number) => {
    const q = queueRef.current;
    if (qi < 0 || qi >= q.length) { stop(); return; }
    const tok = ++tokRef.current;
    qiRef.current = qi;
    setIdx(q[qi].idx); setPhase(q[qi].phase);
    if (wdRef.current) clearTimeout(wdRef.current);
    await unloadCur();
    const src = q[qi].src;
    if (!src) { // 音源欠落は無音で詰まらせず即次へ
      wdRef.current = setTimeout(() => { if (tok === tokRef.current && playingRef.current) advanceRef.current(); }, 40);
      return;
    }
    try {
      const { sound } = await Audio.Sound.createAsync({ uri: src }, { shouldPlay: true }, (st: AVPlaybackStatus) => {
        if (tok !== tokRef.current || !playingRef.current) return;
        if (!st.isLoaded) return;
        if (st.didJustFinish) advanceRef.current();
      });
      if (tok !== tokRef.current || !playingRef.current) { try { await sound.unloadAsync(); } catch {} return; }
      soundRef.current = sound;
      // 保険: 完了イベント取りこぼし時も「クリップ長+1.5s」で復帰(既定8s)。
      const status = await sound.getStatusAsync();
      const ms = status.isLoaded && status.durationMillis ? status.durationMillis + 1500 : 8000;
      if (wdRef.current) clearTimeout(wdRef.current);
      wdRef.current = setTimeout(() => { if (tok === tokRef.current && playingRef.current) advanceRef.current(); }, ms);
    } catch {
      wdRef.current = setTimeout(() => { if (tok === tokRef.current && playingRef.current) advanceRef.current(); }, 40);
    }
  };

  advanceRef.current = () => {
    if (!playingRef.current) return;
    const next = qiRef.current + 1;
    if (next >= queueRef.current.length) { stop(); return; }
    void playClip(next);
  };

  // カード(index)→キュー位置(タイトル2件を考慮)
  const cardToQi = (cardIdx: number) => {
    const q = queueRef.current;
    for (let i = 0; i < q.length; i++) if (q[i].idx === cardIdx) return i;
    return 0;
  };
  const start = (from = 0) => {
    if (!ready) return;
    playingRef.current = true; setPlaying(true);
    const q = queueRef.current;
    if (from === 0 && q[0]?.idx === -1) void playClip(0);   // タイトルから
    else void playClip(cardToQi(from));
  };
  function stop() {
    tokRef.current++; playingRef.current = false; setPlaying(false);
    if (wdRef.current) clearTimeout(wdRef.current);
    void unloadCur();
  }
  const toggle = () => { if (playing) stop(); else start(idx >= 0 ? idx : 0); };

  const lessonImageUri = ready ? posterUri(lessonImageKey) : undefined;
  const hl = lesson.cards[idx >= 0 ? idx : 0] || lesson.cards[0];

  // 拡大: ポスターのセル枠ぴったりに切り抜きほぼ全幅へ拡大。
  const cx = hl.box.x, cy = hl.box.y;
  const ZOOM_W = Math.min(width - spacing.md * 2, 460);
  const zScale = hl.box.w > 0 ? ZOOM_W / hl.box.w : 1;
  const zoomH = Math.max(48, Math.round((hl.box.h || 0) * zScale));

  // ポスター縮尺: 横の予算と(ドックを除いた)縦の余白の両方に収める contain。onLayoutの実測値を使う。
  const measured = lay.cont > 0 && lay.dock > 0;
  const availH = measured
    ? Math.max(120, lay.cont - lay.dock - spacing.sm * 2)
    : Math.max(120, height - (zoomH + 180));
  const scale = Math.min(dispW / lesson.posterW, availH / lesson.posterH);
  const pw = Math.round(lesson.posterW * scale);
  const ph = Math.round(lesson.posterH * scale);

  const onContLayout = (e: any) => { const h = Math.round(e.nativeEvent.layout.height); setLay((l) => Math.abs(l.cont - h) > 1 ? { ...l, cont: h } : l); };
  const onDockLayout = (e: any) => { const h = Math.round(e.nativeEvent.layout.height); setLay((l) => Math.abs(l.dock - h) > 1 ? { ...l, dock: h } : l); };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.bg }]} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => nav.goBack()} hitSlop={12} style={styles.back}>
          <Svg width={24} height={24} viewBox="0 0 24 24"><Path d="M15 18l-6-6 6-6" stroke={c.ink} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" /></Svg>
        </Pressable>
        <Text style={[styles.title, { color: c.ink }]} numberOfLines={1}>{lesson.title}</Text>
        <View style={styles.back} />
      </View>

      <View style={styles.body} onLayout={onContLayout}>
        <ScrollView ref={scrollRef} contentContainerStyle={{ alignItems: 'center', paddingTop: spacing.sm, paddingBottom: (lay.dock || zoomH + 180) + spacing.sm }}>
          <View style={{ width: pw, height: ph }}>
            {ready && lessonImageUri
              ? <Image key={lessonImageUri} source={{ uri: lessonImageUri }} style={{ width: pw, height: ph, borderRadius: radius.md }} resizeMode="contain" />
              : <View style={{ width: pw, height: ph, borderRadius: radius.md, backgroundColor: '#fff' }} />}
            {hl && (
              <View pointerEvents="none" style={[styles.hl, { borderColor: c.blue, left: hl.box.x * scale, top: hl.box.y * scale, width: hl.box.w * scale, height: hl.box.h * scale }]} />
            )}
            {lesson.cards.map((card) => (
              <Pressable key={card.i} onPress={() => start(card.i)}
                style={{ position: 'absolute', left: card.box.x * scale, top: card.box.y * scale, width: card.box.w * scale, height: card.box.h * scale }} />
            ))}
          </View>
        </ScrollView>

        <View style={[styles.dock, { backgroundColor: c.surface, borderTopColor: c.line }]} onLayout={onDockLayout}>
          <Pressable onPress={toggle} style={[styles.zoomWrap, { width: ZOOM_W, height: zoomH }]}>
            {ready && lessonImageUri && (
              <Image key={lessonImageUri} source={{ uri: lessonImageUri }}
                style={{ position: 'absolute', width: lesson.posterW * zScale, height: lesson.posterH * zScale, left: -cx * zScale, top: -cy * zScale }}
                resizeMode="contain" />
            )}
            {!ready ? (
              <View style={styles.playHint}><ActivityIndicator color="#fff" /></View>
            ) : !playing && (
              <View style={styles.playHint}><Svg width={26} height={26} viewBox="0 0 24 24"><Path d="M8 5v14l11-7z" fill="#fff" /></Svg></View>
            )}
          </Pressable>
          <View style={styles.bar}>
            <Text style={[styles.count, { color: c.ink }]}>{li + 1} / {POSTER_LESSONS.length}</Text>
            <Text style={[styles.hint, { color: c.faint }]}>{ready ? t('poster.hint') : t('poster.preparing')}</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  back: { width: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700' },
  body: { flex: 1 },
  hl: { position: 'absolute', borderWidth: 1.5, borderRadius: 12, backgroundColor: 'transparent' },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: 1, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.md },
  zoomWrap: { overflow: 'hidden', backgroundColor: '#fff', alignSelf: 'center' },
  playHint: { position: 'absolute', top: '50%', left: '50%', marginLeft: -24, marginTop: -24, width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(40,48,74,0.78)', alignItems: 'center', justifyContent: 'center' },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.sm },
  count: { fontSize: 14, fontWeight: '700' },
  hint: { fontSize: 12, letterSpacing: 0.3 },
});
