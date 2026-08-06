// マップに配置する仮想の学習者(NPC)。リリース初期に実ユーザーが少なくても町が無人にならないよう置く。
// 表示専用: 会話も操作もなし。頭上に「国旗+ニックネーム+レベル」を出し、home周辺をゆっくり8方向で歩き回る。
// スプライトは町のアバター6種(男の子1,2・女の子1〜4)を使い回す。実ユーザーが増えたら表示数を絞って自然に置換する想定。
export interface VirtualLearner {
  id: string;
  nick: string;                       // ニックネーム(自由名。実在の特定個人ではない)
  flag: string;                       // 国旗絵文字
  level: 'N5' | 'N4' | 'N3';
  streak: number;                     // 連続日数
  today: number;                      // 今日の問題数
  avatar: string;                     // アバターコード(m_boy1/m_boy2/f_g1/f_g2/f_g3/f_g4)
  home: { col: number; row: number }; // 配置マス(当たり判定グリッド=MAP_G座標)
  studying?: string;                  // いま勉強している分野(聴解/漢字/語彙/文法/読解)。会話カードに具体的な頑張りとして表示
  learned?: number;                   // これまで覚えた語数(会話カードに表示)
  weekLearned?: number;               // この7日で覚えた語数(直近の頑張りが見える)。会話カードに表示
  todayMin?: number;                  // 今日の学習時間(分)。会話カードに表示
  strong?: string;                    // 得意な分野(前向きに得意だけ。苦手は載せない)。会話カードに表示
  note?: string;                      // 一言(自由コメント。会話カードに表示)
}

// 国はボーダーレスに散らす。home は当たり判定で歩けるマスから選定済み。アバター6種をばらけて割当。
export const VIRTUAL_LEARNERS: VirtualLearner[] = [
  { id: 'v1', nick: 'Mina', flag: '🇻🇳', level: 'N5', streak: 12, today: 20, avatar: 'f_g1', home: { col: 18, row: 19 }, studying: '漢字', learned: 210, weekLearned: 45, todayMin: 25, strong: '語彙', note: '毎日コツコツ続けてます！' },
  { id: 'v2', nick: 'Leo', flag: '🇧🇷', level: 'N4', streak: 5, today: 15, avatar: 'm_boy1', home: { col: 30, row: 18 }, studying: '聴解', learned: 480, weekLearned: 60, todayMin: 40, strong: '聴解', note: 'リスニングが好きです' },
  { id: 'v3', nick: 'Sora', flag: '🇰🇷', level: 'N3', streak: 33, today: 40, avatar: 'f_g2', home: { col: 15, row: 26 }, studying: '読解', learned: 1200, weekLearned: 120, todayMin: 60, strong: '読解', note: '長い文章に挑戦中' },
  { id: 'v4', nick: 'Aria', flag: '🇮🇹', level: 'N5', streak: 2, today: 10, avatar: 'f_g3', home: { col: 31, row: 26 }, studying: '語彙', learned: 150, weekLearned: 28, todayMin: 15, strong: 'ひらがな', note: '単語を覚えはじめました' },
  { id: 'v5', nick: 'Kai', flag: '🇺🇸', level: 'N4', streak: 8, today: 25, avatar: 'm_boy2', home: { col: 12, row: 23 }, studying: '文法', learned: 520, weekLearned: 72, todayMin: 35, strong: '漢字', note: '毎日少しずつ！' },
  { id: 'v6', nick: 'Nina', flag: '🇫🇷', level: 'N4', streak: 19, today: 30, avatar: 'f_g4', home: { col: 34, row: 24 }, studying: '聴解', learned: 600, weekLearned: 90, todayMin: 45, strong: '聴解', note: '毎日30分がんばってます' },
  { id: 'v7', nick: 'Tan', flag: '🇹🇭', level: 'N5', streak: 4, today: 12, avatar: 'f_g2', home: { col: 19, row: 32 }, studying: '漢字', learned: 180, weekLearned: 34, todayMin: 20, strong: '漢字', note: '漢字は難しいけど楽しい' },
  { id: 'v8', nick: 'Ren', flag: '🇨🇳', level: 'N3', streak: 27, today: 35, avatar: 'm_boy1', home: { col: 30, row: 33 }, studying: '読解', learned: 1100, weekLearned: 105, todayMin: 50, strong: '文法', note: '合格めざしてます！' },
];
