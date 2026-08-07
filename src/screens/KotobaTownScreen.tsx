// おさんぽ(散歩マップ)。実マップ画像(昼/夜)＋自分のアバターをバーチャルスティックで8方向移動＋当たり判定＋カメラ追従。
//  ・操作=アナログスティック。入力角を45度刻みで丸め、移動は縦横斜めの8方向だけ。向きも8方向の絵に対応。
//  ・当たり判定=src/plaza/mapCollision.ts(色解析で自動生成した MAP_G×MAP_G。'.'歩ける/'#'止まる)。X/Yを別々に判定=壁ずり移動。
//  ・描画: マップ画像1枚＋プレイヤー。移動は transform を毎フレーム setValue(再描画なし=軽い)。向き変化時だけ画像差し替え。
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Image, Animated, Pressable, PanResponder, StyleSheet, useWindowDimensions, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, CommonActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { MAP_G, MAP_WALK } from '../plaza/mapCollision';
import { useAppState } from '../store/store';
import type { RootStackParamList } from '../navigation/types';
import { VIRTUAL_LEARNERS, type VirtualLearner } from '../plaza/virtualLearners';
import { personalityOf, moodMsgOf, personaLineOf } from '../plaza/persona';
import { useSync } from '../auth/SyncProvider';
import { friendPublish, townMembers } from '../plaza/friendsClient';
import { friendToLearner, pickFriendHomes } from '../plaza/friendResidents';
import { daimonMasteryCounts } from '../store/selectors';

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
const HERO_F5: Record<Dir, number[]> = {
  down: [require('../../assets/kotoba/hero_f5/down.png'), require('../../assets/kotoba/hero_f5/down_r.png'), require('../../assets/kotoba/hero_f5/down_l.png')],
  up: [require('../../assets/kotoba/hero_f5/up.png'), require('../../assets/kotoba/hero_f5/up_r.png'), require('../../assets/kotoba/hero_f5/up_l.png')],
  left: [require('../../assets/kotoba/hero_f5/left.png'), require('../../assets/kotoba/hero_f5/left_r.png'), require('../../assets/kotoba/hero_f5/left_l.png')],
  right: [require('../../assets/kotoba/hero_f5/right.png'), require('../../assets/kotoba/hero_f5/right_r.png'), require('../../assets/kotoba/hero_f5/right_l.png')],
  downleft: [require('../../assets/kotoba/hero_f5/downleft.png'), require('../../assets/kotoba/hero_f5/downleft_r.png'), require('../../assets/kotoba/hero_f5/downleft_l.png')],
  downright: [require('../../assets/kotoba/hero_f5/downright.png'), require('../../assets/kotoba/hero_f5/downright_r.png'), require('../../assets/kotoba/hero_f5/downright_l.png')],
  upleft: [require('../../assets/kotoba/hero_f5/upleft.png'), require('../../assets/kotoba/hero_f5/upleft_r.png'), require('../../assets/kotoba/hero_f5/upleft_l.png')],
  upright: [require('../../assets/kotoba/hero_f5/upright.png'), require('../../assets/kotoba/hero_f5/upright_r.png'), require('../../assets/kotoba/hero_f5/upright_l.png')],
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
const HERO_M4: Record<Dir, number[]> = {
  down: [require('../../assets/kotoba/hero_m4/down.png'), require('../../assets/kotoba/hero_m4/down_r.png'), require('../../assets/kotoba/hero_m4/down_l.png')],
  up: [require('../../assets/kotoba/hero_m4/up.png'), require('../../assets/kotoba/hero_m4/up_r.png'), require('../../assets/kotoba/hero_m4/up_l.png')],
  left: [require('../../assets/kotoba/hero_m4/left.png'), require('../../assets/kotoba/hero_m4/left_r.png'), require('../../assets/kotoba/hero_m4/left_l.png')],
  right: [require('../../assets/kotoba/hero_m4/right.png'), require('../../assets/kotoba/hero_m4/right_r.png'), require('../../assets/kotoba/hero_m4/right_l.png')],
  downleft: [require('../../assets/kotoba/hero_m4/downleft.png'), require('../../assets/kotoba/hero_m4/downleft_r.png'), require('../../assets/kotoba/hero_m4/downleft_l.png')],
  downright: [require('../../assets/kotoba/hero_m4/downright.png'), require('../../assets/kotoba/hero_m4/downright_r.png'), require('../../assets/kotoba/hero_m4/downright_l.png')],
  upleft: [require('../../assets/kotoba/hero_m4/upleft.png'), require('../../assets/kotoba/hero_m4/upleft_r.png'), require('../../assets/kotoba/hero_m4/upleft_l.png')],
  upright: [require('../../assets/kotoba/hero_m4/upright.png'), require('../../assets/kotoba/hero_m4/upright_r.png'), require('../../assets/kotoba/hero_m4/upright_l.png')],
};
const HERO_M5: Record<Dir, number[]> = {
  down: [require('../../assets/kotoba/hero_m5/down.png'), require('../../assets/kotoba/hero_m5/down_r.png'), require('../../assets/kotoba/hero_m5/down_l.png')],
  up: [require('../../assets/kotoba/hero_m5/up.png'), require('../../assets/kotoba/hero_m5/up_r.png'), require('../../assets/kotoba/hero_m5/up_l.png')],
  left: [require('../../assets/kotoba/hero_m5/left.png'), require('../../assets/kotoba/hero_m5/left_r.png'), require('../../assets/kotoba/hero_m5/left_l.png')],
  right: [require('../../assets/kotoba/hero_m5/right.png'), require('../../assets/kotoba/hero_m5/right_r.png'), require('../../assets/kotoba/hero_m5/right_l.png')],
  downleft: [require('../../assets/kotoba/hero_m5/downleft.png'), require('../../assets/kotoba/hero_m5/downleft_r.png'), require('../../assets/kotoba/hero_m5/downleft_l.png')],
  downright: [require('../../assets/kotoba/hero_m5/downright.png'), require('../../assets/kotoba/hero_m5/downright_r.png'), require('../../assets/kotoba/hero_m5/downright_l.png')],
  upleft: [require('../../assets/kotoba/hero_m5/upleft.png'), require('../../assets/kotoba/hero_m5/upleft_r.png'), require('../../assets/kotoba/hero_m5/upleft_l.png')],
  upright: [require('../../assets/kotoba/hero_m5/upright.png'), require('../../assets/kotoba/hero_m5/upright_r.png'), require('../../assets/kotoba/hero_m5/upright_l.png')],
};
// アバターコード→歩行スプライト。男子(色違い含む)は既定の男の子で歩く。
const AVATAR_SETS: Record<string, Record<Dir, number[]>> = { m_boy1: HERO, m_boy2: HERO_M2, m_boy3: HERO_M3, m_boy4: HERO_M4, m_boy5: HERO_M5, f_g1: HERO_F, f_g2: HERO_F2, f_g3: HERO_F3, f_g4: HERO_F4, f_g5: HERO_F5 };

// 会話画面の背景(3シーン×昼夜)。町で話しかけると全画面の舞台になる。学習者ごとに固定シーン(idハッシュ)。
const SCENES: Record<string, { day: number; night: number }> = {
  forest: { day: require('../../assets/kotoba/scene/forest_day.jpg'), night: require('../../assets/kotoba/scene/forest_night.jpg') },
  pond: { day: require('../../assets/kotoba/scene/pond_day.jpg'), night: require('../../assets/kotoba/scene/pond_night.jpg') },
  town: { day: require('../../assets/kotoba/scene/town_day.jpg'), night: require('../../assets/kotoba/scene/town_night.jpg') },
};
const SCENE_KEYS = ['forest', 'pond', 'town'];
// 会話ステータスの装飾枠(大外の外＋バー窓が透過)。ラベル/値/バー/数字はアプリが動的に重ねる。
const STATUSFRAME = require('../../assets/kotoba/ui/statusframe.png');
// 台詞の装飾ダイアログボックス(左上プレート＋右下▼が内蔵)。全幅・白文字で名前/台詞を重ねる。
const DIALOGBOX = require('../../assets/kotoba/ui/dialogbox.png');
// 会話を始めるたびにシーンをランダムに選ぶ(固定ではなく多様性を持たせる)。昼夜は実時刻(isDay)で切替。

// 桜(マスコット)。8方向・歩行アニメ付き([立ち, 右足, 左足])。近づいて話すと努力を褒めてくれる。
const SAKURA: Record<Dir, number[]> = {
  down: [require('../../assets/kotoba/sakura/down.png'), require('../../assets/kotoba/sakura/down_r.png'), require('../../assets/kotoba/sakura/down_l.png')],
  up: [require('../../assets/kotoba/sakura/up.png'), require('../../assets/kotoba/sakura/up_r.png'), require('../../assets/kotoba/sakura/up_l.png')],
  left: [require('../../assets/kotoba/sakura/left.png'), require('../../assets/kotoba/sakura/left_r.png'), require('../../assets/kotoba/sakura/left_l.png')],
  right: [require('../../assets/kotoba/sakura/right.png'), require('../../assets/kotoba/sakura/right_r.png'), require('../../assets/kotoba/sakura/right_l.png')],
  downleft: [require('../../assets/kotoba/sakura/downleft.png'), require('../../assets/kotoba/sakura/downleft_r.png'), require('../../assets/kotoba/sakura/downleft_l.png')],
  downright: [require('../../assets/kotoba/sakura/downright.png'), require('../../assets/kotoba/sakura/downright_r.png'), require('../../assets/kotoba/sakura/downright_l.png')],
  upleft: [require('../../assets/kotoba/sakura/upleft.png'), require('../../assets/kotoba/sakura/upleft_r.png'), require('../../assets/kotoba/sakura/upleft_l.png')],
  upright: [require('../../assets/kotoba/sakura/upright.png'), require('../../assets/kotoba/sakura/upright_r.png'), require('../../assets/kotoba/sakura/upright_l.png')],
};
const SAKURA_HOME = { col: 27, row: 27 }; // 広場の歩けるマス(スポーン近く)

// 柴犬(マスコット犬)。8方向・歩行アニメ付き([立ち, 右足, 左足])。会話なし=町を歩き回るだけ。桜のそばに配置。
const SHIBA: Record<Dir, number[]> = {
  down: [require('../../assets/kotoba/shiba/down.png'), require('../../assets/kotoba/shiba/down_r.png'), require('../../assets/kotoba/shiba/down_l.png')],
  up: [require('../../assets/kotoba/shiba/up.png'), require('../../assets/kotoba/shiba/up_r.png'), require('../../assets/kotoba/shiba/up_l.png')],
  left: [require('../../assets/kotoba/shiba/left.png'), require('../../assets/kotoba/shiba/left_r.png'), require('../../assets/kotoba/shiba/left_l.png')],
  right: [require('../../assets/kotoba/shiba/right.png'), require('../../assets/kotoba/shiba/right_r.png'), require('../../assets/kotoba/shiba/right_l.png')],
  downleft: [require('../../assets/kotoba/shiba/downleft.png'), require('../../assets/kotoba/shiba/downleft_r.png'), require('../../assets/kotoba/shiba/downleft_l.png')],
  downright: [require('../../assets/kotoba/shiba/downright.png'), require('../../assets/kotoba/shiba/downright_r.png'), require('../../assets/kotoba/shiba/downright_l.png')],
  upleft: [require('../../assets/kotoba/shiba/upleft.png'), require('../../assets/kotoba/shiba/upleft_r.png'), require('../../assets/kotoba/shiba/upleft_l.png')],
  upright: [require('../../assets/kotoba/shiba/upright.png'), require('../../assets/kotoba/shiba/upright_r.png'), require('../../assets/kotoba/shiba/upright_l.png')],
};
const SHIBA_HOME = { col: 29, row: 28 };

// ベンチ付近の仮想学習者(動かない)。座り専用の旧画像(旧女の子1等が混入)は廃止し、立ちと同じ現行アバターの
// スプライトを SPRITE サイズで表示=大きさ正規化。x,y,w,h=元のベンチ位置(近接判定と足元合わせに使う)。
type Sitter = { x: number; y: number; w: number; h: number; v: VirtualLearner };
const SITTERS: Sitter[] = [
  { x: 336, y: 430, w: 32, h: 58, v: { id: 's1', nick: 'Yuki', flag: '🇹🇼', level: 'N5', streak: 9, today: 16, avatar: 'f_g1', home: { col: 0, row: 0 }, studying: '語彙', learned: 240, weekLearned: 38, todayMin: 30, strong: '語彙', mood: 'kotsu', personality: 'ottori', moodMsg: 'tanoshii' } },   // 左上ベンチ
  { x: 612, y: 424, w: 25, h: 58, v: { id: 's2', nick: 'Diego', flag: '🇲🇽', level: 'N4', streak: 6, today: 14, avatar: 'm_boy1', home: { col: 0, row: 0 }, studying: '聴解', learned: 430, weekLearned: 52, todayMin: 40, strong: '聴解', mood: 'mattari', personality: 'ochoshi', moodMsg: 'listening' } }, // 右上ベンチ
  { x: 328, y: 500, w: 37, h: 58, v: { id: 's3', nick: 'Hana', flag: '🇵🇭', level: 'N3', streak: 21, today: 28, avatar: 'f_g2', home: { col: 0, row: 0 }, studying: '文法', learned: 980, weekLearned: 96, todayMin: 55, strong: '文法', mood: 'doryoku', personality: 'shikkari', moodMsg: 'bunpo' } },  // 左下ベンチ
  { x: 529, y: 500, w: 26, h: 58, v: { id: 's4', nick: 'Omar', flag: '🇪🇬', level: 'N4', streak: 11, today: 22, avatar: 'm_boy2', home: { col: 0, row: 0 }, studying: '漢字', learned: 560, weekLearned: 61, todayMin: 35, strong: '漢字', mood: 'oikomi', personality: 'reisei', moodMsg: 'kanji' } }, // 下ベンチ
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
  { day: require('../../assets/kotoba/map/house_shosai_day.png'), night: require('../../assets/kotoba/map/house_shosai_night.png'), x: 742, y: 448, w: 256, h: 160 }, // 書斎(右) 屋根のみ=ユーザー仕上げ・背景と厳密一致(SSD=0)
  { day: require('../../assets/kotoba/map/house_shoko_day.png'), night: require('../../assets/kotoba/map/house_shoko_night.png'), x: 349, y: 625, w: 356, h: 180, nightY: 623 }, // 書庫(下) 屋根全体=前面レイヤー。上・左右へ12px大膨張し周囲の景色ごと余裕被覆(軒先の凹凸窪みも消す)・下は軒先でクリップし建物本体は覆わない・半透明なし。夜は勾配相関で-2px(nightY)
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
  { x: 192, y: 299, w: 107, h: 43, t: 'Shop' },      // ショップ(緑塗り位置)
  { x: 704, y: 277, w: 85, h: 43, t: 'MockIntro' },  // 試験会場(緑塗り位置)
  { x: 811, y: 661, w: 85, h: 43, t: 'Words' },      // 書斎(緑塗り位置)=単語タブ
  { x: 427, y: 853, w: 85, h: 43, t: 'Dict' },       // 書庫(緑塗り位置)=辞書タブ
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
      <View style={s.npcTag}><Text style={s.npcTagT} numberOfLines={1}>{v.nick} · {v.level}</Text></View>
      <Animated.Image source={SET[dir][poseIdx]} style={{ width: SPRITE, height: SPRITE, transform: [{ translateY: by }] }} resizeMode="contain" />
    </Animated.View>
  );
}

// マスコット(桜・柴犬)。home周辺をゆっくり8方向で徘徊。sink+sinkKey を渡すと現在位置を共有(親が近接判定に使う)。
// sprites が方向ごと配列 [立ち,右足,左足] なら歩行アニメ(柴犬)、1枚だけなら静止(桜)。桜=会話あり / 柴犬=なし。
function AmbientNpc({ sprites, spot, tag, sink, sinkKey }: {
  sprites: Record<Dir, number | number[]>; spot: { col: number; row: number }; tag: string;
  sink?: Record<string, { x: number; y: number }>; sinkKey?: string;
}) {
  const home = useRef({ x: (spot.col + 0.5) * CELL - SPRITE / 2, y: (spot.row + 0.5) * CELL - SPRITE * 0.82 }).current;
  const pos = useRef({ x: home.x, y: home.y });
  const target = useRef({ x: home.x, y: home.y });
  const anim = useRef(new Animated.ValueXY({ x: home.x, y: home.y })).current;
  const [dir, setSDir] = useState<Dir>('down');
  const [poseIdx, setPoseIdx] = useState(0); // 0=立ち/1=右足/2=左足(配列スプライトのみ)
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
    let raf = 0, last = 0, wait = 600 + Math.random() * 2600, walkPhase = 0;
    const NSPEED = 32, R = 2.0 * CELL;
    const frame = (ts: number) => {
      if (!last) last = ts;
      const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
      const dx = target.current.x - pos.current.x, dy = target.current.y - pos.current.y, dist = Math.hypot(dx, dy);
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
          wait = 1400 + Math.random() * 3200;
        }
      } else {
        const ux = dx / dist, uy = dy / dist, step = NSPEED * dt;
        if (walkable(pos.current.x + ux * step, pos.current.y)) pos.current.x += ux * step;
        if (walkable(pos.current.x, pos.current.y + uy * step)) pos.current.y += uy * step;
        anim.setValue({ x: pos.current.x, y: pos.current.y });
        let sec = Math.round(Math.atan2(uy, ux) / (Math.PI / 4)); sec = ((sec % 8) + 8) % 8;
        const nd = DIR8[sec].d; setSDir((p) => (p === nd ? p : nd));
        walkPhase += dt; // 歩行アニメ(立ち→右足→立ち→左足)。配列スプライト(柴犬)のみ効く
        const wf = WALK_CYCLE[Math.floor(walkPhase / WALK_STEP) % WALK_CYCLE.length];
        setPoseIdx((p) => (p === wf ? p : wf));
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); if (sink && sinkKey) delete sink[sinkKey]; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const by = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });
  const fr = sprites[dir]; const src = Array.isArray(fr) ? fr[poseIdx] : fr; // 配列=歩行フレーム/単一=静止
  return (
    <Animated.View style={{ position: 'absolute', width: SPRITE, alignItems: 'center', transform: [{ translateX: anim.x }, { translateY: anim.y }] }} pointerEvents="none">
      <View style={s.npcTag}><Text style={s.npcTagT} numberOfLines={1}>{tag}</Text></View>
      <Animated.Image source={src} style={{ width: SPRITE, height: SPRITE, transform: [{ translateY: by }] }} resizeMode="contain" />
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
  // 友だち(段階2): ログイン中は自分を公開＋友だちを町の住人として取り込む。
  const meState = useAppState();
  const { session } = useSync();
  const [friends, setFriends] = useState<VirtualLearner[]>([]);
  const residents = useMemo(() => [...VIRTUAL_LEARNERS, ...friends], [friends]); // 仮想学習者＋実在の友だち
  const residentsRef = useRef<VirtualLearner[]>(VIRTUAL_LEARNERS);
  residentsRef.current = residents; // 移動ループ(閉包)から最新の住人を参照するため
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
  const [talkStep, setTalkStep] = useState<'info' | 'status' | 'message'>('info'); // info=台詞(舞台) / status=ステータス / message=メッセージ送信
  const [talkPage, setTalkPage] = useState(0); // 台詞のページ送り(▼で進む)
  const [talkScene, setTalkScene] = useState<string>('forest'); // 会話ごとにランダムで選ぶ背景シーン
  const talkRef = useRef<VirtualLearner | null>(null);
  const talkArmed = useRef(true);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 「▼ 次へ」のほんのりした発光(上下に小さく脈打つ)。
  const nextPulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(nextPulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(nextPulse, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [nextPulse]);
  const openTalk = (v: VirtualLearner) => { talkRef.current = v; setSent(null); setTalkStep('info'); setTalkPage(0); setTalkScene(SCENE_KEYS[Math.floor(Math.random() * SCENE_KEYS.length)]); setTalk(v); };
  const closeTalk = () => { if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; } talkRef.current = null; setTalk(null); setSent(null); setTalkStep('info'); };
  const sendCheer = (c: { emoji: string; reply: string }) => {
    setSent({ emoji: c.emoji, reply: c.reply });
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => closeTalk(), 1800);
  };
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  // 友だち: ログイン中なら自分を公開(検索対象＋友だちの町に出る)し、友だち一覧を町の住人へ変換して置く。
  useEffect(() => {
    if (!session) { setFriends([]); return; }
    let cancelled = false;
    (async () => {
      const st = meState.settings;
      if (st.nickname) {
        const learnedTotal = daimonMasteryCounts(meState, Date.now()).reduce((a, b) => a + b.learned, 0);
        await friendPublish({
          nickname: st.nickname, country: st.country ?? null, gender: st.gender ?? null,
          avatar: st.avatar ?? 'm_boy1', level: st.level, streak: meState.streak?.current ?? 0,
          learned: learnedTotal, weekLearned: 0,
          studying: st.studying ?? null, strong: null,
          personality: st.personality ?? null, moodMsg: st.moodMsg ?? null,
        });
      }
      const list = await townMembers();
      if (cancelled) return;
      const isWalkable = (col: number, row: number) => MAP_WALK[row]?.[col] === '.';
      const homes = pickFriendHomes(list.length, isWalkable, VIRTUAL_LEARNERS.map((v) => v.home));
      setFriends(list.slice(0, homes.length).map((p, i) => friendToLearner(p, homes[i])));
    })();
    return () => { cancelled = true; };
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  // 桜との会話(努力をほめる)。学習者と同じノベル演出(全画面ランダム背景＋立ち絵＋ダイアログボックス)。
  const [sakuraTalk, setSakuraTalk] = useState(false);
  const [sakuraLines, setSakuraLines] = useState<string[]>([]); // 台詞ページ(▼で進む)
  const [sakuraPage, setSakuraPage] = useState(0);
  const sakuraTalkRef = useRef(false);
  const sakuraArmed = useRef(true);
  const openSakura = () => {
    const all = sakuraPraise(streakCur);
    // 2つ選んで2ページに(重複しないように)。
    const i = Math.floor(Math.random() * all.length);
    const j = (i + 1 + Math.floor(Math.random() * (all.length - 1))) % all.length;
    setSakuraLines([all[i], all[j]]);
    setSakuraPage(0);
    setTalkScene(SCENE_KEYS[Math.floor(Math.random() * SCENE_KEYS.length)]); // 背景も町の会話と同じ3種ランダム
    sakuraTalkRef.current = true; setSakuraTalk(true);
  };
  const closeSakura = () => { sakuraTalkRef.current = false; setSakuraTalk(false); setSakuraPage(0); };

  // 友だちを町に招待: 自分のuserIdを載せた招待リンクをSNSで共有。相手がリンクを開くと「参加/断る」→参加でこの町に住人として出る。
  const onInvite = async () => {
    if (!session) { nav.navigate('Account'); return; } // 招待にはログイン(=安定したuserId)が必要
    const u = session.user.id;
    const n = encodeURIComponent(meState.settings.nickname ?? '');
    const url = `https://jinkato2020.github.io/safa-JLPT/invite/?u=${u}&n=${n}`;
    try {
      await Share.share({ message: `いっしょに日本語を学ぼう！わたしの町に遊びにきてね🏘️\n${url}` });
    } catch { /* 共有シートを閉じただけ等は無視 */ }
  };

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
          for (const vl of residentsRef.current) { const p = npcPos[vl.id]; if (!p) continue; const d = Math.hypot(fx - (p.x + SPRITE / 2), fy - (p.y + SPRITE * 0.82)); if (d < best) { best = d; near = vl; thresh = 26; rearm = 52; } }
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
          {/* ベンチ付近の仮想学習者(動かない)。立ちと同じ現行スプライトを SPRITE サイズで表示＋名前/Lv名札。 */}
          {SITTERS.map((si, i) => {
            const SET = AVATAR_SETS[si.v.avatar] || HERO;
            const left = si.x + si.w / 2 - SPRITE / 2;        // ベンチ位置の中心にそろえる
            const top = si.y + si.h - SPRITE;                 // 足元を元のベンチ座面下端にそろえる=立ちと同じ大きさ
            return (
              <View key={i} style={{ position: 'absolute', left, top, width: SPRITE, alignItems: 'center' }} pointerEvents="none">
                <View style={s.npcTag}><Text style={s.npcTagT} numberOfLines={1}>{si.v.nick} · {si.v.level}</Text></View>
                <Image source={SET.down[0]} style={{ width: SPRITE, height: SPRITE }} resizeMode="contain" />
              </View>
            );
          })}
          {/* 中: 学習者(NPC)＝仮想学習者＋実在の友だち */}
          {residents.map((v) => <NpcSprite key={v.id} v={v} sink={npcPos} />)}
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
            <Image key={i} source={isDay ? rf.day : rf.night} style={{ position: 'absolute', left: rf.x, top: isDay ? rf.y : ((rf as { nightY?: number }).nightY ?? rf.y), width: rf.w, height: rf.h }} resizeMode="stretch" />
          ))}
        </Animated.View>
      </View>

      {/* 上部バー */}
      <SafeAreaView edges={['top']} style={s.top} pointerEvents="box-none">
        <View style={s.topBar} pointerEvents="box-none">
          <View style={s.pill}><Text style={s.pillT}>日本語学習者の町</Text></View>
          <Pressable onPress={() => nav.goBack()} hitSlop={12} style={s.close}><Ionicons name="close" size={22} color="#3a3128" /></Pressable>
        </View>
        {/* 友だちを町に招待(リンク共有→相手が参加で住人に)＋紹介コード。町=社交の世界観に最も合う入口。 */}
        <View style={s.inviteRow} pointerEvents="box-none">
          <Pressable style={[s.inviteBtn, s.inviteBtnSearch]} onPress={onInvite}>
            <Text style={s.inviteT}>🏘️ 友だちを町に招待</Text>
          </Pressable>
          <Pressable style={s.inviteBtn} onPress={() => nav.navigate('Referral')}>
            <Text style={s.inviteT}>🎁 紹介コード</Text>
          </Pressable>
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

      {/* 仮想学習者との会話(ノベル風・立ち絵フルスクリーン)。町を暗く残し、大きな立ち絵＋名前プレート＋セリフ窓。 */}
      {talk && (() => {
        const SET = AVATAR_SETS[talk.avatar] || HERO;
        const per = personalityOf(talk.personality);
        const mm = moodMsgOf(talk.moodMsg);
        const learned = talk.learned ?? 0;
        const vocabPct = Math.max(8, Math.min(100, Math.round((learned / 2000) * 100)));
        const streakPct = Math.max(8, Math.min(100, Math.round(((talk.streak ?? 0) / 60) * 100)));
        const scene = SCENES[talkScene][isDay ? 'day' : 'night'];
        // ダイアログ(全幅・下寄せ)＋立ち絵は背景の右に乗せる。
        const dlgH = Math.round(VW * 385 / 960);
        const avH = Math.min(Math.round(VH * 0.44), Math.round(VW * 0.95));
        // 台詞ページ(各ページ最大3行程度)。中身のある行だけ2文ずつまとめる。
        const lines: string[] = [`やあ、${talk.nick}だよ！`];
        if (talk.studying) lines.push(`いまは「${talk.studying}」を特訓中。`);
        if (talk.weekLearned) lines.push(`この7日で${talk.weekLearned}語おぼえたよ。`);
        lines.push(personaLineOf(talk.personality));
        const pages: string[] = [];
        for (let i = 0; i < lines.length; i += 2) pages.push(lines.slice(i, i + 2).join('\n'));
        const page = Math.min(talkPage, pages.length - 1);
        const onNext = () => { if (page < pages.length - 1) setTalkPage(page + 1); else setTalkStep('status'); };
        const nextY = nextPulse.interpolate({ inputRange: [0, 1], outputRange: [0, 4] });
        const nextOp = nextPulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
        return (
          <View style={s.cvWrap}>
            {/* 背景=会話シーン(全画面)。学習者ごとに固定・昼夜で切替。 */}
            <Image source={scene} style={StyleSheet.absoluteFill} resizeMode="cover" />
            <View style={s.cvVignette} pointerEvents="none" />
            {/* ステータス/メッセージ画面は文字量が多いので少し暗くして読みやすく */}
            {talkStep !== 'info' && <View style={s.cvDim} pointerEvents="none" />}
            <Pressable style={StyleSheet.absoluteFill} onPress={closeTalk} />
            <Pressable onPress={closeTalk} hitSlop={10} style={s.nvClose}><Ionicons name="close" size={26} color="#ffffff" /></Pressable>

            {talkStep === 'info' && (
              <>
                {/* 立ち絵=背景の右に乗せる(足元はダイアログ上端あたり)。 */}
                <View style={[s.cvAvatarR, { right: Math.round(VW * 0.02), bottom: dlgH + 4, width: avH, height: avH }]} pointerEvents="none">
                  <Image source={SET.down[0]} style={{ width: avH, height: avH }} resizeMode="contain" />
                </View>
                {/* 台詞=装飾ダイアログボックス(全幅・白文字・名前は上枠・▼は内蔵＋発光重ね)。 */}
                <Pressable style={[s.cvDlg, { height: dlgH }]} onPress={onNext}>
                  <Image source={DIALOGBOX} style={StyleSheet.absoluteFill} resizeMode="stretch" />
                  <Text style={[s.cvDlgName, { top: dlgH * 0.05, width: '34%' }]} numberOfLines={1}>{talk.flag} {talk.nick}</Text>
                  <Text style={[s.cvDlgSay, { top: dlgH * 0.29 }]} numberOfLines={3}>{pages[page]}</Text>
                  {pages.length > 1 && <Text style={[s.cvDlgDots, { bottom: dlgH * 0.12 }]}>{page + 1}/{pages.length}</Text>}
                  <Animated.Text style={[s.cvDlgNext, { bottom: dlgH * 0.08, opacity: nextOp, transform: [{ translateY: nextY }] }]}>▼</Animated.Text>
                </Pressable>
              </>
            )}

            {talkStep === 'status' && (() => {
              // 装飾枠(1000x740)にラベル(枠上・金)＋値(枠内中央・白)＋バー(枠背後=透過窓に透ける)＋数字を動的に重ねる。
              const FW = Math.min(VW, Math.round(VH * 0.72 / 0.74)); // 横幅=iPhone全幅(高さで頭打ちのみ)
              const FH = Math.round(FW * 0.74);
              const fs = (x: number) => Math.round(FW * x);
              const box = (cx: number, y: number, h: number, w = 0.42) => ({ position: 'absolute' as const, left: cx * FW - (w * FW) / 2, top: y * FH - h / 2, width: w * FW, height: h, alignItems: 'center' as const, justifyContent: 'center' as const });
              const FIELDS = [
                { lab: 'ニックネーム', val: talk.nick, cx: 0.272, ly: 0.118, vy: 0.180 },
                { lab: 'Lv', val: String(talk.level), cx: 0.725, ly: 0.118, vy: 0.180 },
                { lab: '国名', val: talk.flag ?? '-', cx: 0.272, ly: 0.276, vy: 0.338 },
                { lab: '得意', val: talk.strong ?? '-', cx: 0.725, ly: 0.276, vy: 0.338 },
                { lab: '性格', val: per ? per.label : '-', cx: 0.272, ly: 0.435, vy: 0.497 },
                { lab: '気分', val: mm ?? '-', cx: 0.725, ly: 0.435, vy: 0.497 },
              ];
              return (
                <View style={s.cvStatusWrap} pointerEvents="box-none">
                  <View style={{ width: FW, height: FH, alignSelf: 'center' }}>
                    {/* バー(枠の背後=透過窓に透ける) */}
                    <View style={[s.sBarTrack, { left: 0.293 * FW, width: 0.483 * FW, top: 0.630 * FH, height: 0.040 * FH }]}>
                      <View style={[s.sBarFill, { width: (`${vocabPct}%` as `${number}%`), backgroundColor: '#37cc74' }]} />
                      <View style={s.sBarGloss} pointerEvents="none" />
                    </View>
                    <View style={[s.sBarTrack, { left: 0.293 * FW, width: 0.482 * FW, top: 0.761 * FH, height: 0.039 * FH }]}>
                      <View style={[s.sBarFill, { width: (`${streakPct}%` as `${number}%`), backgroundColor: '#4aa3ff' }]} />
                      <View style={s.sBarGloss} pointerEvents="none" />
                    </View>
                    {/* 装飾枠 */}
                    <Image source={STATUSFRAME} style={{ position: 'absolute', left: 0, top: 0, width: FW, height: FH }} resizeMode="stretch" />
                    {/* 上段6項目: ラベル(枠上・金)＋値(枠内中央・白) */}
                    {FIELDS.map((f, i) => (
                      <View key={i} pointerEvents="none">
                        <View style={box(f.cx, f.ly, fs(0.05))}><Text style={[s.sLabel, { fontSize: fs(0.030) }]} numberOfLines={1}>{f.lab}</Text></View>
                        <View style={box(f.cx, f.vy, fs(0.06))}><Text style={[s.sVal, { fontSize: fs(0.040) }]} numberOfLines={1}>{f.val}</Text></View>
                      </View>
                    ))}
                    {/* 下段ラベル＋数字 */}
                    <View style={box(0.158, 0.650, fs(0.06), 0.26)} pointerEvents="none"><Text style={[s.sVal, { fontSize: fs(0.032) }]} numberOfLines={1}>覚えた単語</Text></View>
                    <View style={box(0.158, 0.780, fs(0.06), 0.26)} pointerEvents="none"><Text style={[s.sVal, { fontSize: fs(0.032) }]} numberOfLines={1}>連続日数</Text></View>
                    <View style={box(0.860, 0.653, fs(0.06), 0.14)} pointerEvents="none"><Text style={[s.sVal, { fontSize: fs(0.036) }]} numberOfLines={1}>{learned}</Text></View>
                    <View style={box(0.860, 0.782, fs(0.06), 0.14)} pointerEvents="none"><Text style={[s.sVal, { fontSize: fs(0.036) }]} numberOfLines={1}>{talk.streak}</Text></View>
                  </View>

                  <View style={[s.nvSendWrap, { marginTop: 14 }]}>
                    <Pressable style={s.nvSendBtn} onPress={() => setTalkStep('message')}>
                      <Text style={s.nvSendT}>✉️ メッセージを送る</Text>
                    </Pressable>
                  </View>
                  <Pressable style={s.nvBack} onPress={() => { setTalkStep('info'); setTalkPage(0); }}><Text style={s.nvBackT}>‹ 会話にもどる</Text></Pressable>
                </View>
              );
            })()}

            {talkStep === 'message' && (
              <View style={s.cvStatusWrap} pointerEvents="box-none">
                <View style={s.nvBox}>
                  {sent ? (
                    <View style={s.sentBox}>
                      <Text style={s.sentEmoji}>{sent.emoji}</Text>
                      <Text style={s.sentT}>応援を送りました！</Text>
                      <Text style={s.sentReply}>{talk.nick}「{sent.reply}」</Text>
                    </View>
                  ) : (
                    <>
                      <Text style={s.nvMsgTitle}>{talk.nick}にメッセージを送る</Text>
                      <View style={s.nvPills}>
                        {CHEERS.map((c) => (
                          <Pressable key={c.key} style={s.nvPill} onPress={() => sendCheer(c)}>
                            <Text style={s.nvPillT} numberOfLines={1}>{c.emoji} {c.label}</Text>
                          </Pressable>
                        ))}
                      </View>
                      <Pressable style={s.nvBack} onPress={() => setTalkStep('status')}><Text style={s.nvBackT}>‹ 戻る</Text></Pressable>
                    </>
                  )}
                </View>
              </View>
            )}
          </View>
        );
      })()}

      {/* 桜の会話(ノベル風・立ち絵フルスクリーン)。学習者と同じ演出=全画面ランダム背景＋桜の立ち絵＋ダイアログボックス。 */}
      {sakuraTalk && (() => {
        const scene = SCENES[talkScene][isDay ? 'day' : 'night'];
        const dlgH = Math.round(VW * 385 / 960);
        const avH = Math.min(Math.round(VH * 0.44), Math.round(VW * 0.95));
        const pages = sakuraLines.length ? sakuraLines : ['また会えたね🌸'];
        const page = Math.min(sakuraPage, pages.length - 1);
        const onNext = () => { if (page < pages.length - 1) setSakuraPage(page + 1); else closeSakura(); };
        const nextY = nextPulse.interpolate({ inputRange: [0, 1], outputRange: [0, 4] });
        const nextOp = nextPulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
        return (
          <View style={s.cvWrap}>
            {/* 背景=会話シーン(全画面)。会話ごとにランダム・昼夜で切替。 */}
            <Image source={scene} style={StyleSheet.absoluteFill} resizeMode="cover" />
            <View style={s.cvVignette} pointerEvents="none" />
            <Pressable style={StyleSheet.absoluteFill} onPress={closeSakura} />
            <Pressable onPress={closeSakura} hitSlop={10} style={s.nvClose}><Ionicons name="close" size={26} color="#ffffff" /></Pressable>
            {/* 桜の立ち絵=背景の右に乗せる(足元はダイアログ上端あたり)。 */}
            <View style={[s.cvAvatarR, { right: Math.round(VW * 0.02), bottom: dlgH + 4, width: avH, height: avH }]} pointerEvents="none">
              <Image source={SAKURA.down[0]} style={{ width: avH, height: avH }} resizeMode="contain" />
            </View>
            {/* 台詞=装飾ダイアログボックス(全幅・白文字・名前は上枠・▼発光)。 */}
            <Pressable style={[s.cvDlg, { height: dlgH }]} onPress={onNext}>
              <Image source={DIALOGBOX} style={StyleSheet.absoluteFill} resizeMode="stretch" />
              <Text style={[s.cvDlgName, { top: dlgH * 0.05, width: '34%' }]} numberOfLines={1}>🌸 桜</Text>
              <Text style={[s.cvDlgSay, { top: dlgH * 0.29 }]} numberOfLines={3}>{pages[page]}</Text>
              {pages.length > 1 && <Text style={[s.cvDlgDots, { bottom: dlgH * 0.12 }]}>{page + 1}/{pages.length}</Text>}
              <Animated.Text style={[s.cvDlgNext, { bottom: dlgH * 0.08, opacity: nextOp, transform: [{ translateY: nextY }] }]}>▼</Animated.Text>
            </Pressable>
          </View>
        );
      })()}
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
  inviteRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, marginTop: 4, alignItems: 'flex-start' },
  inviteBtnSearch: { backgroundColor: '#3f7bd6' },
  inviteBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e2588f', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 15, borderWidth: 2, borderColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  inviteT: { color: '#ffffff', fontWeight: '900', fontSize: 13, letterSpacing: 0.3 },
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
  // 会話シーン(背景イラスト＋立ち絵左＋台詞パネル右)
  cvWrap: { ...StyleSheet.absoluteFillObject, zIndex: 20 },
  cvVignette: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,8,20,0.16)' }, // 全体を少しだけ落として立ち絵と文字を締める
  cvDim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,8,20,0.5)' }, // ステータス/送信時だけ濃くして読みやすく
  cvAvatar: { position: 'absolute', left: 0, bottom: 0, alignItems: 'center', justifyContent: 'flex-end', zIndex: 1 },
  // 台詞パネル=右側。背景はSvgの縦グラデ(上端フェード)で描く。ここは枠と余白だけ。
  cvPanel: { position: 'absolute', right: 12, bottom: 30, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16, borderRadius: 14, zIndex: 3, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  cvNamePlate: { position: 'absolute', top: -12, left: 14, backgroundColor: '#101740', borderRadius: 7, borderWidth: 1.5, borderColor: '#ffd76b', paddingHorizontal: 11, paddingVertical: 4, zIndex: 2 },
  cvNameT: { color: '#ffd76b', fontWeight: '900', fontSize: 13.5, letterSpacing: 0.3 },
  cvText: { color: '#ffffff', fontSize: 15.5, lineHeight: 25, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
  cvNextRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 8, height: 16 },
  cvPageDots: { color: '#b9c6f2', fontSize: 11, fontWeight: '800' },
  cvNext: { color: '#ffe08a', fontSize: 16, fontWeight: '900', textShadowColor: 'rgba(255,196,60,0.9)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 0 } },
  // ステータス/送信カードを画面中央に置く器(舞台の上に重ねる)
  cvStatusWrap: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', zIndex: 4 },
  // A案: 立ち絵=背景の右 / 台詞=全幅の装飾ダイアログ(白文字)
  cvAvatarR: { position: 'absolute', alignItems: 'center', justifyContent: 'flex-end', zIndex: 2 },
  cvDlg: { position: 'absolute', left: 0, right: 0, bottom: 18, zIndex: 3 },
  cvDlgName: { position: 'absolute', left: '2%', textAlign: 'center', color: '#ffffff', fontWeight: '900', fontSize: 14, letterSpacing: 0.3, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 2, textShadowOffset: { width: 0, height: 1 } },
  cvDlgSay: { position: 'absolute', left: '7%', right: '8%', color: '#ffffff', fontSize: 15, lineHeight: 23, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.75)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
  cvDlgDots: { position: 'absolute', right: '13%', color: '#b9c6f2', fontSize: 11, fontWeight: '800' },
  cvDlgNext: { position: 'absolute', right: '5%', color: '#ffe08a', fontSize: 15, fontWeight: '900', textShadowColor: 'rgba(255,196,60,0.9)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 0 } },
  // 装飾枠に重ねる動的レイヤー(バー=枠背後の透過窓に透ける / ラベル=金 / 値=白)
  sBarTrack: { position: 'absolute', borderRadius: 6, backgroundColor: '#0a0f30', overflow: 'hidden', justifyContent: 'center' },
  sBarFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 6 },
  sBarGloss: { position: 'absolute', left: 0, right: 0, top: 0, height: '42%', backgroundColor: 'rgba(255,255,255,0.16)' },
  sLabel: { color: '#ffd76b', fontWeight: '800', letterSpacing: 0.3, textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 2, textShadowOffset: { width: 0, height: 1 } },
  sVal: { color: '#ffffff', fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 2, textShadowOffset: { width: 0, height: 1 } },
  // ノベル風の会話(立ち絵フルスクリーン)
  nvWrap: { ...StyleSheet.absoluteFillObject, zIndex: 20 },
  nvScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,8,20,0.66)' },
  nvClose: { position: 'absolute', top: 46, right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.38)', alignItems: 'center', justifyContent: 'center', zIndex: 6 },
  nvStage: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', paddingBottom: 28 },
  nvStandWrap: { alignItems: 'center', marginBottom: -6, zIndex: 1 },
  nvPlate: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginLeft: 16, marginBottom: 8, backgroundColor: '#0c1d49', borderWidth: 2, borderColor: '#ffffff', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 5, zIndex: 3 },
  nvName: { color: '#ffffff', fontWeight: '900', fontSize: 16, letterSpacing: 0.3 },
  nvMoodMsg: { alignSelf: 'flex-start', marginLeft: 22, marginBottom: 6, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 13, paddingHorizontal: 12, paddingVertical: 5 },
  nvMoodMsgT: { color: '#1b2440', fontWeight: '800', fontSize: 12.5 },
  nvPersona: { color: '#ffd76b', fontWeight: '800', fontSize: 12, marginLeft: 2 },
  nvBox: { marginHorizontal: 12, backgroundColor: '#0b1230', borderWidth: 3, borderColor: '#ffffff', borderRadius: 14, padding: 14, zIndex: 3 },
  nvText: { color: '#eef2ff', fontSize: 15, lineHeight: 25, fontWeight: '600' },
  // RPG風フレーム(青メタルの立体枠)。台詞・ステータス共通の意匠。
  // ベベル=左上を明色/右下を暗色にして"盛り上がった金属パネル"に見せる(グラデ不要)。
  rpgCard: { marginHorizontal: 12, marginBottom: 8, zIndex: 3, backgroundColor: '#20295c', borderRadius: 10, borderWidth: 2, borderTopColor: '#8496e0', borderLeftColor: '#8496e0', borderBottomColor: '#0a0f2e', borderRightColor: '#0a0f2e', padding: 11, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  // 台詞の名前プレート(金文字)
  rpgNamePlate: { alignSelf: 'flex-start', backgroundColor: '#101740', borderRadius: 6, borderWidth: 1, borderColor: '#4a5aa8', paddingHorizontal: 10, paddingVertical: 3, marginBottom: 8 },
  rpgNameT: { color: '#ffd76b', fontWeight: '900', fontSize: 14, letterSpacing: 0.3 },
  // ステータス上段: 顔+名前+職業(性格)+Lv
  rpgTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  rpgPortrait: { width: 66, height: 66, borderRadius: 8, backgroundColor: '#0c1236', borderWidth: 2, borderTopColor: '#0a0f2e', borderLeftColor: '#0a0f2e', borderBottomColor: '#8496e0', borderRightColor: '#8496e0', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginRight: 12 },
  rpgFace: { width: 62, height: 62 },
  rpgMeta: { flex: 1 },
  rpgName: { color: '#ffd76b', fontWeight: '900', fontSize: 17, letterSpacing: 0.3 },
  rpgLvRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 5 },
  rpgLvLabel: { color: '#9fb0ec', fontWeight: '900', fontSize: 12, marginRight: 5 },
  rpgLvVal: { color: '#ffffff', fontWeight: '900', fontSize: 18, letterSpacing: 0.5 },
  // HP/SP風バー
  rpgBar: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  rpgBarKey: { width: 66, color: '#9fb0ec', fontSize: 11, fontWeight: '900', letterSpacing: 0.3 },
  rpgTrack: { flex: 1, height: 17, borderRadius: 5, backgroundColor: '#0a0f30', borderWidth: 1, borderColor: '#05081f', overflow: 'hidden', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 7 },
  rpgFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 4 },
  rpgGloss: { position: 'absolute', left: 0, right: 0, top: 0, height: 7, backgroundColor: 'rgba(255,255,255,0.22)' },
  rpgBarVal: { color: '#ffffff', fontSize: 10.5, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 2, textShadowOffset: { width: 0, height: 1 } },
  // 下段の「ラベル：値」行(性格/得意分野/気分)。アイコンは付けない(ユーザー指定)。
  rpgNext: { marginTop: 9, borderTopWidth: 1, borderTopColor: '#3a4790', paddingTop: 8, gap: 5 },
  rpgKvRow: { flexDirection: 'row', alignItems: 'baseline' },
  rpgKvK: { width: 72, color: '#9fb0ec', fontSize: 12, fontWeight: '800' },
  rpgKvV: { flex: 1, color: '#ffffff', fontSize: 13, fontWeight: '800' },
  nvSendWrap: { marginHorizontal: 12, zIndex: 3 },
  nvSendBtn: { backgroundColor: '#e2588f', borderRadius: 999, borderWidth: 2, borderColor: '#ffffff', paddingVertical: 13, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  nvSendT: { color: '#ffffff', fontWeight: '900', fontSize: 15, letterSpacing: 0.5 },
  nvMsgTitle: { color: '#ffffff', fontWeight: '900', fontSize: 15, marginBottom: 10, textAlign: 'center' },
  nvBack: { alignSelf: 'center', marginTop: 12, paddingVertical: 6, paddingHorizontal: 16 },
  nvBackT: { color: '#9fb0ec', fontWeight: '800', fontSize: 14 },
  nvEm: { color: '#ffd76b', fontWeight: '900' },
  nvChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  nvChip: { backgroundColor: '#182357', borderWidth: 1, borderColor: '#3c4c96', borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3 },
  nvChipT: { color: '#eef2ff', fontSize: 11.5, fontWeight: '800' },
  nvChipEm: { color: '#ffd76b', fontWeight: '900' },
  nvPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  nvPill: { backgroundColor: '#172054', borderWidth: 1.5, borderColor: '#5566b0', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9 },
  nvPillT: { color: '#ffffff', fontWeight: '800', fontSize: 12.5 },
});
