// 言葉の都(テスト実装)。タイルマップ＋自分のアバターを十字キーで4方向移動＋当たり判定＋カメラ追従。
// 目的: エンジンの手触り検証(あつ森風・方式A)。絵はテストのちびキャラ1体/タイルは仮の色。量産前の実証用。
//  ・描画: タイル(480枚前後)は一度だけ描画(静的)。移動は world/player の transform を毎フレーム setValue で動かす
//    (Reactの再描画を起こさない=軽い)。向きが変わった時だけ player 画像を差し替え(state)。
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Image, Animated, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

type Dir = 'down' | 'up' | 'left' | 'right';
const HERO: Record<Dir, number> = {
  down: require('../../assets/kotoba/hero/down.png'),
  up: require('../../assets/kotoba/hero/up.png'),
  left: require('../../assets/kotoba/hero/left.png'),
  right: require('../../assets/kotoba/hero/right.png'),
};

const TILE = 44;
const SPRITE = 52;
const SPEED = 150; // px/秒

// 仮マップ(20列×26行)。'.'草 '='石畳(歩ける) / '#'木 'S'桜 'B'ベンチ 'O'噴水 '~'池(通れない)。
function buildMap(): string[] {
  const COLS = 20, ROWS = 26;
  const g = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => '.'));
  const set = (r: number, c: number, ch: string) => { if (r >= 0 && r < ROWS && c >= 0 && c < COLS) g[r][c] = ch; };
  // 外周=木で囲う
  for (let c = 0; c < COLS; c++) { set(0, c, '#'); set(ROWS - 1, c, '#'); }
  for (let r = 0; r < ROWS; r++) { set(r, 0, '#'); set(r, COLS - 1, '#'); }
  // 中央の十字の石畳(歩ける・見た目)
  for (let r = 2; r < ROWS - 2; r++) set(r, 10, '=');
  for (let c = 2; c < COLS - 2; c++) set(13, c, '=');
  // 噴水(中央・通れない)
  set(13, 10, 'O');
  // 池
  for (let r = 4; r <= 6; r++) for (let c = 3; c <= 6; c++) set(r, c, '~');
  // 桜(点在・通れない)
  [[3, 14], [3, 16], [8, 3], [9, 15], [17, 5], [18, 15], [21, 8], [21, 13], [6, 12]].forEach(([r, c]) => set(r, c, 'S'));
  // ベンチ
  [[12, 6], [12, 14], [15, 8], [15, 12], [20, 10]].forEach(([r, c]) => set(r, c, 'B'));
  return g.map((row) => row.join(''));
}

const WALKABLE = new Set(['.', '=']);
const TILE_COLOR: Record<string, string> = { '.': '#bcd39a', '=': '#e6d7b3', '~': '#9ec9e0' };
const DECO: Record<string, string> = { '#': '🌳', S: '🌸', B: '🪑', O: '⛲' };

export default function KotobaTownScreen() {
  const nav = useNavigation();
  const { width: VW, height: VH } = useWindowDimensions();
  const map = useMemo(buildMap, []);
  const ROWS = map.length, COLS = map[0].length;
  const worldW = COLS * TILE, worldH = ROWS * TILE;

  // 初期位置(石畳の縦道・中央やや下)。
  const start = useRef({ x: 10 * TILE, y: 16 * TILE }).current;
  const pos = useRef({ x: start.x, y: start.y });
  const input = useRef({ dx: 0, dy: 0 });
  const activeDir = useRef<Dir | null>(null);
  const [dir, setDir] = useState<Dir>('down');
  const dirRef = useRef<Dir>('down');
  const [moving, setMoving] = useState(false);

  const worldOff = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const playerPos = useRef(new Animated.ValueXY({ x: start.x, y: start.y })).current;
  // ぴょこ(移動中のみ)
  const bob = useRef(new Animated.Value(0)).current;

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  const walkable = (px: number, py: number): boolean => {
    // 足元(中心やや下)で判定
    const fx = px + SPRITE / 2;
    const fy = py + SPRITE * 0.82;
    const c = Math.floor(fx / TILE), r = Math.floor(fy / TILE);
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return false;
    return WALKABLE.has(map[r][c]);
  };

  const applyCamera = () => {
    const camX = clamp(pos.current.x + SPRITE / 2 - VW / 2, 0, Math.max(0, worldW - VW));
    const camY = clamp(pos.current.y + SPRITE / 2 - VH / 2, 0, Math.max(0, worldH - VH));
    worldOff.setValue({ x: -camX, y: -camY });
  };

  useEffect(() => { applyCamera(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 移動ループ(requestAnimationFrame)。位置は ref、描画は Animated.setValue で再描画なし。
  useEffect(() => {
    let raf = 0; let last = 0; let wasMoving = false;
    const frame = (ts: number) => {
      if (!last) last = ts;
      const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
      const { dx, dy } = input.current;
      const isMoving = !!(dx || dy);
      if (isMoving) {
        const nx = pos.current.x + dx * SPEED * dt;
        const ny = pos.current.y + dy * SPEED * dt;
        if (walkable(nx, pos.current.y)) pos.current.x = nx;
        if (walkable(pos.current.x, ny)) pos.current.y = ny;
        playerPos.setValue({ x: pos.current.x, y: pos.current.y });
        applyCamera();
      }
      if (isMoving !== wasMoving) { wasMoving = isMoving; setMoving(isMoving); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 移動中のぴょこ(上下に軽く跳ねる)。
  useEffect(() => {
    if (moving) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]));
      loop.start();
      return () => { loop.stop(); bob.setValue(0); };
    }
  }, [moving, bob]);
  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });

  const press = (d: Dir, dx: number, dy: number) => () => {
    input.current = { dx, dy }; activeDir.current = d;
    if (dirRef.current !== d) { dirRef.current = d; setDir(d); }
  };
  const release = (d: Dir) => () => { if (activeDir.current === d) { input.current = { dx: 0, dy: 0 }; activeDir.current = null; } };

  // タイル群(静的・一度だけ)。
  const tiles = useMemo(() => {
    const out: React.ReactNode[] = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const ch = map[r][c];
      const base = TILE_COLOR[ch] ?? TILE_COLOR['.'];
      out.push(
        <View key={`${r}-${c}`} style={{ position: 'absolute', left: c * TILE, top: r * TILE, width: TILE, height: TILE, backgroundColor: DECO[ch] ? TILE_COLOR['.'] : base, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.05)' }}>
          {DECO[ch] ? <Text style={{ fontSize: TILE * 0.72, textAlign: 'center', lineHeight: TILE }}>{DECO[ch]}</Text> : null}
        </View>,
      );
    }
    return out;
  }, [map, ROWS, COLS]);

  return (
    <View style={s.c}>
      {/* マップ(カメラで動く世界。プレイヤーも world 内に置く) */}
      <View style={s.viewport}>
        <Animated.View style={{ position: 'absolute', width: worldW, height: worldH, transform: [{ translateX: worldOff.x }, { translateY: worldOff.y }] }}>
          {tiles}
          <Animated.View style={{ position: 'absolute', width: SPRITE, height: SPRITE, transform: [{ translateX: playerPos.x }, { translateY: playerPos.y }] }}>
            <Animated.Image source={HERO[dir]} style={{ width: SPRITE, height: SPRITE, transform: [{ translateY: bobY }] }} resizeMode="contain" />
          </Animated.View>
        </Animated.View>
      </View>

      {/* 上部バー */}
      <SafeAreaView edges={['top']} style={s.top} pointerEvents="box-none">
        <View style={s.topBar} pointerEvents="box-none">
          <View style={s.pill}><Text style={s.pillT}>おさんぽ</Text></View>
          <Pressable onPress={() => nav.goBack()} hitSlop={12} style={s.close}><Ionicons name="close" size={22} color="#3a3128" /></Pressable>
        </View>
      </SafeAreaView>

      {/* 操作(十字キー)。※部品を関数内で定義せず直接置く=再マウントで onPressOut が飛ばず「止まらない」不具合を防ぐ。 */}
      <SafeAreaView edges={['bottom']} style={s.bottom} pointerEvents="box-none">
        <View style={s.dpad}>
          <View style={s.dpadRow}>
            <Btn icon="chevron-up" onIn={press('up', 0, -1)} onOut={release('up')} />
          </View>
          <View style={s.dpadRow}>
            <Btn icon="chevron-back" onIn={press('left', -1, 0)} onOut={release('left')} />
            <View style={s.dpadGap} />
            <Btn icon="chevron-forward" onIn={press('right', 1, 0)} onOut={release('right')} />
          </View>
          <View style={s.dpadRow}>
            <Btn icon="chevron-down" onIn={press('down', 0, 1)} onOut={release('down')} />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function Btn({ icon, onIn, onOut }: { icon: keyof typeof Ionicons.glyphMap; onIn: () => void; onOut: () => void }) {
  return (
    <Pressable onPressIn={onIn} onPressOut={onOut} hitSlop={8} style={({ pressed }) => [s.btn, pressed && s.btnOn]}>
      <Ionicons name={icon} size={32} color="#fff" />
    </Pressable>
  );
}

const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: '#a9c98a', overflow: 'hidden' },
  viewport: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  top: { position: 'absolute', top: 0, left: 0, right: 0 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 },
  pill: { backgroundColor: 'rgba(255,253,248,0.9)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  pillT: { fontSize: 13, fontWeight: '900', color: '#3a3128' },
  close: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,253,248,0.9)', alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  dpad: { alignItems: 'center', paddingBottom: 20, paddingLeft: 12, alignSelf: 'flex-start' },
  dpadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  dpadGap: { width: 60 },
  btn: { width: 64, height: 64, margin: 3, borderRadius: 18, backgroundColor: 'rgba(58,49,40,0.66)', alignItems: 'center', justifyContent: 'center' },
  btnOn: { backgroundColor: 'rgba(58,49,40,0.9)' },
});
