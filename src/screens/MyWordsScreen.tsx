// my単語帳(モーダル) = 「桜の書斎」。保存した 語彙/漢字/文法 を和綴じの3冊に分け、タップで各帳(=その区分だけの短いリスト)へ。
// 案内キャラ(桜の巫女)が下で瞬き＆ふわふわ、桜が舞う(RN Animated・依存追加なし・¥0)。瞬きは目だけ差し替えた同一絵の重ね替え。
// 保存参照 SaveRef({type}) を vocab/kanji/grammar.json から解決(未収載idは静かにスキップ)。復習=語彙+漢字を Flashcard へ。
// 単一モーダル・単一入口(辞書タブ最上部)は不変。
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList, Image, Animated, Easing, ImageBackground, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, type as ty, shadow, useColors, type ThemeColors } from '../theme';
import { useAppState, useAppActions } from '../store/store';
import type { SaveRef } from '../store/state';
import { VOCAB, GRAMMAR, KANJI, meaningIn } from '../data';
import { GUIDE, ROOM, type BookKind } from '../data/mywordsArt';
import { useT } from '../i18n';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const KINDS: BookKind[] = ['kanji', 'vocab', 'grammar']; // 表示順=漢字→語彙→文法(ユーザー指定)
const GUIDE_RATIO = 670 / 600; // アセットの縦横比

interface Row { ref: SaveRef; title: string; sub: string; big?: boolean }

// ── 舞い散る花びら1枚 ──
function Petal({ screenH, seed }: { screenH: number; seed: number }) {
  const prog = useRef(new Animated.Value(0)).current;
  const cfg = useRef({
    left: 4 + ((seed * 37) % 90),
    size: 8 + ((seed * 13) % 6),
    dur: 6200 + ((seed * 811) % 3800),
    delay: (seed * 523) % 5200,
    drift: 18 + ((seed * 29) % 42),
    deep: seed % 2 === 0,
  }).current;
  useEffect(() => {
    const anim = Animated.sequence([
      Animated.delay(cfg.delay),
      Animated.loop(Animated.timing(prog, { toValue: 1, duration: cfg.dur, easing: Easing.linear, useNativeDriver: true })),
    ]);
    anim.start();
    return () => anim.stop();
  }, []);
  const translateY = prog.interpolate({ inputRange: [0, 1], outputRange: [-20, screenH + 24] });
  const translateX = prog.interpolate({ inputRange: [0, 1], outputRange: [0, cfg.drift] });
  const rotate = prog.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '320deg'] });
  const opacity = prog.interpolate({ inputRange: [0, 0.12, 0.88, 1], outputRange: [0, 0.85, 0.85, 0] });
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', top: 0, left: `${cfg.left}%`, width: cfg.size, height: cfg.size,
      borderRadius: cfg.size, borderTopLeftRadius: cfg.size, borderBottomRightRadius: cfg.size, borderTopRightRadius: 0, borderBottomLeftRadius: 0,
      backgroundColor: cfg.deep ? '#e88bab' : '#f6b8cf', opacity,
      transform: [{ translateY }, { translateX }, { rotate }],
    }} />
  );
}

// ── 案内キャラ: ふわふわ＋瞬き(目だけ差し替えの重ね替え) ──
function BlinkingGuide({ width }: { width: number }) {
  const floatY = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const f = Animated.loop(Animated.sequence([
      Animated.timing(floatY, { toValue: -9, duration: 2400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(floatY, { toValue: 0, duration: 2400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    const b = Animated.loop(Animated.sequence([
      Animated.delay(5200),
      Animated.timing(blink, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(blink, { toValue: 0, duration: 90, useNativeDriver: true }),
      Animated.delay(120),
      Animated.timing(blink, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(blink, { toValue: 0, duration: 90, useNativeDriver: true }),
    ]));
    f.start(); b.start();
    return () => { f.stop(); b.stop(); };
  }, []);
  const h = width * GUIDE_RATIO;
  return (
    <Animated.View style={{ width, height: h, transform: [{ translateY: floatY }] }}>
      <Image source={GUIDE.open} style={{ width, height: h }} resizeMode="contain" />
      <Animated.Image source={GUIDE.blink} style={{ position: 'absolute', width, height: h, opacity: blink }} resizeMode="contain" />
    </Animated.View>
  );
}

export default function MyWordsScreen() {
  const nav = useNavigation<Nav>();
  const state = useAppState();
  const { addToMyList } = useAppActions();
  const c = useColors();
  const t = useT();
  const s = useMemo(() => makeStyles(c), [c]);
  const { width: winW, height: winH } = useWindowDimensions();
  const [view, setView] = useState<'shelf' | BookKind>('shelf');

  const l1 = state.settings.l1;
  const nm = (key: string, fallback: string) => (l1 && l1 !== 'en' ? meaningIn(key, l1) : undefined) ?? fallback;
  const accentOf = (k: BookKind) => (k === 'vocab' ? c.mojiGoi : k === 'kanji' ? c.dokkai : c.bunpou);
  const kanjiOf = (k: BookKind) => (k === 'vocab' ? '語' : k === 'kanji' ? '漢' : '文');
  const bookTitle = (k: BookKind) => t(k === 'vocab' ? 'mywords.book_vocab' : k === 'kanji' ? 'mywords.book_kanji' : 'mywords.book_grammar');

  const vocabById = useMemo(() => new Map(VOCAB.map((v) => [v.id, v])), []);
  const grammarById = useMemo(() => new Map(GRAMMAR.map((g) => [g.id, g])), []);
  const kanjiById = useMemo(() => new Map(KANJI.map((k) => [k.id, k])), []);

  const rowsByKind = useMemo(() => {
    const out: Record<BookKind, Row[]> = { vocab: [], kanji: [], grammar: [] };
    for (const ref of state.myList ?? []) {
      if (ref.type === 'vocab') {
        const v = vocabById.get(ref.id);
        if (v) out.vocab.push({ ref, title: v.word, sub: `${v.reading ? v.reading + ' ・ ' : ''}${nm(v.id, v.meaning)}` });
      } else if (ref.type === 'kanji') {
        const k = kanjiById.get(ref.id);
        if (k) out.kanji.push({ ref, title: k.char, sub: nm(k.char, k.meaning), big: true });
      } else {
        const g = grammarById.get(ref.id);
        if (g) out.grammar.push({ ref, title: g.point, sub: nm(g.id, g.meaning) });
      }
    }
    return out;
  }, [state.myList, vocabById, kanjiById, grammarById, l1]);

  const counts = { vocab: rowsByKind.vocab.length, kanji: rowsByKind.kanji.length, grammar: rowsByKind.grammar.length };
  const total = counts.vocab + counts.kanji + counts.grammar;
  const reviewIds = useMemo(
    () => (state.myList ?? [])
      .filter((r) => (r.type === 'vocab' && vocabById.has(r.id)) || (r.type === 'kanji' && kanjiById.has(r.id)))
      .map((r) => r.id),
    [state.myList, vocabById, kanjiById],
  );

  // シーンのフェードイン
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(fade, { toValue: 1, duration: 450, useNativeDriver: true }).start(); }, []);

  const rowItem = (item: Row, kind: BookKind) => (
    <View style={s.row}>
      <View style={[s.accentBar, { backgroundColor: accentOf(kind) }]} />
      <View style={s.rowText}>
        <Text style={[s.rowTitle, item.big && s.rowTitleBig]} numberOfLines={1}>{item.title}</Text>
        <Text style={s.rowSub} numberOfLines={2}>{item.sub}</Text>
      </View>
      <Pressable style={s.delBtn} hitSlop={10} onPress={() => addToMyList(item.ref)}>
        <Ionicons name="close" size={18} color={c.faint} />
      </Pressable>
    </View>
  );

  // ── 各帳(1区分だけのリスト) ──
  if (view !== 'shelf') {
    const kind = view;
    const rows = rowsByKind[kind];
    return (
      <SafeAreaView style={s.listScreen} edges={['top']}>
        <View style={s.top}>
          <Pressable style={s.backBtn} hitSlop={10} onPress={() => setView('shelf')}>
            <Ionicons name="chevron-back" size={20} color={c.ink2} />
            <Text style={s.backTxt}>{t('mywords.back_to_shelf')}</Text>
          </Pressable>
          <View style={{ width: 24 }} />
        </View>
        <View style={s.kindHead}>
          <View style={[s.kindDot, { backgroundColor: accentOf(kind) }]} />
          <Text style={s.kindTitle}>{bookTitle(kind)}</Text>
          <Text style={s.kindCount}>{counts[kind]}</Text>
        </View>
        {rows.length === 0 ? (
          <View style={s.listEmpty}><Text style={s.emptyTxt}>{t('mywords.book_empty')}</Text></View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(r) => `${r.ref.type}:${r.ref.id}`}
            contentContainerStyle={s.list}
            renderItem={({ item }) => rowItem(item, kind)}
            ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          />
        )}
      </SafeAreaView>
    );
  }

  // ── 本棚ホーム(桜の書斎) ──
  const guideW = Math.min(280, winW * 0.72);
  return (
    <ImageBackground source={ROOM} style={s.roomBg} resizeMode="cover">
      <View style={s.roomTintTop} />
      <View style={s.roomTintBottom} />
      {/* 花びら */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {Array.from({ length: 9 }).map((_, i) => <Petal key={i} seed={i + 1} screenH={winH} />)}
      </View>

      <SafeAreaView style={StyleSheet.absoluteFill} edges={['top']}>
        <Animated.View style={{ flex: 1, opacity: fade }}>
          {/* ヘッダー */}
          <View style={s.top}>
            <Pressable onPress={() => nav.goBack()} hitSlop={12}><Text style={s.closeLight}>✕</Text></Pressable>
            <View style={s.titleTanzaku}><Text style={s.titleTxt}>{t('mywords.title')}</Text></View>
            {reviewIds.length > 0 ? (
              <Pressable style={s.reviewPill} hitSlop={8} onPress={() => nav.navigate('Flashcard', { ids: reviewIds })}>
                <Ionicons name="refresh" size={14} color="#fff" />
                <Text style={s.reviewPillTxt}>{t('mywords.review')}</Text>
              </Pressable>
            ) : <View style={{ width: 30 }} />}
          </View>

          {/* 本棚(上): 和綴じ3冊 */}
          <View style={s.shelf}>
            <View style={s.books}>
              {KINDS.map((k) => (
                <Pressable key={k} style={({ pressed }) => [s.book, pressed && s.bookPressed]} onPress={() => setView(k)}>
                  <View style={s.cover}>
                    <View style={s.bindLine} />
                    {[0, 1, 2, 3].map((i) => <View key={i} style={[s.stitch, { top: `${16 + i * 22}%` }]} />)}
                    <View style={[s.tanzaku, { borderTopColor: accentOf(k) }]}>
                      <Text style={s.tanzakuKj}>{kanjiOf(k)}</Text>
                    </View>
                    <View style={[s.mon, { backgroundColor: accentOf(k) }]} />
                    <Text style={[s.count, { backgroundColor: accentOf(k) }]}>{counts[k]}</Text>
                  </View>
                  <Text style={s.bookLbl}>{bookTitle(k)}</Text>
                </Pressable>
              ))}
            </View>
            <View style={s.plank} />
          </View>

          <View style={{ flex: 1 }} />

          {/* 吹き出し(頭上) */}
          <View style={s.bubbleWrap}>
            <View style={s.bubble}>
              <Text style={s.bubbleTxt}>{total === 0 ? t('mywords.mascot_empty') : t('mywords.mascot_hello')}</Text>
              <View style={s.bubbleTail} />
            </View>
          </View>

          {/* 案内キャラ(下・瞬き) */}
          <View style={s.guideWrap}>
            <BlinkingGuide width={guideW} />
          </View>
        </Animated.View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  roomBg: { flex: 1, backgroundColor: '#efe1cf' },
  roomTintTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 140, backgroundColor: 'rgba(60,40,45,0.22)' },
  roomTintBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 260, backgroundColor: 'rgba(70,40,50,0.20)' },

  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  closeLight: { fontSize: ty.h2, color: '#fff', width: 30, textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 3 },
  titleTanzaku: { backgroundColor: 'rgba(232,139,171,0.62)', borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  titleTxt: { fontFamily: 'ShipporiMincho-Bold', fontSize: 19, color: '#fff', letterSpacing: 2, fontWeight: '700' },
  reviewPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: c.blue, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, ...shadow(1) },
  reviewPillTxt: { color: '#fff', fontSize: ty.small, fontWeight: '800' },

  // 本棚
  shelf: { marginTop: spacing.md },
  books: { flexDirection: 'row', gap: 14, paddingHorizontal: 22, justifyContent: 'center', alignItems: 'flex-end' },
  book: { width: 92, alignItems: 'center' },
  bookPressed: { transform: [{ translateY: -6 }, { scale: 1.04 }] },
  cover: {
    width: '100%', aspectRatio: 0.72, borderRadius: 6, borderTopLeftRadius: 4, borderBottomLeftRadius: 4,
    backgroundColor: '#fbf3e4', borderWidth: 1, borderColor: 'rgba(120,90,60,0.28)',
    ...shadow(2),
  },
  bindLine: { position: 'absolute', left: 8, top: 6, bottom: 6, width: 0, borderLeftWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(184,137,90,0.7)' },
  stitch: { position: 'absolute', left: 5, width: 8, height: 5, borderRadius: 2, backgroundColor: '#8a6038', opacity: 0.85 },
  tanzaku: {
    position: 'absolute', top: '9%', left: '52%', marginLeft: -13, width: 26, height: '64%',
    backgroundColor: '#fffdf9', borderWidth: 1, borderColor: 'rgba(120,90,60,0.35)', borderTopWidth: 3, borderRadius: 2,
    alignItems: 'center', paddingTop: 4,
  },
  tanzakuKj: { fontFamily: 'ShipporiMincho-Bold', fontSize: 19, color: '#4a3a2f', fontWeight: '700' },
  mon: { position: 'absolute', bottom: 7, alignSelf: 'center', left: '50%', marginLeft: -6, width: 12, height: 12, borderTopLeftRadius: 8, borderBottomRightRadius: 8, opacity: 0.5 },
  count: {
    position: 'absolute', top: -8, right: -7, minWidth: 23, height: 23, borderRadius: 12, overflow: 'hidden',
    color: '#fff', fontSize: 12, fontWeight: '800', textAlign: 'center', lineHeight: 21,
    borderWidth: 2, borderColor: '#fff', ...shadow(1),
  },
  bookLbl: { marginTop: 8, fontSize: ty.small, fontWeight: '800', color: '#fff', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 3 },
  plank: { marginHorizontal: 16, marginTop: 2, height: 12, borderRadius: 4, backgroundColor: '#d8b487', borderBottomWidth: 4, borderBottomColor: '#a9814f', ...shadow(2) },

  // 吹き出し
  bubbleWrap: { alignItems: 'center', marginBottom: 4, zIndex: 5 },
  bubble: { maxWidth: 200, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 16, borderBottomLeftRadius: 5, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, ...shadow(2) },
  bubbleTxt: { fontSize: ty.body, fontWeight: '700', color: '#5b3b45', textAlign: 'center', lineHeight: 20 },
  bubbleTail: { position: 'absolute', bottom: -8, left: 26, width: 0, height: 0, borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 9, borderStyle: 'solid', borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: 'rgba(255,255,255,0.95)' },

  // キャラ
  guideWrap: { alignItems: 'center', marginBottom: -6 },

  // 各帳リスト(通常画面=可読性優先)
  listScreen: { flex: 1, backgroundColor: c.bg },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backTxt: { fontSize: ty.body, fontWeight: '700', color: c.ink2 },
  kindHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  kindDot: { width: 12, height: 12, borderRadius: 4 },
  kindTitle: { flex: 1, fontSize: ty.h2, fontWeight: '800', color: c.ink },
  kindCount: { fontSize: ty.body, fontWeight: '800', color: c.mute },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  listEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyTxt: { fontSize: ty.body, color: c.mute, textAlign: 'center' },
  row: { ...shadow(1), flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, overflow: 'hidden', paddingRight: spacing.md },
  accentBar: { width: 5, alignSelf: 'stretch' },
  rowText: { flex: 1, paddingVertical: spacing.md, paddingLeft: spacing.md },
  rowTitle: { fontSize: ty.body, fontWeight: '800', color: c.ink },
  rowTitleBig: { fontSize: 28, lineHeight: 34, fontFamily: 'ShipporiMincho-Bold' },
  rowSub: { fontSize: ty.small, color: c.mute, marginTop: 2 },
  delBtn: { padding: spacing.xs },
});
