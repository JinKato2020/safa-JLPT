// おさんぽ(散歩マップ)。実マップ画像(昼/夜)＋自分のアバターをバーチャルスティックで8方向移動＋当たり判定＋カメラ追従。
//  ・操作=アナログスティック。入力角を45度刻みで丸め、移動は縦横斜めの8方向だけ。向きも8方向の絵に対応。
//  ・当たり判定=src/plaza/mapCollision.ts(色解析で自動生成した MAP_G×MAP_G。'.'歩ける/'#'止まる)。X/Yを別々に判定=壁ずり移動。
//  ・描画: マップ画像1枚＋プレイヤー。移動は transform を毎フレーム setValue(再描画なし=軽い)。向き変化時だけ画像差し替え。
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Image, Animated, Pressable, PanResponder, ScrollView, StyleSheet, useWindowDimensions, Share, Modal, TextInput, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// 絵文字/アイコン除去(気分などデータに含まれる絵文字を会話表示から外す)。国旗(talk.flag)は別扱いなので影響なし。
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{2190}-\u{21FF}]/gu;
const stripIcons = (s: string | null | undefined) => (s ?? '').replace(EMOJI_RE, '').trim();
import { useNavigation, CommonActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { MAP_G, MAP_WALK } from '../plaza/mapCollision';
import { useAppState } from '../store/store';
import type { RootStackParamList } from '../navigation/types';
import { VIRTUAL_LEARNERS, type VirtualLearner } from '../plaza/virtualLearners';
import { personalityOf, moodMsgOf, personaLineOf } from '../plaza/persona';
import { useSync } from '../auth/SyncProvider';
import { friendPublish, townMembers, cheerSend, townKick, type FriendProfile } from '../plaza/friendsClient';
import { friendToLearner } from '../plaza/friendResidents';
import { flagOf } from '../plaza/countries';
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
  town: { day: require('../../assets/kotoba/scene/town_day.jpg'), night: require('../../assets/kotoba/scene/town_night.jpg') },
  tree: { day: require('../../assets/kotoba/scene/tree_day.jpg'), night: require('../../assets/kotoba/scene/tree_night.jpg') },
  pond: { day: require('../../assets/kotoba/scene/pond_day.jpg'), night: require('../../assets/kotoba/scene/pond_night.jpg') },
};
const SCENE_KEYS = ['town', 'tree', 'pond'];
// 台詞の装飾ダイアログボックス(左上プレート＋右下▼が内蔵)。桜の会話で使用。全幅・白文字で名前/台詞を重ねる。
// 会話+ステータス一体フレーム(上=台詞窓/下=ステータス6枠+バー2行)。ダーク/ライトは同一ジオメトリ(座標表CSは共通)。テーマで切替。
// 会話ダイアログ(台詞窓)=昼ライト/夜ダーク・ステータス枠=クリーム1種。3段構成(背景→ダイアログ→ステータス)。
const DLG_LIGHT = require('../../assets/kotoba/ui/dlg_light.png');
const DLG_DARK = require('../../assets/kotoba/ui/dlg_dark.png');
const STATUSBOX = require('../../assets/kotoba/ui/statusbox.png');
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
  { key: 'ganbaro', emoji: '📖', label: '今日も勉強、一緒に頑張ろう！', reply: '' },
  { key: 'homeru', emoji: '🎉', label: '沢山勉強しているね。凄い！', reply: '' },
];

// 当たり判定(足元がマップの'.'か)。プレイヤー・NPC共通。座標=スプライト左上。
function walkable(px: number, py: number): boolean {
  const fx = px + SPRITE / 2, fy = py + SPRITE * 0.82;
  const c = Math.floor(fx / CELL), r = Math.floor(fy / CELL);
  if (r < 0 || r >= MAP_G || c < 0 || c >= MAP_G) return false;
  return MAP_WALK[r][c] === '.';
}

// セル列(優先順)から、マンハッタン距離 gap 以上を空けて count 個選ぶ(くっつけない散らし)。
function pickSpaced(cells: readonly { col: number; row: number }[], count: number, gap: number): { col: number; row: number }[] {
  const out: { col: number; row: number }[] = [];
  for (const c of cells) {
    if (out.length >= count) break;
    if (out.every((o) => Math.abs(o.col - c.col) + Math.abs(o.row - c.row) >= gap)) out.push({ col: c.col, row: c.row });
  }
  return out;
}

// 1体のNPC: home周辺(半径約2.4マス)をゆっくり8方向で歩き回る。見た目は町のアバター6種(プレイヤーと同じ歩行アニメ)。
// 頭上に国旗+名前+レベルの名札。表示専用。sink: 親が近接判定に使う現在位置の共有先(参照共有=毎フレーム最新)。
function NpcSprite({ v, sink, animSink }: { v: VirtualLearner; sink: Record<string, { x: number; y: number }>; animSink: Record<string, Animated.ValueXY> }) {
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
    animSink[v.id] = anim; // 名札を前面レイヤより上に描くため、現在アニメ位置を共有
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
    return () => { cancelAnimationFrame(raf); delete sink[v.id]; delete animSink[v.id]; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const by = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });
  return (
    <Animated.View style={{ position: 'absolute', width: SPRITE, alignItems: 'center', transform: [{ translateX: anim.x }, { translateY: anim.y }] }} pointerEvents="none">
      {/* 名札(名前・Lv)は前面レイヤより上へ別描画するのでここには置かない(裏に隠れても位置が分かる) */}
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
  const stickSide = { alignSelf: 'center' as const }; // 操作カーソルは画面下部の中央に固定(左右設定は廃止)
  const streakCur = useAppState().streak?.current ?? 0; // 桜のほめ言葉に使う連続日数
  // 友だち(段階2): ログイン中は自分を公開＋友だちを町の住人として取り込む。
  const meState = useAppState();
  const { session } = useSync();
  const [friends, setFriends] = useState<VirtualLearner[]>([]);
  const [members, setMembers] = useState<FriendProfile[]>([]); // 町の住人(招待して参加した友だち)。見出しタップの一覧＝メッセージ可能な相手。
  const [membersOpen, setMembersOpen] = useState(false);
  // 木(前面レイヤー)の裏に隠れるセル群=仮想学習者の初期配置から除外する領域。
  const treeCellSet = useMemo(() => {
    const s = new Set<string>();
    const c0 = Math.floor(TREE.x / CELL), c1 = Math.floor((TREE.x + TREE.w) / CELL);
    const r0 = Math.floor(TREE.y / CELL), r1 = Math.floor((TREE.y + TREE.h) / CELL);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) s.add(`${c},${r}`);
    return s;
  }, []);
  // 出現プール=木の下を中心とした半径内の歩けるマス(木の裏・遠い隅は除外)。ユーザー(START)に近い順に並べる。
  //  NPC・友だちは同じこのプールから配置。合計 = ベンチ4 + (歩行NPC + 友だち)=最大8 = 12。友だちはユーザー付近を優先。
  const pool = useMemo(() => {
    const CX = 22, CY = 24, RMAX = 18;
    const cells: { col: number; row: number; du: number }[] = [];
    for (let r = 5; r < MAP_G - 5; r++) for (let c = 4; c < MAP_G - 4; c++) {
      if (MAP_WALK[r]?.[c] !== '.' || treeCellSet.has(`${c},${r}`)) continue;
      if ((c - CX) * (c - CX) + (r - CY) * (r - CY) > RMAX * RMAX) continue;
      if (Math.abs(c - START_COL) <= 1 && Math.abs(r - START_ROW) <= 1) continue; // ユーザーの初期マス周辺は空ける
      cells.push({ col: c, row: r, du: Math.hypot(c - START_COL, r - START_ROW) });
    }
    cells.sort((a, b) => a.du - b.du); // ユーザーに近い順
    return cells;
  }, [treeCellSet]);
  const MAX_WALK = 8; // 歩行NPC+友だちの合計上限(ベンチ4と足して12)。
  // 友だち=ユーザー付近の近いマスから優先的に(2マス間隔で自然に)。
  const friendCells = useMemo(() => pickSpaced(pool, Math.min(friends.length, MAX_WALK), 2), [pool, friends.length]);
  // 歩行NPC=友だちが取らなかった残り(ユーザーから遠い側)を散らす。友だちが多いほどNPCは減る(合計8)。
  const scattered = useMemo(() => {
    const F = Math.min(friends.length, MAX_WALK);
    const fset = new Set(friendCells.map((c) => `${c.col},${c.row}`));
    const rest = pool.filter((c) => !fset.has(`${c.col},${c.row}`)).slice().reverse(); // ユーザーから遠い順
    const spots = pickSpaced(rest, Math.max(0, MAX_WALK - F), 3);
    return VIRTUAL_LEARNERS.slice(0, spots.length).map((v, i) => ({ ...v, home: spots[i] }));
  }, [pool, friendCells, friends.length]);
  const residents = useMemo(() => [...scattered, ...friends], [scattered, friends]); // 歩行NPC(散布)＋友だち(ユーザー付近)
  const residentsRef = useRef<VirtualLearner[]>(scattered);
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
  const npcAnim = useRef<Record<string, Animated.ValueXY>>({}).current; // 各NPCのアニメ位置(名札を前面レイヤより上に描くため共有)
  const [, setPlateTick] = useState(0); // NpcSprite登録後に名札パスを1度描き直すためのトリガ
  useEffect(() => { const t = setTimeout(() => setPlateTick((x) => x + 1), 60); return () => clearTimeout(t); }, [residents]);
  const [talk, setTalk] = useState<VirtualLearner | null>(null);
  const [sent, setSent] = useState<{ emoji: string; reply: string } | null>(null);
  const [talkStep, setTalkStep] = useState<'info' | 'status' | 'message'>('info'); // info=台詞(舞台) / status=ステータス / message=メッセージ送信
  const [talkPage, setTalkPage] = useState(0); // 台詞のページ送り(▼で進む)
  const [talkDlgDone, setTalkDlgDone] = useState(false); // 台詞を最後まで読んだ→会話ダイアログを消す
  const [talkScene, setTalkScene] = useState<string>('town'); // 会話ごとにランダムで選ぶ背景シーン
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
  const openTalk = (v: VirtualLearner) => { talkRef.current = v; setSent(null); setTalkStep('info'); setTalkPage(0); setTalkDlgDone(false); setTalkScene(SCENE_KEYS[Math.floor(Math.random() * SCENE_KEYS.length)]); setTalk(v); };
  const closeTalk = () => { if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; } talkRef.current = null; setTalk(null); setSent(null); setTalkStep('info'); };
  // 応援メッセージ画面(定型＋自由文)。相手の id は 'friend:<userId>'。
  const [msgOpen, setMsgOpen] = useState(false);   // 応援メッセージ画面の開閉
  const [msgText, setMsgText] = useState('');        // 自由メッセージ入力
  const openMsg = () => { setSent(null); setMsgText(''); setMsgOpen(true); };
  const afterSend = () => { // 送信後: 少し「届けました」を見せてから画面を閉じる。
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => { setMsgOpen(false); setSent(null); }, 1400);
  };
  const sendCheer = (c: { key: string; emoji: string; reply: string }) => {
    const id = talkRef.current?.id ?? '';
    const fid = id.startsWith('friend:') ? id.slice('friend:'.length) : null;
    if (fid) cheerSend(fid, c.key); // サーバー配信(結果は待たない)。相手は受信箱で受け取る。
    setSent({ emoji: c.emoji, reply: '' });
    afterSend();
  };
  const sendCheerText = () => {
    const id = talkRef.current?.id ?? '';
    const fid = id.startsWith('friend:') ? id.slice('friend:'.length) : null;
    const text = msgText.trim();
    if (!text) return;
    if (fid) cheerSend(fid, 'custom', text); // 自由メッセージ(80字までサーバー側で切る)
    setMsgText('');
    setSent({ emoji: '💬', reply: '' });
    afterSend();
  };
  // 荒らし対策: 「日本語学習者の町」の一覧から相手を削除(town_kick)。以後その人はメッセージを送れない。
  const kickMember = (m: FriendProfile) => {
    Alert.alert('町から削除', `${m.nickname}さんを町から削除しますか？\n削除すると、この人はあなたにメッセージを送れなくなります。`, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => {
        void townKick(m.user_id);
        setMembers((ms) => ms.filter((x) => x.user_id !== m.user_id));       // 一覧から即消す
        setFriends((fs) => fs.filter((f) => f.id !== 'friend:' + m.user_id)); // 町の住人からも消す
      } },
    ]);
  };
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);
  // 受信箱(友だちからの応援)は共通ヘッダー(設定の左の鐘)へ移設した。

  // 友だち: ログイン中なら自分を公開(検索対象＋友だちの町に出る)し、友だち一覧を町の住人へ変換して置く。
  useEffect(() => {
    if (!session) { setFriends([]); setMembers([]); return; }
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
      setMembers(list); // 見出しタップの「町の友だち」一覧に使う(全員)。

      // 紹介した友だち=ユーザー付近の近いマスへ優先配置(NPCと同じプール・2マス間隔)。合計上限=MAX_WALK(8)。
      const homes = pickSpaced(pool, Math.min(list.length, MAX_WALK), 2);
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
    const text = 'いっしょに日本語を学ぼう！わたしの町に遊びにきてね🏘️';
    try {
      // iOS: url を独立フィールドで渡す→共有シートがリンク扱いになり、招待ページのog:image(アプリアイコン)がプレビューに出る。
      //      (URLを本文に混ぜると"テキスト"扱いで汎用アイコン(あI)になる)。Android: url は無視されるので本文にURLを含める。
      if (Platform.OS === 'ios') await Share.share({ message: text, url });
      else await Share.share({ message: `${text}\n${url}` });
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
                {/* 名札(名前・Lv)は前面レイヤより上へ別描画する(木/屋根の裏に隠れても消えないように) */}
                <Image source={SET.down[0]} style={{ width: SPRITE, height: SPRITE }} resizeMode="contain" />
              </View>
            );
          })}
          {/* 中: 学習者(NPC)＝仮想学習者＋実在の友だち */}
          {residents.map((v) => <NpcSprite key={v.id} v={v} sink={npcPos} animSink={npcAnim} />)}
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
          {/* 最前面: 名前・Lvの名札は前面レイヤ(木/屋根)より上に描く=裏に隠れても位置が分かる。 */}
          {/* 座りキャラ(ベンチ)の名札。動かないので固定座標で。 */}
          {SITTERS.map((si, i) => {
            const left = si.x + si.w / 2 - SPRITE / 2;
            const top = si.y + si.h - SPRITE;
            return (
              <View key={'splate:' + i} pointerEvents="none" style={{ position: 'absolute', left, top, width: SPRITE, alignItems: 'center' }}>
                <View style={s.npcTag}><Text style={s.npcTagT} numberOfLines={1}>{si.v.nick} · {si.v.level}</Text></View>
              </View>
            );
          })}
          {/* 立ちキャラ(NPC・友だち)の名札。位置は各NPCのアニメ値に追従。 */}
          {residents.map((v) => {
            const a = npcAnim[v.id];
            if (!a) return null;
            const isFriend = v.id.startsWith('friend:'); // 友だちは名前に☆を付けて区別
            return (
              <Animated.View key={'plate:' + v.id} pointerEvents="none" style={{ position: 'absolute', width: SPRITE, alignItems: 'center', transform: [{ translateX: a.x }, { translateY: a.y }] }}>
                <View style={[s.npcTag, isFriend && s.friendTag]}><Text style={s.npcTagT} numberOfLines={1}>{isFriend ? '☆ ' : ''}{v.nick} · {v.level}</Text></View>
              </Animated.View>
            );
          })}
          {/* 自分の名札(名前・Lv)も前面に。青い名札で「自分」と分かるように。 */}
          <Animated.View pointerEvents="none" style={{ position: 'absolute', width: SPRITE, alignItems: 'center', transform: [{ translateX: playerPos.x }, { translateY: playerPos.y }] }}>
            <View style={[s.npcTag, s.meTag]}><Text style={s.npcTagT} numberOfLines={1}>{(meState.settings.nickname || 'あなた')} · {meState.settings.level}</Text></View>
          </Animated.View>
        </Animated.View>
      </View>

      {/* 上部バー */}
      <SafeAreaView edges={['top']} style={s.top} pointerEvents="box-none">
        <View style={s.topBar} pointerEvents="box-none">
          <View style={s.topLeft} pointerEvents="box-none">
            {/* 見出しタップ=町の友だち一覧(招待して参加した人)。この一覧の相手にはメッセージ(応援)を送れる。 */}
            <Pressable style={s.pill} onPress={() => setMembersOpen(true)}>
              <Text style={s.pillT}>日本語学習者の町</Text>
              <Ionicons name="people" size={13} color="#3a3128" style={{ marginLeft: 5 }} />
            </Pressable>
            {/* 友だちを町に招待(リンク共有→相手が参加で住人に)。白・アイコン無しでタイトル横に。 */}
            <Pressable style={s.inviteWhite} onPress={onInvite}><Text style={s.inviteWhiteT}>友だちを町に招待</Text></Pressable>
          </View>
          <View style={s.topRight} pointerEvents="box-none">
            {/* 受信箱(友だちからの応援)は共通ヘッダー(設定の左の鐘)へ移設。ここには置かない。 */}
            <Pressable onPress={() => nav.goBack()} hitSlop={12} style={s.close}><Ionicons name="close" size={22} color="#3a3128" /></Pressable>
          </View>
        </View>
      </SafeAreaView>

      {/* 町の友だち一覧(見出しタップ)。招待して参加した人＝メッセージ(応援)を送れる相手。行タップで会話を開く。 */}
      <Modal visible={membersOpen} transparent animationType="slide" onRequestClose={() => setMembersOpen(false)}>
        <Pressable style={s.memberBackdrop} onPress={() => setMembersOpen(false)} />
        <View style={s.memberSheet}>
          <View style={s.memberHead}>
            <Text style={s.memberTitle}>町の友だち{members.length > 0 ? `（${members.length}）` : ''}</Text>
            <Pressable onPress={() => setMembersOpen(false)} hitSlop={10}><Ionicons name="close" size={22} color="#3a3128" /></Pressable>
          </View>
          {!session ? (
            <Text style={s.memberEmpty}>ログインすると、招待した友だちがここに表示されます。</Text>
          ) : members.length === 0 ? (
            <Text style={s.memberEmpty}>まだ町に友だちがいません。{'\n'}「友だちを町に招待」から招待しよう。</Text>
          ) : (
            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              {members.map((m) => (
                <View key={m.user_id} style={s.memberRow}>
                  <Pressable style={s.memberTapArea} onPress={() => { setMembersOpen(false); openTalk(friendToLearner(m, { col: 16, row: 16 })); }}>
                    <Text style={s.memberName} numberOfLines={1}>{flagOf(m.country ?? 'XX')} {m.nickname}</Text>
                    <View style={s.memberRight}>
                      <Text style={s.memberMeta}>{m.level}・{Math.max(0, m.streak ?? 0)}日</Text>
                      <View style={s.memberSend}><Ionicons name="chatbubble-ellipses" size={13} color="#fff" /><Text style={s.memberSendT}>応援</Text></View>
                    </View>
                  </Pressable>
                  {/* 荒らし対策: 町から削除(以後この人はメッセージを送れない)。 */}
                  <Pressable onPress={() => kickMember(m)} hitSlop={8} style={s.memberDel}><Ionicons name="trash-outline" size={18} color="#b34a4a" /></Pressable>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* 応援メッセージ画面: 定型(6種)＋自由メッセージ(80字まで)。友だちにだけ送れる。 */}
      <Modal visible={msgOpen} transparent animationType="slide" onRequestClose={() => setMsgOpen(false)}>
        <Pressable style={s.memberBackdrop} onPress={() => setMsgOpen(false)} />
        <View style={s.memberSheet}>
          <View style={s.memberHead}>
            <Text style={s.memberTitle}>✉️ {talk?.nick ?? '友だち'}に応援を送る</Text>
            <Pressable onPress={() => setMsgOpen(false)} hitSlop={10}><Ionicons name="close" size={22} color="#3a3128" /></Pressable>
          </View>
          {sent ? (
            <View style={{ alignItems: 'center', paddingVertical: 28, gap: 8 }}>
              <Text style={{ fontSize: 40 }}>{sent.emoji}</Text>
              <Text style={{ fontSize: 16, fontWeight: '900', color: '#3a3128' }}>応援を届けました！🌸</Text>
            </View>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {/* 定型2種 */}
              <View style={s.msgPills}>
                {CHEERS.map((c) => (
                  <Pressable key={c.key} style={s.msgPill} onPress={() => sendCheer(c)}>
                    <Text style={s.msgPillT} numberOfLines={1}>{c.emoji} {c.label}</Text>
                  </Pressable>
                ))}
              </View>
              {/* 自由メッセージ */}
              <Text style={s.msgLabel}>自由メッセージ（80字まで）</Text>
              <TextInput
                value={msgText}
                onChangeText={setMsgText}
                placeholder="やさしい言葉で応援しよう"
                placeholderTextColor="#a99f8f"
                maxLength={80}
                multiline
                style={s.msgInput}
              />
              <Pressable style={[s.msgSubmit, !msgText.trim() && { opacity: 0.5 }]} disabled={!msgText.trim()} onPress={sendCheerText}>
                <Text style={s.msgSubmitT}>このメッセージを送る</Text>
              </Pressable>
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* 操作(アナログスティック・斜めOK)。会話中は"消さずに"隠して触れなくする(アンマウントすると指を離す前に
          消えてノブが張り付く/入力が残って勝手に進む原因になる)。opacityで隠し、pointerEvents=noneで操作不可にする。 */}
      <SafeAreaView edges={['bottom']} style={s.bottom} pointerEvents="box-none">
        <View style={[s.stickWrap, stickSide, { opacity: (talk || sakuraTalk) ? 0 : 1 }]} pointerEvents={(talk || sakuraTalk) ? 'none' : 'auto'}>
          <View style={s.stickBase} {...pan.panHandlers}>
            <Animated.View style={[s.stickKnob, { transform: [{ translateX: knob.x }, { translateY: knob.y }] }]} />
          </View>
        </View>
      </SafeAreaView>

      {/* 仮想学習者との会話。下=会話+ステータス一体フレーム / 上=会話背景＋立ち絵 / さらに下へスクロールで応援。 */}
      {talk && (() => {
        const SET = AVATAR_SETS[talk.avatar] || HERO;
        const per = personalityOf(talk.personality);
        const mm = stripIcons(moodMsgOf(talk.moodMsg)) || null; // 気分の絵文字アイコンを除去
        const learned = talk.learned ?? 0;
        const scene = SCENES[talkScene][isDay ? 'day' : 'night'];
        const dlgImg = isDay ? DLG_LIGHT : DLG_DARK; // 会話ダイアログ=昼ライト/夜ダーク(実時刻で切替)
        // 3段の縮尺=画面幅(FW)基準。背景=縦長(素材比・全体表示)/ダイアログ=横長(素材比)/ステータス=正方形。
        const INSET = Math.round(VW * 0.025);
        const FW = VW - INSET * 2;
        const sceneSrc = Image.resolveAssetSource(scene);
        const sceneAsp = (sceneSrc.width / sceneSrc.height) || 0.714;
        const SW = Math.round(FW * 0.88);         // 会話背景(MAP)=ステータス枠の見える幅に合わせて小さく=上左右に余白
        const sceneH = Math.round(SW / sceneAsp); // 縦長背景を全体表示(トリム無し)
        const avH = Math.round(sceneH * 0.52);    // 立ち絵=背景内。会話ダイアログの上端に足元が重なる高さ
        const dlgSrc = Image.resolveAssetSource(dlgImg);
        const dlgW = Math.round(SW * 0.95);       // 会話ダイアログ幅=左右に少し余白
        const dlgH = Math.round(dlgW * dlgSrc.height / dlgSrc.width);
        const dlgBottom = Math.round(SW * 0.025); // 会話ダイアログの下端=会話画像の下端から少し上(下に余白)
        const stH = FW; // ステータス枠=正方形
        // 台詞=必ず2ページ(▽で送る)。1p=あいさつ＋いま特訓中 / 2p=最近の学び＋性格の一言＋またね。
        const p1 = [`やあ、${talk.nick}だよ！会えてうれしいな。`, talk.studying ? `いまは「${talk.studying}」を特訓してるんだ。` : '毎日コツコツ勉強を続けてるよ。'].join('\n');
        const p2 = [talk.weekLearned ? `この7日で${talk.weekLearned}語もおぼえたよ！` : '少しずつ言葉が増えてきた気がする。', `${personaLineOf(talk.personality)} また町で会おうね。`].join('\n');
        const pages: string[] = [p1, p2];
        const page = Math.min(talkPage, pages.length - 1);
        // 最後まで読んだら(▽をもう一度)会話ダイアログを消す。
        const onNext = () => { if (page < pages.length - 1) setTalkPage(page + 1); else setTalkDlgDone(true); };
        const nextY = nextPulse.interpolate({ inputRange: [0, 1], outputRange: [0, 4] });
        const nextOp = nextPulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
        // 台詞窓の文字色=昼(クリーム)は濃字/夜(紺)は白字。話者名は金系。
        const sayCol = isDay ? '#2d2113' : '#eaf1ff';
        const sayName = isDay ? '#9a6e1b' : '#ffd66e';
        // ステータス枠(クリーム)=濃字で統一。ラベルは少し淡く。
        const inkCol = '#2d2113', subCol = '#7a5f2e';
        // フォント(FW基準・固定サイズ)。
        const FS_SAY = Math.round(SW * 0.041), LH_SAY = Math.round(SW * 0.058);
        const FS_NAME = Math.round(FW * 0.044);
        const FS_LAB = Math.round(FW * 0.035), FS_VAL = Math.round(FW * 0.034);
        // 6項目(名前|Lv / 性格|国名 / 気分|得意)=ステータス正方形の上半分。
        const FIELDS: { lab: string; val: string; lab2: string; val2: string }[] = [
          { lab: '名前', val: talk.nick, lab2: 'Lv', val2: String(talk.level) },
          { lab: '性格', val: per ? per.label : '-', lab2: '国名', val2: (talk.flag ?? '').trim() || '-' },
          { lab: '気分', val: mm ?? '-', lab2: '得意', val2: talk.strong ?? '-' },
        ];
        // 「覚えた単語」の内訳(漢字/語彙/文法)。総learnedを決定的に3分割(学習者ごとに少しだけ変える)。
        const hsum = [...(talk.id || 'x')].reduce((a, c) => a + c.charCodeAt(0), 0);
        const kanji = Math.round(learned * (0.26 + (hsum % 10) / 100));
        const vocab = Math.round(learned * (0.46 + (hsum % 7) / 100));
        const grammar = Math.max(0, learned - kanji - vocab);
        const catMax = Math.max(1, kanji, vocab, grammar);
        const CATS: { lab: string; n: number; col: string }[] = [
          { lab: '漢字', n: kanji, col: '#4a7fc0' },
          { lab: '語彙', n: vocab, col: '#6f9a3f' },
          { lab: '文法', n: grammar, col: '#c0603a' },
        ];
        // 6項目の左右分割を動的に。左列(名前/性格/気分)=長め・右列(Lv/国名/得意)=短め。
        //  標準=中央(0.50)→左の値が収まらなければ分割を右へずらし→それでも無理ならフォント縮小(言語で可変)。
        const estEm = (s: string) => { let u = 0; for (const ch of s) u += ch.charCodeAt(0) < 0x100 ? 0.55 : 1; return u; };
        const emVal = FS_VAL / FW;             // 全角1文字の幅(FW比)
        const xValL = 0.225, xLab2 = 0.10;     // 左値の開始x / 右ラベルの幅(分)
        const leftValEm = Math.max(...FIELDS.map((f) => estEm(f.val)));
        const rightValEm = Math.max(...FIELDS.map((f) => estEm(f.val2)));
        const splitX = Math.min(0.66, Math.max(0.50, xValL + leftValEm * emVal + 0.03)); // 左が長い時だけ右へ
        const leftAvail = splitX - 0.03 - xValL;
        const rightAvail = 0.90 - (splitX + xLab2);
        const need = Math.max(leftValEm * emVal / Math.max(leftAvail, 0.001), rightValEm * emVal / Math.max(rightAvail, 0.001));
        const stScale = need > 1 ? Math.max(0.72, 1 / need) : 1; // 分割を右へずらしても収まらなければ縮小
        const fsVal = Math.round(FS_VAL * stScale), fsLab = Math.round(FS_LAB * stScale);
        return (
          <View style={s.cvWrap}>
            {/* 会話画像・ステータス以外の背景=歩行中の町をそのまま見せる(暗幕なし・透過オーバーレイ)。 */}
            {/* 下に引っ張る(オーバースクロール)で会話を抜ける。 */}
            <ScrollView showsVerticalScrollIndicator={false} bounces scrollEventThrottle={16}
              style={{ backgroundColor: 'transparent' }}
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: INSET }}
              onScroll={(e) => { if (e.nativeEvent.contentOffset.y < -72) closeTalk(); }}>
              {/* ① 会話画像=背景(縦長)＋下部に会話ダイアログを重ね＋その上端にアバターを重ねる(ノベル風)。四隅は丸め。 */}
              <View style={{ width: SW, height: sceneH, alignSelf: 'center', borderRadius: 24, overflow: 'hidden', backgroundColor: '#0a0a14' }}>
                <Image source={scene} style={{ position: 'absolute', width: SW, height: sceneH }} resizeMode="cover" />
                {/* 会話ダイアログ: 背景の下端にくっつけて重ねる。台詞を最後まで読む(▽)と消える。 */}
                {!talkDlgDone && (
                <Pressable onPress={onNext} style={{ position: 'absolute', bottom: dlgBottom, left: Math.round((SW - dlgW) / 2), width: dlgW, height: dlgH }}>
                  <Image source={dlgImg} style={{ position: 'absolute', width: dlgW, height: dlgH }} resizeMode="contain" />
                  <View style={{ position: 'absolute', left: dlgW * 0.06, right: dlgW * 0.12, top: 0, bottom: 0, justifyContent: 'center' }}>
                    <Text style={{ color: sayCol, fontSize: FS_SAY, lineHeight: LH_SAY, fontWeight: '600' }} numberOfLines={2}>{pages[page]}</Text>
                  </View>
                  {pages.length > 1 && <Animated.Text style={{ position: 'absolute', right: dlgW * 0.045, bottom: dlgH * 0.12, color: sayName, fontSize: Math.round(SW * 0.05), fontWeight: '900', opacity: nextOp, transform: [{ translateY: nextY }] }}>▽</Animated.Text>}
                </Pressable>
                )}
                {/* 立ち絵: 会話ダイアログの上端に足元が重なる位置に立たせる(ダイアログの前面)。タップは下のダイアログへ透過。 */}
                <View pointerEvents="none" style={{ position: 'absolute', width: avH, height: avH, left: Math.round((SW - avH) / 2), bottom: Math.round(dlgBottom + dlgH + SW * 0.02) }}>
                  <Image source={SET.down[0]} style={{ width: avH, height: avH }} resizeMode="contain" />
                </View>
              </View>
              {/* ② ステータス枠(正方形・会話画像の下)。上半分=6項目 / 下半分=覚えた単語(漢字/語彙/文法) 3バー。 */}
              <View style={{ width: FW, height: stH, alignSelf: 'center', marginTop: -Math.round(FW * 0.045) }}>
                <Image source={STATUSBOX} style={{ position: 'absolute', width: FW, height: stH }} resizeMode="contain" />
                {/* 6項目: 2列×3行(名前|Lv / 性格|国名 / 気分|得意)。値は下線に乗せる。 */}
                {FIELDS.map((f, i) => {
                  const y = stH * (0.15 + i * 0.115);
                  const uy = y + fsVal * 1.35;
                  return (
                    <View key={i} pointerEvents="none" style={StyleSheet.absoluteFill}>
                      <Text style={{ position: 'absolute', left: FW * 0.10, top: y, color: subCol, fontSize: fsLab, fontWeight: '800' }}>{f.lab}</Text>
                      <Text numberOfLines={1} ellipsizeMode="tail" style={{ position: 'absolute', left: FW * xValL, width: FW * leftAvail, top: y, color: inkCol, fontSize: fsVal, fontWeight: '800' }}>{f.val}</Text>
                      <View style={{ position: 'absolute', left: FW * xValL, width: FW * leftAvail, top: uy, height: 1, backgroundColor: 'rgba(120,95,46,0.35)' }} />
                      <Text style={{ position: 'absolute', left: FW * splitX, top: y, color: subCol, fontSize: fsLab, fontWeight: '800' }}>{f.lab2}</Text>
                      <Text numberOfLines={1} ellipsizeMode="tail" style={{ position: 'absolute', left: FW * (splitX + xLab2), width: FW * rightAvail, top: y, color: inkCol, fontSize: fsVal, fontWeight: '800' }}>{f.val2}</Text>
                      <View style={{ position: 'absolute', left: FW * (splitX + xLab2), width: FW * rightAvail, top: uy, height: 1, backgroundColor: 'rgba(120,95,46,0.35)' }} />
                    </View>
                  );
                })}
                {/* 見出し「覚えた単語」(中央・区切り線の下)。 */}
                <Text style={{ position: 'absolute', top: stH * 0.53, left: 0, right: 0, textAlign: 'center', color: subCol, fontSize: FS_LAB, fontWeight: '900', letterSpacing: 2 }}>覚えた単語</Text>
                {/* 3バー: 漢字/語彙/文法 = 内訳(色分け)＋語数。 */}
                {CATS.map((c, i) => {
                  const y = stH * (0.63 + i * 0.105);
                  const bx0 = FW * 0.28, bx1 = FW * 0.76, bw = bx1 - bx0;
                  const fill = Math.max(0.04, Math.min(1, 0.82 * c.n / catMax));
                  return (
                    <View key={i} pointerEvents="none" style={StyleSheet.absoluteFill}>
                      <Text style={{ position: 'absolute', left: FW * 0.12, top: y, color: subCol, fontSize: FS_LAB, fontWeight: '800' }}>{c.lab}</Text>
                      <View style={{ position: 'absolute', left: bx0, top: y + 1, width: bw, height: Math.round(FW * 0.036), borderRadius: 6, backgroundColor: 'rgba(120,100,70,0.16)', borderWidth: 1, borderColor: 'rgba(120,100,70,0.4)', overflow: 'hidden' }}>
                        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: Math.round(bw * fill), backgroundColor: c.col, borderRadius: 6 }} />
                      </View>
                      <Text style={{ position: 'absolute', left: bx1 + FW * 0.025, top: y, color: inkCol, fontSize: FS_VAL, fontWeight: '800' }}>{c.n}</Text>
                    </View>
                  );
                })}
              </View>
              {/* 下: 「メッセージを送る」ボタンだけ(友だち=id=friend: にだけ表示)。押すと応援メッセージ画面へ。 */}
              {talk.id.startsWith('friend:') && (
                <View style={{ width: FW, alignSelf: 'center', paddingTop: 2, paddingBottom: 40 }}>
                  <Pressable style={s.msgSendBtn} onPress={openMsg}>
                    <Ionicons name="chatbubble-ellipses" size={18} color="#fff" />
                    <Text style={s.msgSendBtnT}>メッセージを送る</Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>
            {/* 閉じる(はっきり見える白フチの丸)。下スワイプでも抜けられる。 */}
            <Pressable onPress={closeTalk} hitSlop={12} style={s.nvClose}><Ionicons name="close" size={19} color="#ffffff" /></Pressable>
          </View>
        );
      })()}

      {/* 桜の会話(ノベル風・立ち絵フルスクリーン)。学習者と同じ演出=全画面ランダム背景＋桜の立ち絵＋ダイアログボックス。 */}
      {sakuraTalk && (() => {
        // 桜の会話も他アバターと同じノベル構成＋ステータス枠。桜は学習者でないので覚えた単語バーは出さない・Lvは非表示。
        const scene = SCENES[talkScene][isDay ? 'day' : 'night'];
        const dlgImg = isDay ? DLG_LIGHT : DLG_DARK;
        const INSET = Math.round(VW * 0.025);
        const FW = VW - INSET * 2;
        const sceneSrc = Image.resolveAssetSource(scene);
        const sceneAsp = (sceneSrc.width / sceneSrc.height) || 0.714;
        const SW = Math.round(FW * 0.88);         // 会話背景(MAP)=ステータス枠の見える幅に合わせて小さく=上左右に余白
        const sceneH = Math.round(SW / sceneAsp);
        const avH = Math.round(sceneH * 0.52);
        const dlgSrc = Image.resolveAssetSource(dlgImg);
        const dlgW = Math.round(SW * 0.95);       // 会話ダイアログ幅=左右に少し余白
        const dlgH = Math.round(dlgW * dlgSrc.height / dlgSrc.width);
        const dlgBottom = Math.round(SW * 0.025); // 会話ダイアログの下端=会話画像の下端から少し上(下に余白)
        const stH = FW;
        const sayCol = isDay ? '#2d2113' : '#eaf1ff';
        const sayName = isDay ? '#9a6e1b' : '#ffd66e';
        const inkCol = '#2d2113', subCol = '#7a5f2e';
        const FS_SAY = Math.round(SW * 0.041), LH_SAY = Math.round(SW * 0.058);
        const FS_NAME = Math.round(FW * 0.044);
        const FS_LAB = Math.round(FW * 0.035), FS_VAL = Math.round(FW * 0.034);
        const pages = sakuraLines.length ? sakuraLines : ['また会えたね🌸'];
        const page = Math.min(sakuraPage, pages.length - 1);
        const onNext = () => { if (page < pages.length - 1) setSakuraPage(page + 1); else closeSakura(); };
        const nextY = nextPulse.interpolate({ inputRange: [0, 1], outputRange: [0, 4] });
        const nextOp = nextPulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
        // 桜のステータス: 性格=3種からランダム(会話ごと=talkScene由来で安定)・気分固定・Lv非表示。
        const SPERS = ['マイペース', 'おっとり', '優しい'];
        const sakuraPer = SPERS[[...talkScene].reduce((a, c) => a + c.charCodeAt(0), 0) % SPERS.length];
        const SFIELDS: { lab: string; val: string; lab2: string; val2: string }[] = [
          { lab: '名前', val: '桜', lab2: '', val2: '' }, // Lvは非表示(右列なし)
          { lab: '性格', val: sakuraPer, lab2: '国名', val2: '🇯🇵' },
          { lab: '気分', val: '桜貝大好き', lab2: '得意', val2: '応援' },
        ];
        const estEm = (t: string) => { let u = 0; for (const ch of t) u += ch.charCodeAt(0) < 0x100 ? 0.55 : 1; return u; };
        const emVal = FS_VAL / FW; const xValL = 0.225, xLab2 = 0.10;
        const leftValEm = Math.max(...SFIELDS.map((f) => estEm(f.val)));
        const rightValEm = Math.max(...SFIELDS.map((f) => estEm(f.val2)));
        const splitX = Math.min(0.66, Math.max(0.50, xValL + leftValEm * emVal + 0.03));
        const leftAvail = splitX - 0.03 - xValL; const rightAvail = 0.90 - (splitX + xLab2);
        const need = Math.max(leftValEm * emVal / Math.max(leftAvail, 0.001), rightValEm * emVal / Math.max(rightAvail, 0.001));
        const stScale = need > 1 ? Math.max(0.72, 1 / need) : 1;
        const fsVal = Math.round(FS_VAL * stScale), fsLab = Math.round(FS_LAB * stScale);
        return (
          <View style={s.cvWrap}>
            {/* 会話画像・ステータス以外の背景=歩行中の町をそのまま(暗幕なし)。下に引くと閉じる。 */}
            <ScrollView showsVerticalScrollIndicator={false} bounces scrollEventThrottle={16}
              style={{ backgroundColor: 'transparent' }}
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: INSET }}
              onScroll={(e) => { if (e.nativeEvent.contentOffset.y < -72) closeSakura(); }}>
              {/* ① 会話画像=背景(縦長)＋下部にダイアログ＋その上端に桜の立ち絵。四隅丸め。話者名は出さない。 */}
              <View style={{ width: SW, height: sceneH, alignSelf: 'center', borderRadius: 24, overflow: 'hidden', backgroundColor: '#0a0a14' }}>
                <Image source={scene} style={{ position: 'absolute', width: SW, height: sceneH }} resizeMode="cover" />
                <Pressable onPress={onNext} style={{ position: 'absolute', bottom: dlgBottom, left: Math.round((SW - dlgW) / 2), width: dlgW, height: dlgH }}>
                  <Image source={dlgImg} style={{ position: 'absolute', width: dlgW, height: dlgH }} resizeMode="contain" />
                  <View style={{ position: 'absolute', left: dlgW * 0.06, right: dlgW * 0.12, top: 0, bottom: 0, justifyContent: 'center' }}>
                    <Text style={{ color: sayCol, fontSize: FS_SAY, lineHeight: LH_SAY, fontWeight: '600' }} numberOfLines={2}>{pages[page]}</Text>
                  </View>
                  {pages.length > 1 && <Animated.Text style={{ position: 'absolute', right: dlgW * 0.045, bottom: dlgH * 0.12, color: sayName, fontSize: Math.round(SW * 0.05), fontWeight: '900', opacity: nextOp, transform: [{ translateY: nextY }] }}>▽</Animated.Text>}
                </Pressable>
                <View pointerEvents="none" style={{ position: 'absolute', width: avH, height: avH, left: Math.round((SW - avH) / 2), bottom: Math.round(dlgBottom + dlgH + SW * 0.02) }}>
                  <Image source={SAKURA.down[0]} style={{ width: avH, height: avH }} resizeMode="contain" />
                </View>
              </View>
              {/* ② ステータス枠(桜用)。上半分=項目(名前/性格/気分＋国名/得意・Lvは非表示)。下半分=覚えた単語(桜はマックス)。 */}
              <View style={{ width: FW, height: stH, alignSelf: 'center', marginTop: -Math.round(FW * 0.045) }}>
                <Image source={STATUSBOX} style={{ position: 'absolute', width: FW, height: stH }} resizeMode="contain" />
                {SFIELDS.map((f, i) => {
                  const y = stH * (0.15 + i * 0.115); const uy = y + fsVal * 1.35;
                  return (
                    <View key={i} pointerEvents="none" style={StyleSheet.absoluteFill}>
                      <Text style={{ position: 'absolute', left: FW * 0.10, top: y, color: subCol, fontSize: fsLab, fontWeight: '800' }}>{f.lab}</Text>
                      <Text numberOfLines={1} ellipsizeMode="tail" style={{ position: 'absolute', left: FW * xValL, width: FW * leftAvail, top: y, color: inkCol, fontSize: fsVal, fontWeight: '800' }}>{f.val}</Text>
                      <View style={{ position: 'absolute', left: FW * xValL, width: FW * leftAvail, top: uy, height: 1, backgroundColor: 'rgba(120,95,46,0.35)' }} />
                      {f.lab2 ? (<>
                        <Text style={{ position: 'absolute', left: FW * splitX, top: y, color: subCol, fontSize: fsLab, fontWeight: '800' }}>{f.lab2}</Text>
                        <Text numberOfLines={1} ellipsizeMode="tail" style={{ position: 'absolute', left: FW * (splitX + xLab2), width: FW * rightAvail, top: y, color: inkCol, fontSize: fsVal, fontWeight: '800' }}>{f.val2}</Text>
                        <View style={{ position: 'absolute', left: FW * (splitX + xLab2), width: FW * rightAvail, top: uy, height: 1, backgroundColor: 'rgba(120,95,46,0.35)' }} />
                      </>) : null}
                    </View>
                  );
                })}
                {/* 覚えた単語=桜はマックス(3バー満タン)。 */}
                <Text style={{ position: 'absolute', top: stH * 0.53, left: 0, right: 0, textAlign: 'center', color: subCol, fontSize: FS_LAB, fontWeight: '900', letterSpacing: 2 }}>覚えた単語</Text>
                {[{ lab: '漢字', col: '#4a7fc0' }, { lab: '語彙', col: '#6f9a3f' }, { lab: '文法', col: '#c0603a' }].map((c, i) => {
                  const y = stH * (0.63 + i * 0.105);
                  const bx0 = FW * 0.28, bx1 = FW * 0.76, bw = bx1 - bx0;
                  return (
                    <View key={`sc${i}`} pointerEvents="none" style={StyleSheet.absoluteFill}>
                      <Text style={{ position: 'absolute', left: FW * 0.12, top: y, color: subCol, fontSize: FS_LAB, fontWeight: '800' }}>{c.lab}</Text>
                      <View style={{ position: 'absolute', left: bx0, top: y + 1, width: bw, height: Math.round(FW * 0.036), borderRadius: 6, backgroundColor: 'rgba(120,100,70,0.16)', borderWidth: 1, borderColor: 'rgba(120,100,70,0.4)', overflow: 'hidden' }}>
                        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: bw, backgroundColor: c.col, borderRadius: 6 }} />
                      </View>
                      <Text style={{ position: 'absolute', left: bx1 + FW * 0.025, top: y, color: inkCol, fontSize: FS_VAL, fontWeight: '900' }}>MAX</Text>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
            <Pressable onPress={closeSakura} hitSlop={12} style={s.nvClose}><Ionicons name="close" size={19} color="#ffffff" /></Pressable>
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
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bellBadge: { position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#e23b3b', borderWidth: 1.5, borderColor: '#ffffff', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  bellBadgeT: { color: '#ffffff', fontSize: 10, fontWeight: '900' },
  pill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,253,248,0.9)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  pillT: { fontSize: 13, fontWeight: '900', color: '#3a3128' },
  // 町の友だち一覧(ボトムシート)。
  memberBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  memberSheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fbf7ef', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 30 },
  memberHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  memberTitle: { fontSize: 17, fontWeight: '900', color: '#3a3128' },
  memberEmpty: { color: '#6b6256', fontSize: 14, lineHeight: 22, textAlign: 'center', paddingVertical: 24 },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(58,49,40,0.08)' },
  memberTapArea: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  memberDel: { marginLeft: 12, padding: 4 },
  memberName: { flex: 1, fontSize: 15, fontWeight: '800', color: '#3a3128', marginRight: 10 },
  memberRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  memberMeta: { fontSize: 12, fontWeight: '700', color: '#8a8072' },
  memberSend: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#e0803c', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  memberSendT: { color: '#fff', fontSize: 12, fontWeight: '900' },
  // 「メッセージを送る」ボタン(会話のステータス下)＋応援メッセージ画面。
  msgSendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'center', backgroundColor: '#e0803c', borderRadius: 999, paddingVertical: 13, paddingHorizontal: 28, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  msgSendBtnT: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
  msgPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  msgPill: { backgroundColor: '#fff5e8', borderWidth: 1, borderColor: '#e6c79a', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9 },
  msgPillT: { fontSize: 13, fontWeight: '800', color: '#7a5a34' },
  msgLabel: { fontSize: 13, fontWeight: '800', color: '#6b6256', marginTop: 14, marginBottom: 6 },
  msgInput: { minHeight: 64, maxHeight: 120, borderWidth: 1, borderColor: '#e0d6c4', borderRadius: 12, backgroundColor: '#fffdf8', paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#3a3128', textAlignVertical: 'top' },
  msgSubmit: { marginTop: 12, backgroundColor: '#e2588f', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  msgSubmitT: { color: '#fff', fontSize: 15, fontWeight: '900' },
  // 友だちを町に招待=白ボタン(アイコン無し)。タイトル横。
  inviteWhite: { backgroundColor: 'rgba(255,253,248,0.95)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: 'rgba(58,49,40,0.15)' },
  inviteWhiteT: { fontSize: 13, fontWeight: '900', color: '#3a3128', letterSpacing: 0.2 },
  close: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,253,248,0.9)', alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  stickWrap: { paddingBottom: 26 }, // 左右はhandedで付与(右利き=右)
  stickBase: { width: STICK_R * 2, height: STICK_R * 2, borderRadius: STICK_R, backgroundColor: 'rgba(58,49,40,0.28)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' },
  stickKnob: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,253,248,0.9)', borderWidth: 2, borderColor: 'rgba(58,49,40,0.4)' },
  npcTag: { position: 'absolute', top: -14, backgroundColor: 'rgba(58,49,40,0.8)', borderRadius: 7, paddingHorizontal: 5, paddingVertical: 1, maxWidth: 130 },
  npcTagT: { color: '#fff', fontSize: 9, fontWeight: '700' },
  friendTag: { backgroundColor: 'rgba(224,128,60,0.9)' }, // 友だち=橙(☆付き)で目立たせる
  meTag: { backgroundColor: 'rgba(47,98,216,0.9)' },       // 自分=青の名札で区別
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
  nvClose: { position: 'absolute', top: 52, right: 14, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(12,16,28,0.6)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center', zIndex: 8, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 5 },
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
