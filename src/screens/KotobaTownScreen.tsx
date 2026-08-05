// おさんぽ(散歩マップ)。実マップ画像(昼/夜)＋自分のアバターをバーチャルスティックで8方向移動＋当たり判定＋カメラ追従。
//  ・操作=アナログスティック。入力角を45度刻みで丸め、移動は縦横斜めの8方向だけ。向きも8方向の絵に対応。
//  ・当たり判定=src/plaza/mapCollision.ts(色解析で自動生成した MAP_G×MAP_G。'.'歩ける/'#'止まる)。X/Yを別々に判定=壁ずり移動。
//  ・描画: マップ画像1枚＋プレイヤー。移動は transform を毎フレーム setValue(再描画なし=軽い)。向き変化時だけ画像差し替え。
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Image, Animated, Pressable, PanResponder, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, CommonActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { MAP_G, MAP_WALK } from '../plaza/mapCollision';
import { useAppState } from '../store/store';
import type { RootStackParamList } from '../navigation/types';
import { VIRTUAL_LEARNERS, type VirtualLearner, type NpcColor } from '../plaza/virtualLearners';

type Dir = 'down' | 'up' | 'left' | 'right' | 'downleft' | 'downright' | 'upleft' | 'upright';
// 各方向 [両足立ち, 右足前, 左足前]。歩行時に 立ち→右→立ち→左 で切り替え=歩いて見える。
const HERO: Record<Dir, number[]> = {
  down: [require('../../assets/kotoba/hero/down.png'), require('../../assets/kotoba/hero/down_r.png'), require('../../assets/kotoba/hero/down_l.png')],
  up: [require('../../assets/kotoba/hero/up.png'), require('../../assets/kotoba/hero/up_r.png'), require('../../assets/kotoba/hero/up_l.png')],
  left: [require('../../assets/kotoba/hero/left.png'), require('../../assets/kotoba/hero/left_r.png'), require('../../assets/kotoba/hero/left_l.png')],
  right: [require('../../assets/kotoba/hero/right.png'), require('../../assets/kotoba/hero/right_r.png'), require('../../assets/kotoba/hero/right_l.png')],
  downleft: [require('../../assets/kotoba/hero/downleft.png'), require('../../assets/kotoba/hero/downleft_r.png'), require('../../assets/kotoba/hero/downleft_l.png')],
  downright: [require('../../assets/kotoba/hero/downright.png'), require('../../assets/kotoba/hero/downright_r.png'), require('../../assets/kotoba/hero/downright_l.png')],
  upleft: [require('../../assets/kotoba/hero/upleft.png'), require('../../assets/kotoba/hero/upleft_r.png'), require('../../assets/kotoba/hero/upleft_l.png')],
  upright: [require('../../assets/kotoba/hero/upright.png'), require('../../assets/kotoba/hero/upright_r.png'), require('../../assets/kotoba/hero/upright_l.png')],
};
// 女の子アバター(女の子1)。男の子と同じ 各方向[立ち,右足,左足]。
const HERO_F: Record<Dir, number[]> = {
  down: [require('../../assets/kotoba/hero_f/down.png'), require('../../assets/kotoba/hero_f/down_r.png'), require('../../assets/kotoba/hero_f/down_l.png')],
  up: [require('../../assets/kotoba/hero_f/up.png'), require('../../assets/kotoba/hero_f/up_r.png'), require('../../assets/kotoba/hero_f/up_l.png')],
  left: [require('../../assets/kotoba/hero_f/left.png'), require('../../assets/kotoba/hero_f/left_r.png'), require('../../assets/kotoba/hero_f/left_l.png')],
  right: [require('../../assets/kotoba/hero_f/right.png'), require('../../assets/kotoba/hero_f/right_r.png'), require('../../assets/kotoba/hero_f/right_l.png')],
  downleft: [require('../../assets/kotoba/hero_f/downleft.png'), require('../../assets/kotoba/hero_f/downleft_r.png'), require('../../assets/kotoba/hero_f/downleft_l.png')],
  downright: [require('../../assets/kotoba/hero_f/downright.png'), require('../../assets/kotoba/hero_f/downright_r.png'), require('../../assets/kotoba/hero_f/downright_l.png')],
  upleft: [require('../../assets/kotoba/hero_f/upleft.png'), require('../../assets/kotoba/hero_f/upleft_r.png'), require('../../assets/kotoba/hero_f/upleft_l.png')],
  upright: [require('../../assets/kotoba/hero_f/upright.png'), require('../../assets/kotoba/hero_f/upright_r.png'), require('../../assets/kotoba/hero_f/upright_l.png')],
};
// 女の子2アバター。
const HERO_F2: Record<Dir, number[]> = {
  down: [require('../../assets/kotoba/hero_f2/down.png'), require('../../assets/kotoba/hero_f2/down_r.png'), require('../../assets/kotoba/hero_f2/down_l.png')],
  up: [require('../../assets/kotoba/hero_f2/up.png'), require('../../assets/kotoba/hero_f2/up_r.png'), require('../../assets/kotoba/hero_f2/up_l.png')],
  left: [require('../../assets/kotoba/hero_f2/left.png'), require('../../assets/kotoba/hero_f2/left_r.png'), require('../../assets/kotoba/hero_f2/left_l.png')],
  right: [require('../../assets/kotoba/hero_f2/right.png'), require('../../assets/kotoba/hero_f2/right_r.png'), require('../../assets/kotoba/hero_f2/right_l.png')],
  downleft: [require('../../assets/kotoba/hero_f2/downleft.png'), require('../../assets/kotoba/hero_f2/downleft_r.png'), require('../../assets/kotoba/hero_f2/downleft_l.png')],
  downright: [require('../../assets/kotoba/hero_f2/downright.png'), require('../../assets/kotoba/hero_f2/downright_r.png'), require('../../assets/kotoba/hero_f2/downright_l.png')],
  upleft: [require('../../assets/kotoba/hero_f2/upleft.png'), require('../../assets/kotoba/hero_f2/upleft_r.png'), require('../../assets/kotoba/hero_f2/upleft_l.png')],
  upright: [require('../../assets/kotoba/hero_f2/upright.png'), require('../../assets/kotoba/hero_f2/upright_r.png'), require('../../assets/kotoba/hero_f2/upright_l.png')],
};
// 男の子2アバター。8方向×各[立ち,右足,左足]。
const HERO_M2: Record<Dir, number[]> = {
  down: [require('../../assets/kotoba/hero_m2/down.png'), require('../../assets/kotoba/hero_m2/down_r.png'), require('../../assets/kotoba/hero_m2/down_l.png')],
  up: [require('../../assets/kotoba/hero_m2/up.png'), require('../../assets/kotoba/hero_m2/up_r.png'), require('../../assets/kotoba/hero_m2/up_l.png')],
  left: [require('../../assets/kotoba/hero_m2/left.png'), require('../../assets/kotoba/hero_m2/left_r.png'), require('../../assets/kotoba/hero_m2/left_l.png')],
  right: [require('../../assets/kotoba/hero_m2/right.png'), require('../../assets/kotoba/hero_m2/right_r.png'), require('../../assets/kotoba/hero_m2/right_l.png')],
  downleft: [require('../../assets/kotoba/hero_m2/downleft.png'), require('../../assets/kotoba/hero_m2/downleft_r.png'), require('../../assets/kotoba/hero_m2/downleft_l.png')],
  downright: [require('../../assets/kotoba/hero_m2/downright.png'), require('../../assets/kotoba/hero_m2/downright_r.png'), require('../../assets/kotoba/hero_m2/downright_l.png')],
  upleft: [require('../../assets/kotoba/hero_m2/upleft.png'), require('../../assets/kotoba/hero_m2/upleft_r.png'), require('../../assets/kotoba/hero_m2/upleft_l.png')],
  upright: [require('../../assets/kotoba/hero_m2/upright.png'), require('../../assets/kotoba/hero_m2/upright_r.png'), require('../../assets/kotoba/hero_m2/upright_l.png')],
};
// アバターコード→歩行スプライト。男子(色違い含む)は既定の男の子で歩く。
const AVATAR_SETS: Record<string, Record<Dir, number[]>> = { m_boy1: HERO, m_boy2: HERO_M2, f_g1: HERO_F, f_g2: HERO_F2 };

// 桜(マスコット)。8方向・静止画のみ(右足/左足の歩行フレーム切替なし)。近づいて話すと努力を褒めてくれる。
const SAKURA: Record<Dir, number> = {
  down: require('../../assets/kotoba/sakura/down.png'),
  up: require('../../assets/kotoba/sakura/up.png'),
  left: require('../../assets/kotoba/sakura/left.png'),
  right: require('../../assets/kotoba/sakura/right.png'),
  downleft: require('../../assets/kotoba/sakura/downleft.png'),
  downright: require('../../assets/kotoba/sakura/downright.png'),
  upleft: require('../../assets/kotoba/sakura/upleft.png'),
  upright: require('../../assets/kotoba/sakura/upright.png'),
};
const SAKURA_HOME = { col: 27, row: 27 }; // 広場の歩けるマス(スポーン近く)

// 柴犬(マスコット犬)。8方向・静止画のみ。会話なし=町を歩き回るだけ。桜のそばに配置。
const SHIBA: Record<Dir, number> = {
  down: require('../../assets/kotoba/shiba/down.png'),
  up: require('../../assets/kotoba/shiba/up.png'),
  left: require('../../assets/kotoba/shiba/left.png'),
  right: require('../../assets/kotoba/shiba/right.png'),
  downleft: require('../../assets/kotoba/shiba/downleft.png'),
  downright: require('../../assets/kotoba/shiba/downright.png'),
  upleft: require('../../assets/kotoba/shiba/upleft.png'),
  upright: require('../../assets/kotoba/shiba/upright.png'),
};
const SHIBA_HOME = { col: 29, row: 28 };

// ベンチに座る/勉強するアバター(装飾・動かない)。読む=勉強/座る の男女ミックス。x,y=ワールド左上, w,h=表示サイズ。
const SIT = {
  g1_read_r: require('../../assets/kotoba/sit/g1_read_r.png'),
  g2_read_r: require('../../assets/kotoba/sit/g2_read_r.png'),
  m1_sit_l: require('../../assets/kotoba/sit/m1_sit_l.png'),
  m2_sit_l: require('../../assets/kotoba/sit/m2_sit_l.png'),
};
const SITTERS: { img: number; x: number; y: number; w: number; h: number }[] = [
  { img: SIT.g1_read_r, x: 330, y: 420, w: 40, h: 60 }, // 左上ベンチ・女の子1(勉強・右向き)
  { img: SIT.m1_sit_l, x: 638, y: 410, w: 27, h: 60 },  // 右上ベンチ・男の子1(座る・左向き)
  { img: SIT.g2_read_r, x: 323, y: 470, w: 43, h: 60 }, // 左下ベンチ・女の子2(勉強・右向き)
  { img: SIT.m2_sit_l, x: 538, y: 496, w: 28, h: 60 },  // 下ベンチ・男の子2(座る・左向き)
];
// 桜のほめ言葉(努力を褒める)。連続日数があれば1つに織り込む。
const sakuraPraise = (streak: number): string[] => [
  '毎日よくがんばってるね。えらい！🌸',
  'コツコツ続けるあなたは素敵。ずっと応援してるよ。',
  streak > 0 ? `${streak}日も続けてるなんて、本当にすごい！` : '今日から一緒にがんばろうね🌸',
  '少しずつでも前に進んでるよ。自信を持って。',
  '努力はちゃんと実になるからね。今日もおつかれさま🌸',
];
const WALK_CYCLE = [0, 1, 0, 2]; // 立ち→右足→立ち→左足
const WALK_STEP = 0.15;          // 1コマの秒数
// 8方向スナップ表(入力角 atan2 の 45度セクタ→向きと単位ベクトル)。画面yは下向き正。
const INV = Math.SQRT1_2;
const DIR8: { d: Dir; ux: number; uy: number }[] = [
  { d: 'right', ux: 1, uy: 0 },
  { d: 'downright', ux: INV, uy: INV },
  { d: 'down', ux: 0, uy: 1 },
  { d: 'downleft', ux: -INV, uy: INV },
  { d: 'left', ux: -1, uy: 0 },
  { d: 'upleft', ux: -INV, uy: -INV },
  { d: 'up', ux: 0, uy: -1 },
  { d: 'upright', ux: INV, uy: -INV },
];
const MAP_DAY = require('../../assets/kotoba/map/day.jpg');
const MAP_NIGHT = require('../../assets/kotoba/map/night.jpg');
const MAP_TREE_DAY = require('../../assets/kotoba/map/tree.png'); // 昼: 中央の木だけの透過レイヤー(最前面=人が裏に隠れる)
const MAP_TREE_NIGHT = require('../../assets/kotoba/map/tree_night.png'); // 夜: 同じ形で夜マップの木の色に合わせた透過レイヤー
// 家の前面レイヤー(木と同じ最前面=屋根+壁の下を歩く=入口に入ると家の前に隠れる「建物に入る」演出)。書斎/書庫×昼夜。
// 家の躯体は当たり判定で塞がっているため、屋根だけだと下に入れない→屋根+壁の家シルエットを最前面にして入口で隠す。
const ROOFS = [
  { day: require('../../assets/kotoba/map/house_shosai_day.png'), night: require('../../assets/kotoba/map/house_shosai_night.png'), x: 742, y: 446, w: 256, h: 254 }, // 書斎(右)
  { day: require('../../assets/kotoba/map/house_shoko_day.png'), night: require('../../assets/kotoba/map/house_shoko_night.png'), x: 360, y: 682, w: 272, h: 164 }, // 書庫(下)
];

const WORLD = 1024;            // マップ表示サイズ(正方)。当たり判定グリッドはこの中を MAP_G 等分。
const CELL = WORLD / MAP_G;
const SPRITE = 64;            // マップ上のアバター背丈(≒基準の女の子。赤枠 約70x67 より少し小さめ)
const SPEED = 160;            // px/秒
const START_COL = 24, START_ROW = 28;
const STICK_R = 54;          // スティック外周半径
const DEADZONE = 10;

// ワープ枠(WORLD=1024座標)。足元がこの小さな石段矩形に乗って初めて発火(反応距離ほぼ0)。全建物共通で石段のみ。
type WarpTarget = 'Shop' | 'MockIntro' | 'Words' | 'Dict';
// ワープ枠=各入口の「奥」に小さく置く。受付前/石段の最上段に触れて初めて発火(手前では反応しない)。
const WARP_ZONES: { x: number; y: number; w: number; h: number; t: WarpTarget }[] = [
  { x: 235, y: 299, w: 85, h: 43, t: 'Shop' },       // 左・受付(女の子)のカウンター前まで来たら=ショップ
  { x: 725, y: 277, w: 85, h: 43, t: 'MockIntro' },  // 右上・模試会場の石段を上りきった扉口=模試(説明画面から)
  { x: 811, y: 640, w: 64, h: 43, t: 'Words' },      // 右・書斎の玄関ポケット(家前レイヤの下=入ると隠れる)=単語タブ
  { x: 469, y: 789, w: 85, h: 43, t: 'Dict' },       // 下・書庫の玄関ポケット(家前レイヤの下=入ると隠れる)=辞書タブ
];

// 中央の木レイヤー(ユーザー提供のきれいな切り抜き tree.png)を最前面に重ねる。幹の付け根をマップの木に合わせて配置。
const TREE = { x: 259, y: 165, w: 437, h: 285 };

// 応援コメント(固定6種・自由入力なし=荒らし不可)。仮想学習者にも送れる(ローカル反応のみ)。
const CHEERS: { key: string; emoji: string; label: string; reply: string }[] = [
  { key: 'flower', emoji: '🌷', label: 'お花をおくる', reply: 'わあ、ありがとう！' },
  { key: 'ganbare', emoji: '💪', label: 'がんばって', reply: 'うん、がんばる！' },
  { key: 'sugoi', emoji: '🎉', label: 'すごい！', reply: 'えへへ、うれしい！' },
  { key: 'issho', emoji: '🤝', label: '一緒にがんばろう', reply: 'こちらこそ、一緒に！' },
  { key: 'otsukare', emoji: '☕', label: 'おつかれさま', reply: 'ありがとう、ひと休みするね' },
  { key: 'nice', emoji: '🌸', label: 'いいね', reply: 'ありがとう！' },
];

// 当たり判定(足元がマップの'.'か)。プレイヤー・NPC共通。座標=スプライト左上。
function walkable(px: number, py: number): boolean {
  const fx = px + SPRITE / 2, fy = py + SPRITE * 0.82;
  const c = Math.floor(fx / CELL), r = Math.floor(fy / CELL);
  if (r < 0 || r >= MAP_G || c < 0 || c >= MAP_G) return false;
  return MAP_WALK[r][c] === '.';
}

// NPC(仮想学習者)スプライト表: 着物色×4方向。動的requireは不可なので静的表を持つ。
type Card4 = 'down' | 'up' | 'left' | 'right';
const NPC_SPRITES: Record<NpcColor, Record<Card4, number>> = {
  blue: { down: require('../../assets/kotoba/npc/blue_down.png'), up: require('../../assets/kotoba/npc/blue_up.png'), left: require('../../assets/kotoba/npc/blue_left.png'), right: require('../../assets/kotoba/npc/blue_right.png') },
  green: { down: require('../../assets/kotoba/npc/green_down.png'), up: require('../../assets/kotoba/npc/green_up.png'), left: require('../../assets/kotoba/npc/green_left.png'), right: require('../../assets/kotoba/npc/green_right.png') },
  crimson: { down: require('../../assets/kotoba/npc/crimson_down.png'), up: require('../../assets/kotoba/npc/crimson_up.png'), left: require('../../assets/kotoba/npc/crimson_left.png'), right: require('../../assets/kotoba/npc/crimson_right.png') },
  purple: { down: require('../../assets/kotoba/npc/purple_down.png'), up: require('../../assets/kotoba/npc/purple_up.png'), left: require('../../assets/kotoba/npc/purple_left.png'), right: require('../../assets/kotoba/npc/purple_right.png') },
  teal: { down: require('../../assets/kotoba/npc/teal_down.png'), up: require('../../assets/kotoba/npc/teal_up.png'), left: require('../../assets/kotoba/npc/teal_left.png'), right: require('../../assets/kotoba/npc/teal_right.png') },
  amber: { down: require('../../assets/kotoba/npc/amber_down.png'), up: require('../../assets/kotoba/npc/amber_up.png'), left: require('../../assets/kotoba/npc/amber_left.png'), right: require('../../assets/kotoba/npc/amber_right.png') },
};

// 1体のNPC: home周辺(半径約2.4マス)をゆっくり4方向で徘徊。頭上に国旗+名前+レベルの名札。表示専用。
// sink: 親が近接判定に使う現在位置の共有先(pos.current の参照を渡し、毎フレーム親から読める)。
function NpcSprite({ v, sink }: { v: VirtualLearner; sink: Record<string, { x: number; y: number }> }) {
  const home = useRef({ x: (v.home.col + 0.5) * CELL - SPRITE / 2, y: (v.home.row + 0.5) * CELL - SPRITE * 0.82 }).current;
  const pos = useRef({ x: home.x, y: home.y });
  const target = useRef({ x: home.x, y: home.y });
  const anim = useRef(new Animated.ValueXY({ x: home.x, y: home.y })).current;
  const [dir, setNpcDir] = useState<Card4>('down');
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 900, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [bob]);

  useEffect(() => {
    sink[v.id] = pos.current; // 親が近接判定に読む(参照共有=毎フレーム最新)
    let raf = 0, last = 0, wait = 400 + Math.random() * 2600;
    const NSPEED = 40, R = 2.4 * CELL; // ゆっくり・home周辺だけ
    const frame = (ts: number) => {
      if (!last) last = ts;
      const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
      const dx = target.current.x - pos.current.x, dy = target.current.y - pos.current.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 2) {
        wait -= dt * 1000;
        if (wait <= 0) {
          let nx = home.x, ny = home.y;
          for (let i = 0; i < 8; i++) {
            const ang = Math.random() * Math.PI * 2, rr = Math.random() * R;
            const tx = home.x + Math.cos(ang) * rr, ty = home.y + Math.sin(ang) * rr;
            if (walkable(tx, ty)) { nx = tx; ny = ty; break; }
          }
          target.current = { x: nx, y: ny };
          wait = 900 + Math.random() * 3000;
        }
      } else {
        const ux = dx / dist, uy = dy / dist, step = NSPEED * dt;
        if (walkable(pos.current.x + ux * step, pos.current.y)) pos.current.x += ux * step;
        if (walkable(pos.current.x, pos.current.y + uy * step)) pos.current.y += uy * step;
        anim.setValue({ x: pos.current.x, y: pos.current.y });
        const nd: Card4 = Math.abs(ux) > Math.abs(uy) ? (ux < 0 ? 'left' : 'right') : (uy < 0 ? 'up' : 'down');
        setNpcDir((p) => (p === nd ? p : nd));
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); delete sink[v.id]; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const by = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });
  return (
    <Animated.View style={{ position: 'absolute', width: SPRITE, alignItems: 'center', transform: [{ translateX: anim.x }, { translateY: anim.y }] }} pointerEvents="none">
      <View style={s.npcTag}><Text style={s.npcTagT} numberOfLines={1}>{v.flag} {v.nick} · {v.level}</Text></View>
      <Animated.Image source={NPC_SPRITES[v.color][dir]} style={{ width: SPRITE, height: SPRITE, transform: [{ translateY: by }] }} resizeMode="contain" />
    </Animated.View>
  );
}

// マスコット(桜・柴犬)。home周辺をゆっくり8方向で徘徊。歩行フレーム切替なし(方向ごとに1枚)。
// sink+sinkKey を渡すと現在位置を共有(親が近接判定に使う)。桜=会話あり / 柴犬=なし。
function AmbientNpc({ sprites, spot, tag, sink, sinkKey }: {
  sprites: Record<Dir, number>; spot: { col: number; row: number }; tag: string;
  sink?: Record<string, { x: number; y: number }>; sinkKey?: string;
}) {
  const home = useRef({ x: (spot.col + 0.5) * CELL - SPRITE / 2, y: (spot.row + 0.5) * CELL - SPRITE * 0.82 }).current;
  const pos = useRef({ x: home.x, y: home.y });
  const target = useRef({ x: home.x, y: home.y });
  const anim = useRef(new Animated.ValueXY({ x: home.x, y: home.y })).current;
  const [dir, setSDir] = useState<Dir>('down');
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 1000, useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 1000, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [bob]);
  useEffect(() => {
    if (sink && sinkKey) sink[sinkKey] = pos.current;
    let raf = 0, last = 0, wait = 600 + Math.random() * 2600;
    const NSPEED = 32, R = 2.0 * CELL;
    const frame = (ts: number) => {
      if (!last) last = ts;
      const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
      const dx = target.current.x - pos.current.x, dy = target.current.y - pos.current.y, dist = Math.hypot(dx, dy);
      if (dist < 2) {
        wait -= dt * 1000;
        if (wait <= 0) {
          let nx = home.x, ny = home.y;
          for (let i = 0; i < 8; i++) {
            const ang = Math.random() * Math.PI * 2, rr = Math.random() * R;
            const tx = home.x + Math.cos(ang) * rr, ty = home.y + Math.sin(ang) * rr;
            if (walkable(tx, ty)) { nx = tx; ny = ty; break; }
          }
          target.current = { x: nx, y: ny };
          wait = 1400 + Math.random() * 3200;
        }
      } else {
        const ux = dx / dist, uy = dy / dist, step = NSPEED * dt;
        if (walkable(pos.current.x + ux * step, pos.current.y)) pos.current.x += ux * step;
        if (walkable(pos.current.x, pos.current.y + uy * step)) pos.current.y += uy * step;
        anim.setValue({ x: pos.current.x, y: pos.current.y });
        let sec = Math.round(Math.atan2(uy, ux) / (Math.PI / 4)); sec = ((sec % 8) + 8) % 8;
        const nd = DIR8[sec].d; setSDir((p) => (p === nd ? p : nd));
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); if (sink && sinkKey) delete sink[sinkKey]; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const by = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });
  return (
    <Animated.View style={{ position: 'absolute', width: SPRITE, alignItems: 'center', transform: [{ translateX: anim.x }, { translateY: anim.y }] }} pointerEvents="none">
      <View style={s.npcTag}><Text style={s.npcTagT} numberOfLines={1}>{tag}</Text></View>
      <Animated.Image source={sprites[dir]} style={{ width: SPRITE, height: SPRITE, transform: [{ translateY: by }] }} resizeMode="contain" />
    </Animated.View>
  );
}

export default function KotobaTownScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { width: VW, height: VH } = useWindowDimensions();
  // 選んだアバターで自分の見た目を切替(女の子1/女の子2 は専用スプライト、それ以外=男の子)。
  const avatarCode = useAppState().settings.avatar;
  const SPRITES = (avatarCode && AVATAR_SETS[avatarCode]) || HERO;
  const streakCur = useAppState().streak?.current ?? 0; // 桜のほめ言葉に使う連続日数
  const isDay = useMemo(() => { const h = new Date().getHours(); return h >= 6 && h < 18; }, []);
  const MAP_IMG = isDay ? MAP_DAY : MAP_NIGHT;
  const MAP_TREE = isDay ? MAP_TREE_DAY : MAP_TREE_NIGHT; // 木の最前面レイヤーも昼夜で切替(夜も木の裏を通れる)

  const start = useRef({ x: (START_COL + 0.5) * CELL - SPRITE / 2, y: (START_ROW + 0.5) * CELL - SPRITE * 0.82 }).current;
  const pos = useRef({ x: start.x, y: start.y });
  const input = useRef({ dx: 0, dy: 0 }); // 単位ベクトル(斜め対応)
  const [dir, setDir] = useState<Dir>('down');
  const dirRef = useRef<Dir>('down');
  const [moving, setMoving] = useState(false);
  const [poseIdx, setPoseIdx] = useState(0); // 0=立ち/1=右足/2=左足

  // 仮想学習者との会話。npcPos=各NPCの現在位置(子から共有)。talk=会話中の相手。sent=送信後の反応。
  const npcPos = useRef<Record<string, { x: number; y: number }>>({}).current;
  const [talk, setTalk] = useState<VirtualLearner | null>(null);
  const [sent, setSent] = useState<{ emoji: string; reply: string } | null>(null);
  const talkRef = useRef<VirtualLearner | null>(null);
  const talkArmed = useRef(true);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openTalk = (v: VirtualLearner) => { talkRef.current = v; setSent(null); setTalk(v); };
  const closeTalk = () => { if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; } talkRef.current = null; setTalk(null); setSent(null); };
  const sendCheer = (c: { emoji: string; reply: string }) => {
    setSent({ emoji: c.emoji, reply: c.reply });
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => closeTalk(), 1800);
  };
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  // 桜との会話(努力をほめる)。応援コメントとは別カード。
  const [sakuraTalk, setSakuraTalk] = useState(false);
  const [praise, setPraise] = useState('');
  const sakuraTalkRef = useRef(false);
  const sakuraArmed = useRef(true);
  const openSakura = () => {
    const lines = sakuraPraise(streakCur);
    setPraise(lines[Math.floor(Math.random() * lines.length)]);
    sakuraTalkRef.current = true; setSakuraTalk(true);
  };
  const closeSakura = () => { sakuraTalkRef.current = false; setSakuraTalk(false); };

  const worldOff = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const playerPos = useRef(new Animated.ValueXY({ x: start.x, y: start.y })).current;
  const bob = useRef(new Animated.Value(0)).current;
  const knob = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  const applyCamera = () => {
    const camX = clamp(pos.current.x + SPRITE / 2 - VW / 2, 0, Math.max(0, WORLD - VW));
    const camY = clamp(pos.current.y + SPRITE / 2 - VH / 2, 0, Math.max(0, WORLD - VH));
    worldOff.setValue({ x: -camX, y: -camY });
  };

  useEffect(() => { applyCamera(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ワープ: 足元がゾーンに入ったら対応画面へ。一度ゾーン外に出るまで再発火しない(戻ってきた直後の連続発火を防ぐ)。
  const warpArmed = useRef(true);
  // タブの並び(App.tsx の TABS と一致させる)。書斎=単語 / 書庫=辞書。
  const TAB_ORDER = ['ホーム', '単語', '学習', '辞書'];
  const warp = (t: WarpTarget) => {
    if (t === 'Shop') { nav.navigate('Shop'); return; }
    if (t === 'MockIntro') { nav.navigate('MockIntro'); return; }
    // タブ(書斎=単語 / 書庫=辞書)へ。入れ子navigateだとマウント済みタブが切り替わらない端末があるため、
    // reset で Main＋全タブの状態を作り直し、対象タブをアクティブにする(町も確実に閉じる)。
    const tab = t === 'Dict' ? '辞書' : '単語';
    nav.dispatch(CommonActions.reset({
      index: 0,
      routes: [{ name: 'Main', state: { index: TAB_ORDER.indexOf(tab), routes: TAB_ORDER.map((n) => ({ name: n })) } }],
    }));
  };

  // 移動ループ。input は単位ベクトル→斜めでも一定速度。X/Yを別々に当たり判定=壁ずり。
  useEffect(() => {
    let raf = 0; let last = 0; let wasMoving = false; let walkPhase = 0;
    const tick = (ts: number) => {
      if (!last) last = ts;
      const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
      // 会話中(仮想学習者/桜)は入力を完全に無視して停止する。指が乗ったままでも勝手に進まない。
      // カーソルを離せば input=0 になり止まる。この2条件を移動の前提にして徹底する。
      const talking = talkRef.current || sakuraTalkRef.current;
      const { dx, dy } = input.current;
      const isMoving = !talking && !!(dx || dy);
      if (isMoving) {
        const nx = pos.current.x + dx * SPEED * dt;
        const ny = pos.current.y + dy * SPEED * dt;
        if (walkable(nx, pos.current.y)) pos.current.x = nx;
        if (walkable(pos.current.x, ny)) pos.current.y = ny;
        playerPos.setValue({ x: pos.current.x, y: pos.current.y });
        applyCamera();
        // 歩行アニメ: 立ち→右→立ち→左 を一定間隔で切り替え。
        walkPhase += dt;
        const wf = WALK_CYCLE[Math.floor(walkPhase / WALK_STEP) % WALK_CYCLE.length];
        setPoseIdx((p) => (p === wf ? p : wf));
        // 足元がワープ枠(石段)に乗ったら画面遷移。枠は石段だけの小さな矩形=触れて初めて反応。
        const fx = pos.current.x + SPRITE / 2, fy = pos.current.y + SPRITE * 0.82;
        const z = WARP_ZONES.find((q) => fx >= q.x && fx <= q.x + q.w && fy >= q.y && fy <= q.y + q.h);
        if (z && warpArmed.current) { warpArmed.current = false; input.current = { dx: 0, dy: 0 }; warp(z.t); }
        else if (!z) warpArmed.current = true;
        // 仮想学習者に触れたら会話カードを開く(接触=距離ほぼ0)。一度離れるまで再オープンしない。
        if (!talkRef.current) {
          let near: VirtualLearner | null = null, best = 1e9;
          for (const vl of VIRTUAL_LEARNERS) { const p = npcPos[vl.id]; if (!p) continue; const d = Math.hypot(fx - (p.x + SPRITE / 2), fy - (p.y + SPRITE * 0.82)); if (d < best) { best = d; near = vl; } }
          if (near && best < 26 && talkArmed.current) { talkArmed.current = false; input.current = { dx: 0, dy: 0 }; openTalk(near); }
          else if (!near || best > 52) talkArmed.current = true;
        }
        // 桜に触れたら「努力をほめる」カードを開く(応援とは別)。
        if (!talkRef.current && !sakuraTalkRef.current) {
          const p = npcPos['sakura'];
          if (p) {
            const d = Math.hypot(fx - (p.x + SPRITE / 2), fy - (p.y + SPRITE * 0.82));
            if (d < 26 && sakuraArmed.current) { sakuraArmed.current = false; input.current = { dx: 0, dy: 0 }; openSakura(); }
            else if (d > 52) sakuraArmed.current = true;
          }
        }
      }
      if (isMoving !== wasMoving) { wasMoving = isMoving; setMoving(isMoving); if (!isMoving) { walkPhase = 0; setPoseIdx(0); } }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
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
      // 8方向にスナップ(縦横斜めのみ)。入力角を45度刻みで丸める。
      let sec = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
      sec = ((sec % 8) + 8) % 8;
      const sd = DIR8[sec];
      input.current = { dx: sd.ux, dy: sd.uy };
      if (dirRef.current !== sd.d) { dirRef.current = sd.d; setDir(sd.d); }
    },
    onPanResponderRelease: () => { input.current = { dx: 0, dy: 0 }; Animated.spring(knob, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start(); },
    onPanResponderTerminate: () => { input.current = { dx: 0, dy: 0 }; Animated.spring(knob, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start(); },
  }), [knob]);

  return (
    <View style={s.c}>
      {/* マップ(カメラで動く世界。プレイヤーも world 内に置く) */}
      <View style={s.viewport}>
        <Animated.View style={{ position: 'absolute', width: WORLD, height: WORLD, transform: [{ translateX: worldOff.x }, { translateY: worldOff.y }] }}>
          {/* 下: マップ本体 */}
          <Image source={MAP_IMG} style={{ position: 'absolute', width: WORLD, height: WORLD }} resizeMode="cover" />
          {/* 下寄り: ベンチに座るアバター(装飾・動かない) */}
          {SITTERS.map((si, i) => (
            <Image key={i} source={si.img} style={{ position: 'absolute', left: si.x, top: si.y, width: si.w, height: si.h }} resizeMode="contain" />
          ))}
          {/* 中: 仮想の学習者(NPC) */}
          {VIRTUAL_LEARNERS.map((v) => <NpcSprite key={v.id} v={v} sink={npcPos} />)}
          {/* 中: マスコット(桜=会話あり / 柴犬=会話なし) */}
          <AmbientNpc sprites={SHIBA} spot={SHIBA_HOME} tag="🐕 柴犬" />
          <AmbientNpc sprites={SAKURA} spot={SAKURA_HOME} tag="🌸 桜" sink={npcPos} sinkKey="sakura" />

          {/* 中: 自分(NPCより手前) */}
          <Animated.View style={{ position: 'absolute', width: SPRITE, height: SPRITE, transform: [{ translateX: playerPos.x }, { translateY: playerPos.y }] }}>
            <Animated.Image source={SPRITES[dir][poseIdx]} style={{ width: SPRITE, height: SPRITE, transform: [{ translateY: bobY }] }} resizeMode="contain" />
          </Animated.View>
          {/* 上: 木のレイヤー(人より前面=木の裏に回ると隠れる)。day.jpgと同じ位置に重ねる。 */}
          <Image source={MAP_TREE} style={{ position: 'absolute', left: TREE.x, top: TREE.y, width: TREE.w, height: TREE.h }} resizeMode="stretch" />
          {/* 上: 家の屋根レイヤー(人より前面=屋根の下を歩くと隠れる)。昼夜で切替。 */}
          {ROOFS.map((rf, i) => (
            <Image key={i} source={isDay ? rf.day : rf.night} style={{ position: 'absolute', left: rf.x, top: rf.y, width: rf.w, height: rf.h }} resizeMode="stretch" />
          ))}
        </Animated.View>
      </View>

      {/* 上部バー */}
      <SafeAreaView edges={['top']} style={s.top} pointerEvents="box-none">
        <View style={s.topBar} pointerEvents="box-none">
          <View style={s.pill}><Text style={s.pillT}>日本語学習者の町</Text></View>
          <Pressable onPress={() => nav.goBack()} hitSlop={12} style={s.close}><Ionicons name="close" size={22} color="#3a3128" /></Pressable>
        </View>
      </SafeAreaView>

      {/* 操作(アナログスティック・斜めOK)。会話中は隠す=足を止めて話す。 */}
      {!talk && !sakuraTalk && (
      <SafeAreaView edges={['bottom']} style={s.bottom} pointerEvents="box-none">
        <View style={s.stickWrap}>
          <View style={s.stickBase} {...pan.panHandlers}>
            <Animated.View style={[s.stickKnob, { transform: [{ translateX: knob.x }, { translateY: knob.y }] }]} />
          </View>
        </View>
      </SafeAreaView>
      )}

      {/* 仮想学習者の会話カード(データ表示＋応援コメント) */}
      {talk && (
        <View style={s.talkWrap}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeTalk} />
          <View style={s.talkCard}>
            <Pressable onPress={closeTalk} hitSlop={10} style={s.talkClose}><Ionicons name="close" size={20} color="#3a3128" /></Pressable>
            <View style={s.talkHead}>
              <View style={s.talkAvatar}><Image source={NPC_SPRITES[talk.color].down} style={{ width: 54, height: 54 }} resizeMode="contain" /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.talkName}>{talk.flag} {talk.nick}</Text>
                <View style={s.talkStats}>
                  <View style={s.lvlBadge}><Text style={s.lvlBadgeT}>{talk.level}</Text></View>
                  <Text style={s.talkStatT}>🔥 連続{talk.streak}日</Text>
                  <Text style={s.talkStatT}>✏️ 今日{talk.today}問</Text>
                </View>
              </View>
            </View>
            {sent ? (
              <View style={s.sentBox}>
                <Text style={s.sentEmoji}>{sent.emoji}</Text>
                <Text style={s.sentT}>応援を送りました！</Text>
                <Text style={s.sentReply}>{talk.nick}「{sent.reply}」</Text>
              </View>
            ) : (
              <>
                <Text style={s.cheerTitle}>応援コメントを送る</Text>
                <View style={s.cheerGrid}>
                  {CHEERS.map((c) => (
                    <Pressable key={c.key} style={s.cheerBtn} onPress={() => sendCheer(c)}>
                      <Text style={s.cheerEmoji}>{c.emoji}</Text>
                      <Text style={s.cheerLabel} numberOfLines={1}>{c.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
          </View>
        </View>
      )}

      {/* 桜の会話カード(努力をほめる) */}
      {sakuraTalk && (
        <View style={s.talkWrap}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSakura} />
          <View style={s.talkCard}>
            <Pressable onPress={closeSakura} hitSlop={10} style={s.talkClose}><Ionicons name="close" size={20} color="#3a3128" /></Pressable>
            <View style={s.talkHead}>
              <View style={s.talkAvatar}><Image source={SAKURA.down} style={{ width: 54, height: 54 }} resizeMode="contain" /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.talkName}>🌸 桜</Text>
                <Text style={s.talkStatT}>あなたの努力を見てるよ</Text>
              </View>
            </View>
            <Text style={s.praiseMsg}>{praise}</Text>
            <Pressable onPress={closeSakura} style={s.praiseBtn}><Text style={s.praiseBtnT}>ありがとう🌸</Text></Pressable>
          </View>
        </View>
      )}
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
  npcTag: { position: 'absolute', top: -14, backgroundColor: 'rgba(58,49,40,0.8)', borderRadius: 7, paddingHorizontal: 5, paddingVertical: 1, maxWidth: 130 },
  npcTagT: { color: '#fff', fontSize: 9, fontWeight: '700' },
  talkWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.28)' },
  talkCard: { width: '86%', maxWidth: 360, backgroundColor: '#fffdf8', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: 'rgba(58,49,40,0.15)' },
  talkClose: { position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  talkHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14, paddingRight: 24 },
  talkAvatar: { width: 62, height: 62, borderRadius: 31, backgroundColor: 'rgba(58,49,40,0.06)', alignItems: 'center', justifyContent: 'center' },
  talkName: { fontSize: 17, fontWeight: '900', color: '#3a3128', marginBottom: 5 },
  talkStats: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  lvlBadge: { backgroundColor: '#3a6ea5', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  lvlBadgeT: { color: '#fff', fontSize: 11, fontWeight: '900' },
  talkStatT: { fontSize: 12, color: '#6b5d4d', fontWeight: '700' },
  cheerTitle: { fontSize: 13, fontWeight: '800', color: '#6b5d4d', marginBottom: 8 },
  cheerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cheerBtn: { width: '47%', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f3ece0', borderRadius: 12, paddingVertical: 11, paddingHorizontal: 10 },
  cheerEmoji: { fontSize: 18 },
  cheerLabel: { fontSize: 12.5, fontWeight: '800', color: '#3a3128', flexShrink: 1 },
  sentBox: { alignItems: 'center', paddingVertical: 16, gap: 6 },
  sentEmoji: { fontSize: 42 },
  sentT: { fontSize: 15, fontWeight: '900', color: '#3a3128' },
  sentReply: { fontSize: 13, color: '#6b5d4d', fontWeight: '600' },
  praiseMsg: { fontSize: 15.5, lineHeight: 24, fontWeight: '700', color: '#3a3128', paddingVertical: 6 },
  praiseBtn: { marginTop: 12, alignSelf: 'center', backgroundColor: '#f6d9e2', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 22 },
  praiseBtnT: { fontSize: 14.5, fontWeight: '900', color: '#a13b5c' },
});
