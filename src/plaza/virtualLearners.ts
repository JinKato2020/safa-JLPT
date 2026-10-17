// マップに配置する仮想の学習者(NPC)。リリース初期に実ユーザーが少なくても町が無人にならないよう置く。
// 表示専用: 会話も操作もなし。頭上に「国旗+ニックネーム+レベル」を出し、home周辺をゆっくり8方向で歩き回る。
// スプライトは町のアバター10種(男の子1〜5・女の子1〜5)を使い回す。
// ── 運用(2026-08-13 ユーザー確定) ──
//   ・名簿は100人。町ではその中から毎回シャッフルして数人だけ登場させる(顔ぶれが毎回変わる)。
//   ・友だち(実在)が居れば友だちを優先表示。
//   ・実ユーザーが増えるほど登場数を自動で絞る(app_user_count → fakeFactor)。100人超で架空は0=自然に置換。
//   ・生成は決定的(モジュール読み込み時にランダムを使わない)。並び替えは表示側で行う。
export interface VirtualLearner {
  id: string;
  nick: string;                       // ニックネーム(自由名。実在の特定個人ではない)
  flag: string;                       // 国旗絵文字
  level: 'N5' | 'N4' | 'N3';
  streak: number;                     // 連続日数
  today: number;                      // 今日の問題数
  avatar: string;                     // アバターコード(m_boy1..m_boy5 / f_g1..f_g5)
  home: { col: number; row: number }; // 配置マス(表示側で歩けるマスに再割当=この値自体は使われない)
  studying?: string;                  // いま勉強している分野(聴解/漢字/語彙/文法/読解)。会話カードに表示
  learned?: number;                   // これまで覚えた語数(会話カードに表示)
  weekLearned?: number;               // この7日で覚えた語数(直近の頑張り)。会話カードに表示
  studySeconds?: number;              // 累計学習時間(秒)。実データ(友だち)用。NPCは未設定→語数から概算
  todayMin?: number;                  // 今日の学習時間(分)。会話カードに表示
  strong?: string;                    // 得意な分野(前向きに得意だけ)。会話カードに表示
  note?: string;                      // 一言(自由コメント。会話カードに表示)
  mood?: string;                      // (旧)努力タイプ。廃止済み=未使用。型互換のため残置
  personality?: string;              // 性格(persona.ts PERSONALITIES)のキー。会話カードに表示
  moodMsg?: string;                   // 気分メッセージ(persona.ts MOOD_MESSAGES)のキー。頭上/会話カードに表示
  words?: { type: 'vocab' | 'kanji' | 'grammar'; id: string }[]; // 単語帳(会話画面で見せる)。友だち=実データ / 仮想NPC=レベル相応の見本を町側で生成
  shareWords?: boolean;              // 単語帳を見せてよいか(既定 true)。false=会話画面で単語帳ボタンを出さない
}

// ── 素材(決定的生成の元) ────────────────────────────────────────────────
// ニックネーム100(国際・ボーダーレス。実在の特定個人ではない自由なハンドル名)。
const NICKS = [
  'Mina', 'Leo', 'Sora', 'Aria', 'Kai', 'Nina', 'Tan', 'Ren', 'Yuki', 'Diego',
  'Hana', 'Omar', 'Lucas', 'Sofia', 'Anh', 'Mei', 'Noah', 'Lena', 'Ravi', 'Emma',
  'Jun', 'Bella', 'Ivan', 'Clara', 'Duc', 'Priya', 'Marco', 'Yuna', 'Sam', 'Elena',
  'Toby', 'Maya', 'Nur', 'Felix', 'Lin', 'Adam', 'Rina', 'Oscar', 'Thu', 'Gina',
  'Hugo', 'Sana', 'Nabil', 'Vera', 'Long', 'Amara', 'Pablo', 'Kira', 'Yusuf', 'Nadia',
  'Theo', 'Lucia', 'Minh', 'Rosa', 'Emir', 'Chloe', 'Aran', 'Suki', 'Karim', 'Nora',
  'Dami', 'Ines', 'Viet', 'Talia', 'Bao', 'Aya', 'Enzo', 'Lily', 'Fahad', 'Zoe',
  'Bina', 'Mira', 'Hoa', 'Nate', 'Selin', 'Arjun', 'Paz', 'Kenji', 'Dina', 'Iker',
  'Trang', 'Milan', 'Sena', 'Cruz', 'Lan', 'Reza', 'Nell', 'Idris', 'Yara', 'Piotr',
  'Cami', 'Huy', 'Alma', 'Bruno', 'Thao', 'Nils', 'Sara', 'Quan', 'Elif', 'Diya',
];
// 国旗40(ボーダーレスに散らす)。
const FLAGS = [
  '🇻🇳', '🇧🇷', '🇰🇷', '🇮🇹', '🇺🇸', '🇫🇷', '🇹🇭', '🇨🇳', '🇹🇼', '🇲🇽',
  '🇵🇭', '🇪🇬', '🇮🇩', '🇮🇳', '🇳🇵', '🇧🇩', '🇲🇲', '🇱🇰', '🇵🇰', '🇹🇷',
  '🇩🇪', '🇪🇸', '🇬🇧', '🇷🇺', '🇺🇦', '🇵🇱', '🇳🇬', '🇰🇪', '🇪🇹', '🇲🇦',
  '🇵🇪', '🇨🇴', '🇦🇷', '🇨🇱', '🇨🇦', '🇦🇺', '🇲🇳', '🇰🇭', '🇱🇦', '🇺🇿',
];
const AVA = ['m_boy1', 'm_boy2', 'm_boy3', 'm_boy4', 'm_boy5', 'f_g1', 'f_g2', 'f_g3', 'f_g4', 'f_g5'];
const LV = ['N5', 'N5', 'N5', 'N4', 'N4', 'N3'] as const; // 初級寄りに重み付け
const FIELDS = ['聴解', '漢字', '語彙', '文法', '読解'];
const FIELD_MOOD: Record<string, string> = { '聴解': 'listening', '漢字': 'kanji', '語彙': 'tango', '文法': 'bunpo', '読解': 'goukaku' };
const PERSONAS = [
  'akarui', 'majime', 'ottori', 'makezu', 'mypace', 'doryoku', 'koukishin', 'samishi', 'ochoshi', 'reisei',
  'yasashii', 'tennen', 'shikkari', 'awate', 'roman', 'kodawari', 'positive', 'uchiki', 'leader', 'jiyu',
];
const MOODS = [
  'ganbaru', 'goukaku', 'kotsu', 'yasumi', 'max', 'nemui', 'tanoshii', 'oikomi', 'kokomade', 'issho',
  'kanji', 'listening', 'tango', 'bunpo', 'slump', 'sotsugyo', 'best', 'daisuki', 'dokidoki', 'mypace',
];

// ニックネームから重複サフィックス(数字)を落として表示名にする(素材の一意化用サフィックスを消す)。
const cleanNick = (n: string) => n.replace(/[0-9]+$/, '');

// 100人を決定的に生成(規則的に各フィールドを散らす。互いに素な係数で偏りを抑える)。
export const VIRTUAL_LEARNERS: VirtualLearner[] = NICKS.map((rawNick, i) => {
  const level = LV[i % LV.length];
  const studying = FIELDS[i % FIELDS.length];
  const strong = FIELDS[(i * 3 + 1) % FIELDS.length];
  const base = level === 'N3' ? 900 : level === 'N4' ? 420 : 150;
  const learned = base + ((i * 37) % 400);
  const moodMsg = i % 3 === 0 ? FIELD_MOOD[studying] : MOODS[(i * 13) % MOODS.length];
  return {
    id: 'v' + (i + 1),
    nick: cleanNick(rawNick),
    flag: FLAGS[(i * 7) % FLAGS.length],
    level,
    streak: 1 + ((i * 3) % 45),
    today: 8 + ((i * 5) % 34),
    avatar: AVA[(i * 3) % AVA.length],
    home: { col: 0, row: 0 },
    studying,
    learned,
    weekLearned: 25 + ((i * 7) % 90),
    todayMin: 10 + ((i * 6) % 50),
    strong,
    personality: PERSONAS[(i * 11) % PERSONAS.length],
    moodMsg,
  };
});
