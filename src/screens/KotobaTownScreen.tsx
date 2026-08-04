// おさんぽ(散歩マップ)。実マップ画像(昼/夜)＋自分のアバターをバーチャルスティックで自由移動(斜めOK)＋当たり判定＋カメラ追従。
//  ・操作=アナログスティック(360度)。移動ベクトルは常に単位長に正規化=斜めでも速度は一定。向きは近い4方向の絵。
//  ・当たり判定=src/plaza/mapCollision.ts(色解析で自動生成した MAP_G×MAP_G。'.'歩ける/'#'止まる)。X/Yを別々に判定=壁ずり移動。
//  ・描画: マップ画像1枚＋プレイヤー。移動は transform を毎フレーム setValue(再描画なし=軽い)。向き変化時だけ画像差し替え。
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Image, Animated, Pressable, PanResponder, StyleSheet, useWindowDimensions } from 'react-native';
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
const SPEED = 160;            // px/秒
const START_COL = 24, START_ROW = 29;
const STICK_R = 54;          // スティック外周半径
const DEADZONE = 10;

export default function KotobaTownScreen() {
  const nav = useNavigation();
  const { width: VW, height: VH } = useWindowDimensions();
  const isDay = useMemo(() => { const h = new Date().getHours(); return h >= 6 && h < 18; }, []);
  const MAP_IMG = isDay ? MAP_DAY : MAP_NIGHT;

  const start = useRef({ x: (START_COL + 0.5) * CELL - SPRITE / 2, y: (START_ROW + 0.5) * CELL - SPRITE * 0.82 }).current;
  const pos = useRef({ x: start.x, y: start.y });
  const input = useRef({ dx: 0, dy: 0 }); // 単位ベクトル(斜め対応)
  const [dir, setDir] = useState<Dir>('down');
  const dirRef = useRef<Dir>('down');
  const [moving, setMoving] = useState(false);

  const worldOff = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const playerPos = useRef(new Animated.ValueXY({ x: start.x, y: start.y })).current;
  const bob = useRef(new Animated.Value(0)).current;
  const knob = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  const walkable = (px: number, py: number): boolean => {
    const fx = px + SPRITE / 2;
    const fy = py + SPRITE * 0.82; // 足元
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

  // 移動ループ。input は単位ベクトル→斜めでも一定速度。X/Yを別々に当たり判定=壁ずり。
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

  // 移動中のぴょこ。
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

  // アナログスティック。指の変位→単位ベクトル(斜めOK)。向きは近い4方向。
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (_e, g) => {
      const dx = g.dx, dy = g.dy;
      const mag = Math.hypot(dx, dy);
      const cl = Math.min(mag, STICK_R);
      knob.setValue({ x: mag > 0 ? (dx / mag) * cl : 0, y: mag > 0 ? (dy / mag) * cl : 0 });
      if (mag < DEADZONE) { input.current = { dx: 0, dy: 0 }; return; }
      const ux = dx / mag, uy = dy / mag;
      input.current = { dx: ux, dy: uy };
      const d: Dir = Math.abs(ux) > Math.abs(uy) ? (ux < 0 ? 'left' : 'right') : (uy < 0 ? 'up' : 'down');
      if (dirRef.current !== d) { dirRef.current = d; setDir(d); }
    },
    onPanResponderRelease: () => { input.current = { dx: 0, dy: 0 }; Animated.spring(knob, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start(); },
    onPanResponderTerminate: () => { input.current = { dx: 0, dy: 0 }; Animated.spring(knob, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start(); },
  }), [knob]);

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

      {/* 操作(アナログスティック・斜めOK) */}
      <SafeAreaView edges={['bottom']} style={s.bottom} pointerEvents="box-none">
        <View style={s.stickWrap}>
          <View style={s.stickBase} {...pan.panHandlers}>
            <Animated.View style={[s.stickKnob, { transform: [{ translateX: knob.x }, { translateY: knob.y }] }]} />
          </View>
        </View>
      </SafeAreaView>
    </View>
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
  stickWrap: { alignSelf: 'flex-start', paddingBottom: 26, paddingLeft: 22 },
  stickBase: { width: STICK_R * 2, height: STICK_R * 2, borderRadius: STICK_R, backgroundColor: 'rgba(58,49,40,0.28)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' },
  stickKnob: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,253,248,0.9)', borderWidth: 2, borderColor: 'rgba(58,49,40,0.4)' },
});
