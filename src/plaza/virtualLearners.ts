// マップに配置する仮想の学習者(NPC)。リリース初期に実ユーザーが少なくても町が無人にならないよう置く。
// 表示専用: 会話も操作もなし。頭上に「国旗+ニックネーム+レベル」を出し、home周辺をゆっくり徘徊する。
// スプライトは男の子1体の着物色替え(assets/kotoba/npc/<color>_<dir>.png)。実ユーザーが増えたら表示数を絞って自然に置換する想定。
export type NpcColor = 'blue' | 'green' | 'crimson' | 'purple' | 'teal' | 'amber';

export interface VirtualLearner {
  id: string;
  nick: string;                       // ニックネーム(自由名。実在の特定個人ではない)
  flag: string;                       // 国旗絵文字
  level: 'N5' | 'N4' | 'N3';
  streak: number;                     // 連続日数
  today: number;                      // 今日の問題数
  color: NpcColor;                    // 着物色
  home: { col: number; row: number }; // 配置マス(当たり判定グリッド=MAP_G座標)
}

// 国はボーダーレスに散らす。home は当たり判定で歩けるマスから選定済み。
export const VIRTUAL_LEARNERS: VirtualLearner[] = [
  { id: 'v1', nick: 'Mina', flag: '🇻🇳', level: 'N5', streak: 12, today: 20, color: 'crimson', home: { col: 18, row: 20 } },
  { id: 'v2', nick: 'Leo', flag: '🇧🇷', level: 'N4', streak: 5, today: 15, color: 'green', home: { col: 29, row: 20 } },
  { id: 'v3', nick: 'Sora', flag: '🇰🇷', level: 'N3', streak: 33, today: 40, color: 'purple', home: { col: 16, row: 26 } },
  { id: 'v4', nick: 'Aria', flag: '🇮🇹', level: 'N5', streak: 2, today: 10, color: 'amber', home: { col: 31, row: 26 } },
  { id: 'v5', nick: 'Kai', flag: '🇺🇸', level: 'N4', streak: 8, today: 25, color: 'teal', home: { col: 12, row: 23 } },
  { id: 'v6', nick: 'Nina', flag: '🇫🇷', level: 'N4', streak: 19, today: 30, color: 'blue', home: { col: 35, row: 27 } },
  { id: 'v7', nick: 'Tan', flag: '🇹🇭', level: 'N5', streak: 4, today: 12, color: 'green', home: { col: 19, row: 31 } },
  { id: 'v8', nick: 'Ren', flag: '🇨🇳', level: 'N3', streak: 27, today: 35, color: 'crimson', home: { col: 30, row: 33 } },
];
