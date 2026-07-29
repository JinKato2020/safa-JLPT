// 書庫＝復元エンジン(純関数)。物語の背骨「一冊の辞書を完成させ、書庫を元通りにする」を、絵ゼロで駆動する土台。
//  ・軸は"願い"でなく"復元"=全員同じゴール・分岐なし(任天堂型の単一目標: ゼルダ=姫/ポケモン=図鑑/どうぶつの森=島)。
//    願いは軸から降りて"栞"=時々触れる動機付け(台詞は voice.ts が担当)。ここは物語の骨だけを持つ。
//  ・承=学習で少しずつ復元 / 転=合格率が段(stage)を上がるたびに記録官の記録が1つ読める / 結=全巻完成→書庫に残す。
//  ・進捗の源=その級の合格率(ladder/passRate.passProbability)。ここはそれを"入力に取るだけ"(P0各モジュールと同じ作法)。
//  ・演出の見せ方(full/short/none)は decay.ts が別途担当。ここは「どこまで直ったか」と「次に読める記録」だけを決める。
//  ・言霊/お守り/運命は不採用(ユーザー確定)。文字は魔法でなく人の暮らしの記録・持ち物で守られない・宿命でなく時間の摩耗。
// 仕様: docs/superpowers/specs/2026-07-28-書斎ストーリー-design.md(物語背骨の追補)
import type { Level } from '../ladder/facets';

// 復元できる巻=JLPT各級(1級=1巻)。低い級から順に直す。N2/N1やJFTは巻を持たない(物語は休止=安全にnull/0扱い)。
export const RESTORABLE_LEVELS: readonly Level[] = ['N5', 'N4', 'N3'];

// 復元の段(0=手つかず 〜 5=完成)。ユーザーの2つの列(辞書の成長/書庫の要素)を1本のはしごに統合=絵の差し替え順序。
export interface Stage {
  index: number; // 0..5
  dict: string;  // 辞書がこの段でどう見えるか(絵の指針)
  scene: string; // この段で直る書庫の要素(本棚→照明→庭→桜→水路)
  label: string; // UIの短い見出し
}

// 6段。閾値は合格率 0/.2/.4/.6/.8/1.0。辞書の成長(頁→厚み→表紙→しおり→ケース)と書庫の要素を対応。
export const STAGES: readonly Stage[] = [
  { index: 0, dict: '最初の一頁だけ読める辞書', scene: '荒れた書庫',   label: '旅のはじまり' },
  { index: 1, dict: 'ページが修復されはじめる', scene: '本棚が直る',   label: '一頁ずつ' },
  { index: 2, dict: '本が厚くなる',             scene: '照明が灯る',   label: '厚みが出る' },
  { index: 3, dict: '表紙が豪華になる',         scene: '庭が整う',     label: '装いが整う' },
  { index: 4, dict: 'しおりが増える',           scene: '桜が咲く',     label: 'あと少し' },
  { index: 5, dict: 'ケースができて完成',       scene: '水路が流れる', label: '完成' },
];

const THRESHOLDS = [0, 0.2, 0.4, 0.6, 0.8, 1.0] as const;

function clamp01(x: number): number { return x < 0 ? 0 : x > 1 ? 1 : x; }

/** 合格率(0..1) → 復元の段(0..5)。1.0以上で完成(5)。NaN/負値は0に丸める。 */
export function stageOf(passRate: number): number {
  const p = clamp01(Number.isFinite(passRate) ? passRate : 0);
  let s = 0;
  for (let i = 0; i < THRESHOLDS.length; i++) if (p >= THRESHOLDS[i]) s = i;
  return s;
}

/** この巻の復元率(0..1)。UIのバー用。合格率をそのまま採る(中央%=試験タブの評価軸に一致)。 */
export function restorationPercent(passRate: number): number {
  return clamp01(Number.isFinite(passRate) ? passRate : 0);
}

/** この巻が完成したか(合格率100%=段5)。 */
export function isVolumeComplete(passRate: number): boolean {
  return restorationPercent(passRate) >= 1;
}

// 書庫の各要素が直ったか(ホーム背景の段階描画に流用)。段が上がるほど要素が増える。
export interface SceneState { shelf: boolean; light: boolean; garden: boolean; sakura: boolean; water: boolean }
export function sceneStateOf(passRate: number): SceneState {
  const s = stageOf(passRate);
  return { shelf: s >= 1, light: s >= 2, garden: s >= 3, sakura: s >= 4, water: s >= 5 };
}

// 記録官の記録(転)。段が上がるたびに1つ読める=世界のかけら。戦記でなく名もなき日常(個人名なし・国際ボーダーレス)。
// 全巻(3)×段(1..5)=15個。順序=巻(N5→N4→N3)×段(1→5)。1文・絵文字なし。テーマ=季節/山川/暮らし/方言/祭り/料理/子の遊び。
export interface Chronicle { id: string; text: string }
export const LIBRARY_CHRONICLES: readonly Chronicle[] = [
  // N5巻(段1..5)
  { id: 'chron.1',  text: '春は、どの家も戸を開けて風を通した。' },
  { id: 'chron.2',  text: '川の名は、曲がる形をそのまま呼んだ。' },
  { id: 'chron.3',  text: '朝は、井戸のまわりから声が始まった。' },
  { id: 'chron.4',  text: '同じ物でも、隣の村では別の名で呼んだ。' },
  { id: 'chron.5',  text: '祭りの日は、子どもが一番早く起きた。' },
  // N4巻(段1..5)
  { id: 'chron.6',  text: '山は、季節ごとに色の名を変えて呼ばれた。' },
  { id: 'chron.7',  text: '米を炊く匂いで、夕の刻がわかった。' },
  { id: 'chron.8',  text: '海の近くでは、雲を見て天気を決めた。' },
  { id: 'chron.9',  text: '古い言い回しは、年寄りだけが覚えていた。' },
  { id: 'chron.10', text: '雪の夜は、家族が一つの部屋に集まった。' },
  // N3巻(段1..5)
  { id: 'chron.11', text: '子どもの遊びには、土地ごとの数え歌があった。' },
  { id: 'chron.12', text: '峠の茶屋は、旅人の話を集める場所だった。' },
  { id: 'chron.13', text: '祝いの料理は、その土地で採れる物で決まった。' },
  { id: 'chron.14', text: '川の水音は、季節でわずかに高さを変えた。' },
  { id: 'chron.15', text: '別れの挨拶にも、土地ごとの言葉があった。' },
];

// 巻index(0..)×段(1..5) → 記録の通し番号(0..14)。範囲外は-1。
function chronicleOrdinal(level: Level, stage: number): number {
  const vi = RESTORABLE_LEVELS.indexOf(level);
  if (vi < 0 || stage < 1 || stage > 5) return -1;
  return vi * 5 + (stage - 1);
}

/**
 * いま読める新しい記録官の記録を1つ返す(転)。到達した段のうち、未読で最も低い段の記録。
 * seen に無いものだけを返す。無ければ null。呼び出し側が見せたら id を seen へ積む(markで永続)。
 * 段が上がった時だけ現れる=自然に間隔が空く(毎回は出ない=中だるみ回避)。段を飛ばしても取りこぼさない。
 */
export function dueChronicle(opts: { level: Level; passRate: number; seen?: readonly string[] }): Chronicle | null {
  const reached = stageOf(opts.passRate);
  const seen = opts.seen ?? [];
  for (let stage = 1; stage <= reached; stage++) {
    const ord = chronicleOrdinal(opts.level, stage);
    if (ord < 0) continue;
    const c = LIBRARY_CHRONICLES[ord];
    if (c && !seen.includes(c.id)) return c;
  }
  return null;
}

/** 全巻が完成したか(結=書庫完成・未来への記録)。各級の合格率マップを受ける。 */
export function isLibraryComplete(passRateByLevel: Partial<Record<string, number>>): boolean {
  return RESTORABLE_LEVELS.every((lv) => isVolumeComplete(passRateByLevel[lv] ?? 0));
}
