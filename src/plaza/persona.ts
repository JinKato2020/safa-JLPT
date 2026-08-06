// 最初のアバター設定で選ぶ「性格(20種)」と「ムードメッセージ(20種)」。すべて定型=自由入力なし(選ぶだけ)。
// 町で話しかけた相手に見える。i18nは方針どおり後追い(いまは日本語・他言語はフォールバック)。

export type Trait = { key: string; emoji: string; label: string };

// 性格(20種)。キャラの人となり。会話カードにバッジで表示。
export const PERSONALITIES: Trait[] = [
  { key: 'akarui', emoji: '😊', label: '明るい' },
  { key: 'majime', emoji: '📘', label: 'まじめ' },
  { key: 'ottori', emoji: '☁️', label: 'おっとり' },
  { key: 'makezu', emoji: '🔥', label: '負けずぎらい' },
  { key: 'mypace', emoji: '🐾', label: 'マイペース' },
  { key: 'doryoku', emoji: '💪', label: '努力家' },
  { key: 'koukishin', emoji: '🔍', label: '好奇心おうせい' },
  { key: 'samishi', emoji: '🥺', label: 'さみしがり' },
  { key: 'ochoshi', emoji: '🎉', label: 'お調子者' },
  { key: 'reisei', emoji: '🧊', label: '冷静' },
  { key: 'yasashii', emoji: '🌷', label: 'やさしい' },
  { key: 'tennen', emoji: '🍀', label: '天然' },
  { key: 'shikkari', emoji: '📐', label: 'しっかり者' },
  { key: 'awate', emoji: '💨', label: 'あわてんぼう' },
  { key: 'roman', emoji: '🌙', label: 'ロマンチスト' },
  { key: 'kodawari', emoji: '🎯', label: 'こだわり派' },
  { key: 'positive', emoji: '☀️', label: 'ポジティブ' },
  { key: 'uchiki', emoji: '🌱', label: '内気' },
  { key: 'leader', emoji: '🚩', label: 'リーダー気質' },
  { key: 'jiyu', emoji: '🕊️', label: '自由人' },
];

export function personalityOf(key: string | undefined | null): Trait | null {
  return PERSONALITIES.find((p) => p.key === key) ?? null;
}

// ノベル会話で、性格に合わせて本人がしゃべる一言(定型)。努力タイプ廃止に伴い、会話の“らしさ”は性格が担う。
export const PERSONA_LINE: Record<string, string> = {
  akarui: 'いつも笑顔でいたいんだ〜！',
  majime: 'コツコツやるのが性に合ってるみたい。',
  ottori: 'あわてず、のんびりいこうね。',
  makezu: '負けたくないから、つい頑張っちゃう！',
  mypace: '自分のリズムを大事にしてるよ。',
  doryoku: '努力は裏切らないって、信じてる。',
  koukishin: '新しいことを知るのが楽しくてね！',
  samishi: '一人だと心細いから、会えてうれしいな。',
  ochoshi: 'ノリで乗り切るタイプなんだ〜！',
  reisei: '落ち着いて、ひとつずつ片づけるよ。',
  yasashii: '困ってたら、いつでも声かけてね。',
  tennen: 'たまにボーッとしちゃうけど、楽しいよ。',
  shikkari: '計画を立ててから動く派なんだ。',
  awate: 'ついあわてちゃうけど、がんばる！',
  roman: '夢を見ながら勉強するのが好き。',
  kodawari: '納得いくまで、とことんやりたいの。',
  positive: 'なんとかなるって、いつも思ってる！',
  uchiki: 'ちょっと人見知りだけど…よろしくね。',
  leader: 'みんなを引っぱるの、まかせて！',
  jiyu: '気の向くままに学んでるよ〜。',
};
export function personaLineOf(key: string | undefined | null): string {
  return (key && PERSONA_LINE[key]) || '一緒にがんばろうね！';
}

// ムードメッセージ(20種)。いまの気分・ひとことを定型から選ぶ。頭上や会話カードに表示。
export const MOOD_MESSAGES: { key: string; text: string }[] = [
  { key: 'ganbaru', text: '今日もがんばるぞ！' },
  { key: 'goukaku', text: '合格めざして進む✊' },
  { key: 'kotsu', text: 'コツコツ積み上げ中' },
  { key: 'yasumi', text: 'ちょっと一休み☕' },
  { key: 'max', text: 'やる気MAX🔥' },
  { key: 'nemui', text: '眠いけどやる😪' },
  { key: 'tanoshii', text: '楽しく勉強してる♪' },
  { key: 'oikomi', text: '追い込みモード！' },
  { key: 'kokomade', text: '今日はここまで〜' },
  { key: 'issho', text: '一緒にがんばろう🤝' },
  { key: 'kanji', text: '漢字と格闘中✍️' },
  { key: 'listening', text: 'リスニング特訓中🎧' },
  { key: 'tango', text: '単語ふやし隊📖' },
  { key: 'bunpo', text: '文法なんて怖くない！' },
  { key: 'slump', text: 'スランプ…でも続ける' },
  { key: 'sotsugyo', text: '三日坊主、卒業したい' },
  { key: 'best', text: '毎日がベスト更新📈' },
  { key: 'daisuki', text: '日本語だいすき🇯🇵' },
  { key: 'dokidoki', text: '試験前でドキドキ' },
  { key: 'mypace', text: 'マイペースにいくよ🐢' },
];

export function moodMsgOf(key: string | undefined | null): string | null {
  return MOOD_MESSAGES.find((m) => m.key === key)?.text ?? null;
}
