// おさんぽ(散歩マップ)。実マップ画像(昼/夜)＋自分のアバターを十字キーで4方向移動＋当たり判定＋カメラ追従。
//  ・当たり判定=src/plaza/mapCollision.ts(地図の色解析で自動生成した MAP_G×MAP_G グリッド。'.'歩ける/'#'止まる)。
//  ・描画: マップ画像は1枚。移動は world/player の transform を毎フレーム setValue で動かす(Reactの再描画なし=軽い)。
//    向きが変わった時だけ player 画像を差し替え(state)。※十字キーは関数内で定義せず直接置く(再マウントで
//    onPressOut が飛ばず「止まらない」不具合を防ぐ)。
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Image, Animated, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { MAP_G, MAP_WALK } from '../plaza/mapCollision';

type Dir = 'down' | 'up' | 'left' | 'right';
const HERO: Record<Dir, number> = {
  down: require('../../assets/kotoba/hero/down.png'),
  up: require('../../assets/kotoba/hero/up.png'),
  left: require('../../assets/kotoba/hero/left.png'),
  right: require('../../assets/kotoba/hero/right.png'),
};
const MAP_DAY = require('../../assets/kotoba/map/day.jpg');
const MAP_NIGHT = require('../../assets/kotoba/map/night.jpg');

const WORLD = 1024;            // マップ表示サイズ(正方)。当たり判定グリッドはこの中を MAP_G 等分。
const CELL = WORLD / MAP_G;
const SPRITE = 52;
const SPEED = 150;            // px/秒
// スタート地点(自動生成の seed セル付近=中央広場)。
const START_COL = 24, START_ROW = 29;

export default function KotobaTownScreen() {
  const nav = useNavigation();
  const { width: VW, height: VH } = useWindowDimensions();
  const isDay = useMemo(() => { const h = new Date().getHours(); return h >= 6 && h < 18; }, []);
  const MAP_IMG = isDay ? MAP_DAY : MAP_NIGHT;

  const start = useRef({ x: (START_COL + 0.5) * CELL - SPRITE / 2, y: (START_ROW + 0.5) * CELL - SPRITE * 0.82 }).current;
  const pos = useRef({ x: start.x, y: start.y });
  const input = useRef({ dx: 0, dy: 0 });
  const activeDir = useRef<Dir | null>(null);
  const [dir, setDir] = useState<Dir>('down');
  const dirRef = useRef<Dir>('down');
  const [moving, setMoving] = useState(false);

  const worldOff = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const playerPos = useRef(new Animated.ValueXY({ x: start.x, y: start.y })).current;
  const bob = useRef(new Animated.Value(0)).current;

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  const walkable = (px: number, py: number): boolean => {
    // 足元(中心やや下)で判定
    const fx = px + SPRITE / 2;
    const fy = py + SPRITE * 0.82;
    const c = Math.floor(fx / CELL), r = Math.floor(fy / CELL);
    if (r < 0 || r >= MAP_G || c < 0 || c >= MAP_G) return false;
    return MAP_WALK[r][c] === '.';
  };

  const applyCamera = () => {
    const camX = clamp(pos.current.x + SPRITE / 2 - VW / 2, 0, Math.max(0, WORLD - VW));
    const camY = clamp(pos.current.y + SPRITE / 2 - VH / 2, 0, Math.max(0, WORLD - VH));
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

  return (
    <View style={s.c}>
      {/* マップ(カメラで動く世界。プレイヤーも world 内に置く) */}
      <View style={s.viewport}>
        <Animated.View style={{ position: 'absolute', width: WORLD, height: WORLD, transform: [{ translateX: worldOff.x }, { translateY: worldOff.y }] }}>
          <Image source={MAP_IMG} style={{ position: 'absolute', width: WORLD, height: WORLD }} resizeMode="cover" />
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

      {/* 操作(十字キー) */}
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
  c: { flex: 1, backgroundColor: '#1e2330', overflow: 'hidden' },
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
