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
import { VIRTUAL_LEARNERS, type VirtualLearner } from '../plaza/virtualLearners';

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
// 女の子3アバター。8方向×各[立ち,右足,左足]。
const HERO_F3: Record<Dir, number[]> = {
  down: [require('../../assets/kotoba/hero_f3/down.png'), require('../../assets/kotoba/hero_f3/down_r.png'), require('../../assets/kotoba/hero_f3/down_l.png')],
  up: [require('../../assets/kotoba/hero_f3/up.png'), require('../../assets/kotoba/hero_f3/up_r.png'), require('../../assets/kotoba/hero_f3/up_l.png')],
  left: [require('../../assets/kotoba/hero_f3/left.png'), require('../../assets/kotoba/hero_f3/left_r.png'), require('../../assets/kotoba/hero_f3/left_l.png')],
  right: [require('../../assets/kotoba/hero_f3/right.png'), require('../../assets/kotoba/hero_f3/right_r.png'), require('../../assets/kotoba/hero_f3/right_l.png')],
  downleft: [require('../../assets/kotoba/hero_f3/downleft.png'), require('../../assets/kotoba/hero_f3/downleft_r.png'), require('../../assets/kotoba/hero_f3/downleft_l.png')],
  downright: [require('../../assets/kotoba/hero_f3/downright.png'), require('../../assets/kotoba/hero_f3/downright_r.png'), require('../../assets/kotoba/hero_f3/downright_l.png')],
  upleft: [require('../../assets/kotoba/hero_f3/upleft.png'), require('../../assets/kotoba/hero_f3/upleft_r.png'), require('../../assets/kotoba/hero_f3/upleft_l.png')],
  upright: [require('../../assets/kotoba/hero_f3/upright.png'), require('../../assets/kotoba/hero_f3/upright_r.png'), require('../../assets/kotoba/hero_f3/upright_l.png')],
};
// 女の子4アバター。8方向×各[立ち,右足,左足]。
const HERO_F4: Record<Dir, number[]> = {
  down: [require('../../assets/kotoba/hero_f4/down.png'), require('../../assets/kotoba/hero_f4/down_r.png'), require('../../assets/kotoba/hero_f4/down_l.png')],
  up: [require('../../assets/kotoba/hero_f4/up.png'), require('../../assets/kotoba/hero_f4/up_r.png'), require('../../assets/kotoba/hero_f4/up_l.png')],
  left: [require('../../assets/kotoba/hero_f4/left.png'), require('../../assets/kotoba/hero_f4/left_r.png'), require('../../assets/kotoba/hero_f4/left_l.png')],
  right: [require('../../assets/kotoba/hero_f4/right.png'), require('../../assets/kotoba/hero_f4/right_r.png'), require('../../assets/kotoba/hero_f4/right_l.png')],
  downleft: [require('../../assets/kotoba/hero_f4/downleft.png'), require('../../assets/kotoba/hero_f4/downleft_r.png'), require('../../assets/kotoba/hero_f4/downleft_l.png')],
  downright: [require('../../assets/kotoba/hero_f4/downright.png'), require('../../assets/kotoba/hero_f4/downright_r.png'), require('../../assets/kotoba/hero_f4/downright_l.png')],
  upleft: [require('../../assets/kotoba/hero_f4/upleft.png'), require('../../assets/kotoba/hero_f4/upleft_r.png'), require('../../assets/kotoba/hero_f4/upleft_l.png')],
  upright: [require('../../assets/kotoba/hero_f4/upright.png'), require('../../assets/kotoba/hero_f4/upright_r.png'), require('../../assets/kotoba/hero_f4/upright_l.png')],
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
// 男の子3アバター。8方向×各[立ち,右足,左足]。
const HERO_M3: Record<Dir, number[]> = {
  down: [require('../../assets/kotoba/hero_m3/down.png'), require('../../assets/kotoba/hero_m3/down_r.png'), require('../../assets/kotoba/hero_m3/down_l.png')],
  up: [require('../../assets/kotoba/hero_m3/up.png'), require('../../assets/kotoba/hero_m3/up_r.png'), require('../../assets/kotoba/hero_m3/up_l.png')],
  left: [require('../../assets/kotoba/hero_m3/left.png'), require('../../assets/kotoba/hero_m3/left_r.png'), require('../../assets/kotoba/hero_m3/left_l.png')],
  right: [require('../../assets/kotoba/hero_m3/right.png'), require('../../assets/kotoba/hero_m3/right_r.png'), require('../../assets/kotoba/hero_m3/right_l.png')],
  downleft: [require('../../assets/kotoba/hero_m3/downleft.png'), require('../../assets/kotoba/hero_m3/downleft_r.png'), require('../../assets/kotoba/hero_m3/downleft_l.png')],
  downright: [require('../../assets/kotoba/hero_m3/downright.png'), require('../../assets/kotoba/hero_m3/downright_r.png'), require('../../assets/kotoba/hero_m3/downright_l.png')],
  upleft: [require('../../assets/kotoba/hero_m3/upleft.png'), require('../../assets/kotoba/hero_m3/upleft_r.png'), require('../../assets/kotoba/hero_m3/upleft_l.png')],
  upright: [require('../../assets/kotoba/hero_m3/upright.png'), require('../../assets/kotoba/hero_m3/upright_r.png'), require('../../assets/kotoba/hero_m3/upright_l.png')],
};
// アバターコード→歩行スプライト。男子(色違い含む)は既定の男の子で歩く。
const AVATAR_SETS: Record<string, Record<Dir, number[]>> = { m_boy1: HERO, m_boy2: HERO_M2, m_boy3: HERO_M3, f_g1: HERO_F, f_g2: HERO_F2, f_g3: HERO_F3, f_g4: HERO_F4 };

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

// ベンチに座るアバター(装飾・動かない)。正面向き=長手方向のベンチに足を垂直に垂らして座る姿。x,y=ワールド左上, w,h=表示サイズ。
const SIT = {
  g_light: require('../../assets/kotoba/sit/g_light_front.png'),
  g_dark: require('../../assets/kotoba/sit/g_dark_front.png'),
  m_navy: require('../../assets/kotoba/sit/m_navy_front.png'),
  m_white: require('../../assets/kotoba/sit/m_white_front.png'),
};
// ベンチの真ん中に正面向きで座るアバター。会話も可(v=会話カード用プロフィール。歩くNPCと同形式・home未使用)。
type Sitter = { img: number; x: number; y: number; w: number; h: number; v: VirtualLearner };
const SITTERS: Sitter[] = [
  { img: SIT.g_light, x: 336, y: 430, w: 32, h: 58, v: { id: 's1', nick: 'Yuki', flag: '🇹🇼', level: 'N5', streak: 9, today: 16, avatar: 'f_g1', home: { col: 0, row: 0 }, studying: '語彙', learned: 240, weekLearned: 38, todayMin: 30, strong: '語彙', note: 'ベンチで単語カード中📖' } },   // 左上ベンチ
  { img: SIT.m_navy,  x: 612, y: 424, w: 25, h: 58, v: { id: 's2', nick: 'Diego', flag: '🇲🇽', level: 'N4', streak: 6, today: 14, avatar: 'm_boy1', home: { col: 0, row: 0 }, studying: '聴解', learned: 430, weekLearned: 52, todayMin: 40, strong: '聴解', note: '毎日ラジオを聞いてます' } }, // 右上ベンチ
  { img: SIT.g_dark,  x: 328, y: 500, w: 37, h: 58, v: { id: 's3', nick: 'Hana', flag: '🇵🇭', level: 'N3', streak: 21, today: 28, avatar: 'f_g2', home: { col: 0, row: 0 }, studying: '文法', learned: 980, weekLearned: 96, todayMin: 55, strong: '文法', note: '文法ノートまとめ中' } },  // 左下ベンチ
  { img: SIT.m_white, x: 529, y: 500, w: 26, h: 58, v: { id: 's4', nick: 'Omar', flag: '🇪🇬', level: 'N4', streak: 11, today: 22, avatar: 'm_boy2', home: { col: 0, row: 0 }, studying: '漢字', learned: 560, weekLearned: 61, todayMin: 35, strong: '漢字', note: '漢字の書き取り練習' } }, // 下ベンチ
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

// ワープ枠(WORLD=1024座標)。位置=ユーザーが手塗りした「赤」＝各建物の玄関の石段。足元が乗ると発火。
type WarpTarget = 'Shop' | 'MockIntro' | 'Words' | 'Dict';
const WARP_ZONES: { x: number; y: number; w: number; h: number; t: WarpTarget }[] = [
  { x: 202, y: 308, w: 112, h: 61, t: 'Shop' },      // 左上・受付(女の子)前の赤い石段=ショップ
  { x: 725, y: 273, w: 64, h: 53, t: 'MockIntro' },  // 右上・模試会場の赤い石段=模試(説明画面から)
  { x: 820, y: 662, w: 67, h: 55, t: 'Words' },      // 右・書斎の赤い玄関石段=単語タブ
  { x: 439, y: 842, w: 82, h: 41, t: 'Dict' },       // 下・書庫の赤い玄関石段=辞書タブ
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

// 1体のNPC: home周辺(半径約2.4マス)をゆっくり8方向で歩き回る。見た目は町のアバター6種(プレイヤーと同じ歩行アニメ)。
// 頭上に国旗+名前+レベルの名札。表示専用。sink: 親が近接判定に使う現在位置の共有先(参照共有=毎フレーム最新)。
function NpcSprite({ v, sink }: { v: VirtualLearner; sink: Record<string, { x: number; y: number }> }) {
  const SET = AVATAR_SETS[v.avatar] || HERO;
  const home = useRef({ x: (v.home.col + 0.5) * CELL - SPRITE / 2, y: (v.home.row + 0.5) * CELL - SPRITE * 0.82 }).current;
  const pos = useRef({ x: home.x, y: home.y });
  const target = useRef({ x: home.x, y: home.y });
  const anim = useRef(new Animated.ValueXY({ x: home.x, y: home.y })).current;
  const [dir, setNpcDir] = useState<Dir>('down');
  const [poseIdx, setPoseIdx] = useState(0); // 0=立ち/1=右足/2=左足
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
    sink[v.id] = pos.current;
    let raf = 0, last = 0, wait = 400 + Math.random() * 2600, walkPhase = 0;
    const NSPEED = 40, R = 2.4 * CELL; // ゆっくり・home周辺だけ
    const frame = (ts: number) => {
      if (!last) last = ts;
      const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
      const dx = target.current.x - pos.current.x, dy = target.current.y - pos.current.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 2) {
        setPoseIdx((p) => (p === 0 ? p : 0)); // 立ち止まったら立ちポーズ
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
        // 8方向スナップ＋歩行アニメ(立ち→右→立ち→左)
        let sec = Math.round(Math.atan2(uy, ux) / (Math.PI / 4)); sec = ((sec % 8) + 8) % 8;
        const nd = DIR8[sec].d; setNpcDir((p) => (p === nd ? p : nd));
        walkPhase += dt;
        const wf = WALK_CYCLE[Math.floor(walkPhase / WALK_STEP) % WALK_CYCLE.length];
        setPoseIdx((p) => (p === wf ? p : wf));
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
      <Animated.Image source={SET[dir][poseIdx]} style={{ width: SPRITE, height: SPRITE, transform: [{ translateY: by }] }} resizeMode="contain" />
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
  const handed = useAppState().settings.handed ?? 'right'; // カーソル(スティック)を置く側。既定=右利き(右)
  const stickSide = handed === 'left' ? { alignSelf: 'flex-start' as const, paddingLeft: 22 } : { alignSelf: 'flex-end' as const, paddingRight: 22 };
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
          // 歩くNPCと、ベンチに座るアバターの両方から一番近い相手を選ぶ。座り手はベンチが当たり判定で塞がり
          // 密着できないので、少し広めのしきい値(thresh/rearm)で会話できるようにする。
          let near: VirtualLearner | null = null, best = 1e9, thresh = 26, rearm = 52;
          for (const vl of VIRTUAL_LEARNERS) { const p = npcPos[vl.id]; if (!p) continue; const d = Math.hypot(fx - (p.x + SPRITE / 2), fy - (p.y + SPRITE * 0.82)); if (d < best) { best = d; near = vl; thresh = 26; rearm = 52; } }
          for (const st of SITTERS) { const d = Math.hypot(fx - (st.x + st.w / 2), fy - (st.y + st.h * 0.72)); if (d < best) { best = d; near = st.v; thresh = 54; rearm = 95; } }
          if (near && best < thresh && talkArmed.current) { talkArmed.current = false; input.current = { dx: 0, dy: 0 }; openTalk(near); }
          else if (!near || best > rearm) talkArmed.current = true;
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

  // スティックを初期位置へ戻す(入力ゼロ＋ノブを中心へ)。指を離した/会話が始まった等で必ず呼ぶ。
  const homeStick = () => {
    input.current = { dx: 0, dy: 0 };
    knob.stopAnimation();
    knob.setValue({ x: 0, y: 0 });
  };
  const homeStickRef = useRef(homeStick);
  homeStickRef.current = homeStick;
  // アナログスティック。指の変位→単位ベクトル(斜めOK)。向きは近い4方向。
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    // 指を離すまで他のレスポンダに奪わせない=Release/Terminateを確実に発火させ、ノブの張り付き/勝手移動を防ぐ。
    onPanResponderTerminationRequest: () => false,
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
    onPanResponderRelease: () => homeStickRef.current(),
    onPanResponderTerminate: () => homeStickRef.current(),
  }), [knob]);

  // 会話(仮想学習者/桜)が始まったらスティックを確実に初期化。指を乗せたまま会話が開いても、
  // ノブが円周に張り付いたり入力が残って勝手に進むことがないようにする。
  useEffect(() => { if (talk || sakuraTalk) homeStickRef.current(); }, [talk, sakuraTalk]);

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

      {/* 操作(アナログスティック・斜めOK)。会話中は"消さずに"隠して触れなくする(アンマウントすると指を離す前に
          消えてノブが張り付く/入力が残って勝手に進む原因になる)。opacityで隠し、pointerEvents=noneで操作不可にする。 */}
      <SafeAreaView edges={['bottom']} style={s.bottom} pointerEvents="box-none">
        <View style={[s.stickWrap, stickSide, { opacity: (talk || sakuraTalk) ? 0 : 1 }]} pointerEvents={(talk || sakuraTalk) ? 'none' : 'auto'}>
          <View style={s.stickBase} {...pan.panHandlers}>
            <Animated.View style={[s.stickKnob, { transform: [{ translateX: knob.x }, { translateY: knob.y }] }]} />
          </View>
        </View>
      </SafeAreaView>

      {/* 仮想学習者の会話カード(データ表示＋応援コメント) */}
      {talk && (
        <View style={s.talkWrap}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeTalk} />
          <View style={s.talkCard}>
            <Pressable onPress={closeTalk} hitSlop={10} style={s.talkClose}><Ionicons name="close" size={20} color="#ffffff" /></Pressable>
            <View style={s.talkHead}>
              <View style={s.talkAvatar}><Image source={(AVATAR_SETS[talk.avatar] || HERO).down[0]} style={{ width: 54, height: 54 }} resizeMode="contain" /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.talkName}>{talk.flag} {talk.nick}</Text>
                <View style={s.talkStats}>
                  <View style={s.lvlBadge}><Text style={s.lvlBadgeT}>{talk.level}</Text></View>
                  <Text style={s.talkStatT}>🔥 連続{talk.streak}日</Text>
                  <Text style={s.talkStatT}>✏️ 今日{talk.today}問</Text>
                </View>
              </View>
            </View>
            {/* 具体的な頑張り(いま勉強している分野・覚えた語数・一言)。〇〇さんは聴解を勉強しています、を表示。 */}
            {(talk.studying || talk.learned || talk.todayMin || talk.strong || talk.note) && (
              <View style={s.effortBox}>
                {talk.studying ? <Text style={s.effortT}>📚 {talk.nick}さんは いま<Text style={s.effortEm}>「{talk.studying}」</Text>を勉強しています</Text> : null}
                {talk.todayMin ? <Text style={s.effortT}>⏱️ 今日は <Text style={s.effortEm}>{talk.todayMin}分</Text> 勉強しました</Text> : null}
                {talk.weekLearned ? <Text style={s.effortT}>🔥 この7日で <Text style={s.effortEm}>{talk.weekLearned}語</Text> おぼえました</Text> : null}
                {talk.learned ? <Text style={s.effortT}>📖 これまで <Text style={s.effortEm}>{talk.learned}語</Text> おぼえました</Text> : null}
                {talk.strong ? <Text style={s.effortT}>🌟 <Text style={s.effortEm}>{talk.strong}</Text> が得意です</Text> : null}
                {talk.note ? <Text style={s.effortNote}>💬「{talk.note}」</Text> : null}
              </View>
            )}
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
            <Pressable onPress={closeSakura} hitSlop={10} style={s.talkClose}><Ionicons name="close" size={20} color="#ffffff" /></Pressable>
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
  stickWrap: { paddingBottom: 26 }, // 左右はhandedで付与(右利き=右)
  stickBase: { width: STICK_R * 2, height: STICK_R * 2, borderRadius: STICK_R, backgroundColor: 'rgba(58,49,40,0.28)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' },
  stickKnob: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,253,248,0.9)', borderWidth: 2, borderColor: 'rgba(58,49,40,0.4)' },
  npcTag: { position: 'absolute', top: -14, backgroundColor: 'rgba(58,49,40,0.8)', borderRadius: 7, paddingHorizontal: 5, paddingVertical: 1, maxWidth: 130 },
  npcTagT: { color: '#fff', fontSize: 9, fontWeight: '700' },
  // 会話カード=ドラクエ風メッセージウィンドウ(濃紺の地＋白い角丸フレーム＋白文字＋金の強調)。
  talkWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  talkCard: { width: '88%', maxWidth: 360, backgroundColor: '#0b1233', borderRadius: 14, padding: 16, borderWidth: 3, borderColor: '#ffffff' },
  talkClose: { position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  talkHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14, paddingRight: 24 },
  talkAvatar: { width: 62, height: 62, borderRadius: 31, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  talkName: { fontSize: 17, fontWeight: '900', color: '#ffffff', marginBottom: 5, letterSpacing: 0.3 },
  talkStats: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  lvlBadge: { backgroundColor: '#4f86c6', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  lvlBadgeT: { color: '#fff', fontSize: 11, fontWeight: '900' },
  talkStatT: { fontSize: 12, color: '#b9c6f2', fontWeight: '700' },
  effortBox: { backgroundColor: '#172054', borderRadius: 10, padding: 11, marginBottom: 12, gap: 4, borderWidth: 1, borderColor: '#3a4a92' },
  effortT: { fontSize: 13, color: '#eaf0ff', fontWeight: '700', lineHeight: 19 },
  effortEm: { color: '#ffd76b', fontWeight: '900' },
  effortNote: { fontSize: 12.5, color: '#b9c6f2', fontWeight: '600', fontStyle: 'italic', marginTop: 2 },
  cheerTitle: { fontSize: 13, fontWeight: '800', color: '#b9c6f2', marginBottom: 8 },
  cheerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cheerBtn: { width: '47%', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#172054', borderRadius: 8, borderWidth: 1.5, borderColor: '#5566b0', paddingVertical: 11, paddingHorizontal: 10 },
  cheerEmoji: { fontSize: 18 },
  cheerLabel: { fontSize: 12.5, fontWeight: '800', color: '#ffffff', flexShrink: 1 },
  sentBox: { alignItems: 'center', paddingVertical: 16, gap: 6 },
  sentEmoji: { fontSize: 42 },
  sentT: { fontSize: 15, fontWeight: '900', color: '#ffffff' },
  sentReply: { fontSize: 13, color: '#b9c6f2', fontWeight: '600' },
  praiseMsg: { fontSize: 15.5, lineHeight: 24, fontWeight: '700', color: '#ffffff', paddingVertical: 6 },
  praiseBtn: { marginTop: 12, alignSelf: 'center', backgroundColor: '#172054', borderRadius: 8, borderWidth: 2, borderColor: '#ffd76b', paddingVertical: 10, paddingHorizontal: 22 },
  praiseBtnT: { fontSize: 14.5, fontWeight: '900', color: '#ffd76b' },
});
