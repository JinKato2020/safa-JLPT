// 1文章＝複数設問の共通モデルと純関数。読解(reading.json)と文章の文法(passageGrammar.json)を統一。
// 情報検索(joho)は figure(軽量な表データ＋注記)を持ち、InfoSearchFigure が描画する。
export interface FigureTable { caption?: string; columns: string[]; rows: string[][] }
export interface FigureBadge { label?: string; value: string }
export interface FigureField { label: string; value: string }
// 情報検索の1ブロック(縦カードで描画)。type ごとに使うフィールドだけ持つ(未使用は省略)。
// route=経路図(N5型)/card=ポスターの1オプション(N4型)/notice=掲示板の1お知らせ(N3型)/table=グリッド。
export interface FigureBlock {
  type: 'route' | 'card' | 'notice' | 'table';
  title?: string;          // ルート名/オプション名/イベント名/お知らせ見出し
  source?: string;         // notice: ＜〜より＞ の出所
  badges?: FigureBadge[];  // 要点チップ(route の 時間/お金 など)
  steps?: string[];        // route: 経路の各地点(順番)。edges で連結表示
  edges?: string[];        // route: steps 間の移動(例「バス 45分」)。長さ = steps.length-1
  fields?: FigureField[];  // card: 曜日/時間/料金/予約 等の key:value 行
  lines?: string[];        // notice: 本文の各行(プローズ)
  table?: FigureTable;     // table: グリッド1枚
  note?: string;           // ブロック個別の※
}
export interface Figure {
  kind?: 'route' | 'poster' | 'board' | 'table'; // 図版全体の型(見出し装飾用・任意)
  header?: string;   // 図版全体の見出し(掲示板名/大学名など)
  intro?: string;    // お知らせ文(段落)
  blocks?: FigureBlock[];  // 新モデル(縦カード)。これがあれば優先描画
  tables?: FigureTable[];  // 後方互換(旧 figure)。blocks が無い時に描画
  notes?: string[];  // 図版全体の※注記
  footer?: string;   // 連絡先など
}
export interface PassageBlock { title?: string; body: string; format?: string }
export interface SetQuestion { id: string; q?: string; blankNo?: number; choices: string[]; answerIndex: number; pointId?: string; explain?: string }
export interface PassageSet {
  id: string;
  level: 'N5' | 'N4' | 'N3';
  kind: 'reading' | 'passage_grammar';
  subtype?: string;
  passages: PassageBlock[];
  questions: SetQuestion[];
  table?: Record<string, string | number>[]; // 旧・情報検索テーブル(後方互換。新規は figure を使う)
  figure?: Figure;                            // 情報検索の図表(表1枚以上＋注記)
}

interface ReadingRaw {
  id: string; level: string; subtype?: string; format?: string; title?: string; body?: string;
  questions: { id: string; q: string; choices: string[]; answerIndex: number; explain?: string }[];
  table?: Record<string, string | number>[];
  figure?: Figure;
}

/** reading.json の1エントリを PassageSet に写像（データ改変なし）。情報検索は figure/table と設問の解説も持ち越す。 */
export function readingToSet(p: ReadingRaw): PassageSet {
  return {
    id: p.id,
    level: p.level as PassageSet['level'],
    kind: 'reading',
    subtype: p.subtype,
    passages: [{ title: p.title, body: p.body ?? '', format: p.format }],
    questions: p.questions.map((q) => ({ id: q.id, q: q.q, choices: q.choices, answerIndex: q.answerIndex, explain: q.explain })),
    ...(p.figure ? { figure: p.figure } : {}),
    ...(p.table ? { table: p.table } : {}),
  };
}

/** 一括採点。answers[i]=選択index or null。全問回答済みで allAnswered。 */
export function gradeSet(answers: (number | null)[], questions: SetQuestion[]): { allAnswered: boolean; correct: boolean[]; correctCount: number } {
  const allAnswered = questions.length > 0 && answers.length === questions.length && answers.every((a) => a !== null);
  const correct = questions.map((q, i) => answers[i] === q.answerIndex);
  const correctCount = correct.filter(Boolean).length;
  return { allAnswered, correct, correctCount };
}
