// 書庫＝復元エンジン(純関数)。物語の背骨「たった一冊の古代辞書を完成させ、荒れた書庫を元通りにする」を絵ゼロで駆動。
//  ・軸は"願い"でなく"復元"=全員同じゴール・分岐なし(任天堂型の単一目標)。願いは栞=時々触れる動機(台詞は voice.ts)。
//  ・巻は分けない=辞書は1冊だけ(級ごとに別本にしない)。復元率は0..1の通しメーター。級の合格は同じ本の大きな節目。
//  ・承=学習で少しずつ復元(sceneが綺麗になる) / 転=修復率が節目(20/40/60/80/100%)に達すると小ストーリーが1つ読める。
//  ・小ストーリー=復元されたページに蘇る「古代の記録官の覚書」。過去の記録官と現在の記録官(桜=あなた)を時を越えて結ぶ。
//    戦記でなく名もなき日常(筆と道具/方言と味/夜の灯り/未来へのメッセージ)。個人名なし・国際ボーダーレス。相棒は柴犬。
//  ・結(100%)=古代記録官が筆を託す→あなたが最後の頁を書く=書庫完成・未来への記録として残す。
//  ・言霊/お守り/運命は不採用: 文字は魔法でなく人の記録・持ち物で守られない・宿命でなく時間の摩耗(誰も悪くない)。
//  ・進捗の源は呼び出し側が決める(この関数は percent 0..1 を取るだけ=P0各モジュールと同じ純関数の作法)。
//    推奨=全級ならしの book 進捗(bookProgress)。演出の見せ方(full/short/none)は decay.ts が別途担当。
// 仕様: docs/superpowers/specs/2026-07-28-書斎ストーリー-design.md(物語背骨の追補) / 記憶: story-axis-is-restoration-not-wish

function clamp01(x: number): number {
  const n = Number.isFinite(x) ? x : 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

// 復元の段(0=手つかず 〜 5=完成)。辞書の成長(頁→厚み→表紙→しおり→ケース)と書庫の要素を1本のはしごに統合=絵の順序。
export interface Stage { index: number; dict: string; scene: string; label: string }
export const STAGES: readonly Stage[] = [
  { index: 0, dict: '最初の一頁だけ読める辞書', scene: '荒れた書庫',   label: '旅のはじまり' },
  { index: 1, dict: 'ページが修復されはじめる', scene: '本棚が直る',   label: '一頁ずつ' },
  { index: 2, dict: '本が厚くなる',             scene: '照明が灯る',   label: '厚みが出る' },
  { index: 3, dict: '表紙が豪華になる',         scene: '庭が整う',     label: '装いが整う' },
  { index: 4, dict: 'しおりが増える',           scene: '桜が咲く',     label: 'あと少し' },
  { index: 5, dict: 'ケースができて完成',       scene: '水路が流れる', label: '完成' },
];

const THRESHOLDS = [0, 0.2, 0.4, 0.6, 0.8, 1.0] as const;

/** 復元率(0..1) → 段(0..5)。1.0以上で完成(5)。NaN/負値は0。 */
export function stageOf(percent: number): number {
  const p = clamp01(percent);
  let s = 0;
  for (let i = 0; i < THRESHOLDS.length; i++) if (p >= THRESHOLDS[i]) s = i;
  return s;
}

/** この本の復元率(0..1)。UIのバー用。 */
export function restorationPercent(percent: number): number { return clamp01(percent); }

/** 本が完成したか(復元率100%=段5)=結の合図。 */
export function isBookComplete(percent: number): boolean { return clamp01(percent) >= 1; }

// 書庫の各要素が直ったか(ホーム背景・修復工房の段階描画に流用)。節目20/40/60/80/100%で一つずつ綺麗になる。
export interface SceneState { shelf: boolean; light: boolean; garden: boolean; sakura: boolean; water: boolean }
export function sceneStateOf(percent: number): SceneState {
  const s = stageOf(percent);
  return { shelf: s >= 1, light: s >= 2, garden: s >= 3, sakura: s >= 4, water: s >= 5 };
}

/**
 * 全級ならしの「本の復元率」。1冊を旅全体で少しずつ直す想定=節目5つが旅の全体に散る(級ごとに再点火しない)。
 * 各級の合格率(0..1)の平均。欠けた級は0扱い。※現在級のリングに合わせたい時は呼び出し側で percent を差し替えるだけ。
 */
export function bookProgress(passRateByLevel: Partial<Record<string, number>>): number {
  const levels = ['N5', 'N4', 'N3'];
  const sum = levels.reduce((a, lv) => a + clamp01(passRateByLevel[lv] ?? 0), 0);
  return sum / levels.length;
}

// ── 小ストーリー(転)。修復率が節目に達すると、蘇ったページに古代記録官の覚書が浮かぶ。一生に一度ずつ(seenで重複防止)。
//    record=蘇った覚書(記録官の言葉)/sakura=桜の気づき(過去と現在が重なる)/art=挿絵の指針(P1で用意)。
export interface SmallStory {
  id: string;
  threshold: number; // この復元率で解禁
  theme: string;
  title: string;
  record: string[];  // 蘇った覚書(短い数行)
  sakura: string;    // 桜の気づき
  art: string;       // 挿絵の指針(P1・要素材)
}

export const SMALL_STORIES: readonly SmallStory[] = [
  {
    id: 'story.1', threshold: 0.2,
    theme: '筆の選び方と、お気に入りの道具', title: '旅の道連れ',
    record: [
      '旅の途中、どの木で作った筆が書きやすいか、ずいぶん試した。',
      '雨の日は墨がにじむ。乾かしていたら、相棒の犬が紙を踏んで、足跡が一つ残った。',
    ],
    sakura: 'この昔の記録官も、私と同じことで悩んで、同じように犬に笑わされていたんだ。',
    art: '古い覚書の紙に、柴犬の足跡が一つ。にじんだ墨・旅の筆。ユーモラスで温かい。',
  },
  {
    id: 'story.2', threshold: 0.4,
    theme: '失われかけた方言と、美味しかったもの', title: '名もなき季節の記録',
    record: [
      '山あいの村で食べた、栗の木の蜂蜜が甘かった。',
      '祖母が使っていた温かい方言も、書き留めておく。',
      '役に立つからではない。ただ、美しかったから残す。',
    ],
    sakura: 'こんな些細なことまで——。この人は本当に、この国の暮らしが好きだったんだ。',
    art: '素朴な村の食卓・蜂蜜・古い言葉の走り書き。効率でなく愛おしさ。',
  },
  {
    id: 'story.3', threshold: 0.6,
    theme: '暗い夜、ひとりで文字を綴る孤独と温もり', title: '筆を置く夜の灯り',
    record: [
      '旅の空の下、ランプの油が切れそうで焦った。',
      'それでも、窓の外の虫の音が心地よかった。',
      '夜更けに一人、文字を綴っている。',
    ],
    sakura: '時が離れていても、同じ灯りの下で筆を動かしている仲間がいる。',
    art: '夜・小さなランプ・机に向かう記録官の後ろ姿。今の書斎の桜と重なる構図。',
  },
  {
    id: 'story.4', threshold: 0.8,
    theme: '言葉を、未来の誰かへ伝えること', title: '誰かのための言葉',
    record: [
      '遠い未来の、誰かへ。',
      'この国の景色や、人々の笑顔が、君の時代にも届いていますように。',
      'いつか本が傷むと感じながら——それでも、未来を信じて書いている。',
    ],
    sakura: '私の勉強も、試験のためだけじゃない。古い文化を、正しく受け継ぐためなんだ。',
    art: '寄せ書きのようなページ・遠くの景色・光。編纂者たちの祈り。',
  },
  {
    id: 'story.final', threshold: 1.0,
    theme: '筆を託す', title: 'ここから先は、君の記録',
    record: [
      'よくここまで直してくれた。',
      '最後の頁は、わざと空けてある。',
      'ここから先は、君の記録だ。続けてくれ。',
    ],
    sakura: '時を越えて、二人の記録官の手がつながった。——次を書くのは、私だ。',
    art: '完成した辞書と綺麗になった書庫全景。空白の最後の頁に、今の筆が触れる。',
  },
];

/**
 * いま読める新しい小ストーリーを1つ返す(転)。解禁済み(threshold≤percent)で未読の、最も低い節目のもの。
 * seen に無いものだけ。無ければ null。呼び出し側が見せたら id を seen へ積む(markで永続)。
 * 節目に達した時だけ現れる=自然に間隔が空く(毎回は出ない=中だるみ回避)。飛ばしても取りこぼさない。
 */
export function dueStory(opts: { percent: number; seen?: readonly string[] }): SmallStory | null {
  const p = clamp01(opts.percent);
  const seen = opts.seen ?? [];
  for (const st of SMALL_STORIES) { // threshold昇順で定義済み
    if (st.threshold <= p && !seen.includes(st.id)) return st;
  }
  return null;
}
