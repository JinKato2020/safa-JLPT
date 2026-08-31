// app/src/data/content/rehydrate.ts — 新フォーマット(content/)→旧shape(*BANK/READING/...)へ再構成する純関数。
// consumerを変えないため旧フィールド名(explain/explainNe/reason/reasonNe/subtype/level/daimon)を厳密に復元する。
type Any = Record<string, any>;
// pool='mock'(模試専用プール=通常学習に出さない初見文)は wantMock で学習バンクと分離する。
const filesByDaimon = (files: Record<string, Any>, daimon: string, wantMock = false): Any[] =>
  Object.entries(files).filter(([p, f]) => p.startsWith('problems/') && (f as Any).daimon === daimon && (((f as Any).pool === 'mock') === wantMock)).map(([, f]) => f as Any);
const stripI18n = (o: Any): Any => { const { i18n, ...rest } = o; return rest; };
function bankItems(files: Record<string, Any>, daimon: string, map: (it: Any, level: string) => Any, wantMock = false): Any[] {
  const out: Any[] = [];
  for (const f of filesByDaimon(files, daimon, wantMock)) for (const it of f.items) out.push(map(it, f.level));
  return out;
}
// 設問: i18n.ja.explain を旧 explain(必須string)へ戻す。
const restoreQ = (q: Any): Any => { const { i18n, ...rest } = q; return { ...rest, explain: i18n?.ja?.explain ?? '' }; };

export function rehydrateBanks(files: Record<string, Any>) {
  const krMap = (it: Any, level: string) => ({ ...stripI18n(it), level, daimon: 'kanji_read' });
  const KANJI_READ_BANK = bankItems(files, 'kanji_read', krMap);              // 学習(通常)
  const KANJI_READ_MOCK = bankItems(files, 'kanji_read', krMap, true);        // 模試専用プール(初見)
  const ogMap = (it: Any, level: string) => ({ ...stripI18n(it), level, explain: it.i18n?.ja?.explain, explainNe: it.i18n?.ne?.explain });
  const ORTHOGRAPHY_BANK = bankItems(files, 'orthography', ogMap);           // 学習(通常)
  const ORTHOGRAPHY_MOCK = bankItems(files, 'orthography', ogMap, true);     // 模試専用プール(初見)
  const CONTEXT_BANK = bankItems(files, 'context', (it, level) => ({ ...stripI18n(it), level, explain: it.i18n?.ja?.explain, explainNe: it.i18n?.ne?.explain }));
  const CONTEXT_MOCK = bankItems(files, 'context', (it, level) => ({ ...stripI18n(it), level, explain: it.i18n?.ja?.explain, explainNe: it.i18n?.ne?.explain }), true); // 模試専用プール(初見)
  const syMap = (it: Any, level: string) => ({ ...stripI18n(it), level, reason: it.i18n?.ja?.explain, reasonNe: it.i18n?.ne?.explain });
  const SYNONYM_BANK = bankItems(files, 'synonym', syMap);              // 学習(通常)
  const SYNONYM_MOCK = bankItems(files, 'synonym', syMap, true);        // 模試専用プール(初見)
  // 全大問が「大問×レベル=1ファイル」構成(content/problems/<section>/<daimon>_<level>.json)。
  // 分割ファイルの item は level/daimon を持たない(ファイルヘッダ側にある)ので、ここで復元して
  // BankUnit(data/daimon.ts)が要る shape に揃える。pointId/ambiguous は item 側に入っている。
  // 文脈規定は moji_goi/context_*.json のみ、文章の文法は passage_grammar_*.json のセット形式で持つ。
  const BANK_DAIMON = ['usage', 'grammar_form', 'order'] as const;
  const KNOWLEDGE_BANK = BANK_DAIMON.flatMap((daimon) =>
    // order(文の組み立て)は回答後表示用に「正しい文(ja)＋母語の意味(en/ne)」を i18n.{lang}.explain から復元。
    bankItems(files, daimon, (it, level) => ({ ...stripI18n(it), level, daimon, explain: it.i18n?.ja?.explain, explainEn: it.i18n?.en?.explain, explainNe: it.i18n?.ne?.explain })));
  // 用法(⑤)の模試専用プール(初見)。学習の KNOWLEDGE_BANK からは pool='mock' が除外されるので別に取り出す。
  const USAGE_MOCK = bankItems(files, 'usage', (it, level) => ({ ...stripI18n(it), level, daimon: 'usage', explain: it.i18n?.ja?.explain, explainEn: it.i18n?.en?.explain, explainNe: it.i18n?.ne?.explain }), true);
  // 文法形式判断(⑥)の模試専用プール(初見)。学習の KNOWLEDGE_BANK からは pool='mock' が除外されるので別に取り出す。
  const GRAMMAR_FORM_MOCK = bankItems(files, 'grammar_form', (it, level) => ({ ...stripI18n(it), level, daimon: 'grammar_form', explain: it.i18n?.ja?.explain, explainEn: it.i18n?.en?.explain, explainNe: it.i18n?.ne?.explain }), true);
  // 組み立て(⑦)の模試専用プール(初見)。学習の KNOWLEDGE_BANK からは pool='mock' が除外されるので別に取り出す。回答後表示の正しい文は i18n.ja.explain から復元(学習の order と同じ)。
  const ORDER_MOCK = bankItems(files, 'order', (it, level) => ({ ...stripI18n(it), level, daimon: 'order', explain: it.i18n?.ja?.explain, explainEn: it.i18n?.en?.explain, explainNe: it.i18n?.ne?.explain }), true);

  const READING_SUBTYPES = ['naiyou_tan', 'naiyou_chu', 'choubun', 'joho'];
  const LISTENING_SUBTYPES = ['kadai', 'point', 'gaiyou', 'hatsuwa', 'sokuji'];
  const PASSAGE_TRANS_NE: Record<string, string[]> = {};
  const PASSAGE_TRANS_EN: Record<string, string[]> = {};
  // 設問・選択肢の訳(内容理解のみ)。key=設問id → { q, choices[](元の順序) }。回答後に母語/英語で表示。
  const Q_TRANS_NE: Record<string, { q: string; choices: string[] }> = {};
  const Q_TRANS_EN: Record<string, { q: string; choices: string[] }> = {};
  const readingMap = (st: string) => (it: Any, level: string) => {
    const { i18n, questions, ...rest } = it;
    if (i18n?.ne?.body) PASSAGE_TRANS_NE[it.id] = i18n.ne.body;
    if (i18n?.en?.body) PASSAGE_TRANS_EN[it.id] = i18n.en.body;
    for (const q of (questions ?? [])) {
      if (q.i18n?.ne?.q) Q_TRANS_NE[q.id] = { q: q.i18n.ne.q, choices: q.i18n.ne.choices ?? [] };
      if (q.i18n?.en?.q) Q_TRANS_EN[q.id] = { q: q.i18n.en.q, choices: q.i18n.en.choices ?? [] };
    }
    return { ...rest, level, subtype: st, questions: (questions ?? []).map(restoreQ) };
  };
  const READING = READING_SUBTYPES.flatMap((st) => bankItems(files, st, readingMap(st)));
  // 読解4大問(⑨〜⑫)の模試専用プール(初見)。翻訳/ルビは後日OTAバッチ。同じ readingMap を通すので将来の ne/en も自動捕捉。
  const READING_MOCK = READING_SUBTYPES.flatMap((st) => bankItems(files, st, readingMap(st), true));
  const LISTENING = LISTENING_SUBTYPES.flatMap((st) => bankItems(files, st, (it, level) => {
    const { i18n, questions, ...rest } = it;
    return { ...rest, level, subtype: st, questions: (questions ?? []).map(restoreQ) };
  }));
  const pgMap = (it: Any, level: string) => {
    const { i18n, questions, ...rest } = it;
    if (i18n?.ne?.body) PASSAGE_TRANS_NE[it.id] = i18n.ne.body; // pgセットの本文訳も PASSAGE_TRANS_NE へ
    if (i18n?.en?.body) PASSAGE_TRANS_EN[it.id] = i18n.en.body;
    // 文章の文法は設問文が無い(空所【n】が設問)ので選択肢訳のみ。q='' で PassageSetPlayer の選択肢下に訳を出す。
    for (const q of (questions ?? [])) {
      if (q.i18n?.ne?.choices) Q_TRANS_NE[q.id] = { q: '', choices: q.i18n.ne.choices };
      if (q.i18n?.en?.choices) Q_TRANS_EN[q.id] = { q: '', choices: q.i18n.en.choices };
    }
    return { ...rest, level, questions: (questions ?? []).map((q: Any) => { const { i18n: _q, ...qr } = q; return qr; }) };
  };
  const PASSAGE_GRAMMAR = bankItems(files, 'passage_grammar', pgMap);
  // 文章の文法(⑧)の模試専用プール(初見)。学習セット(passageGrammarSetsFor)と別に持ち、MockScreenが exam でのみ使う。
  const PASSAGE_GRAMMAR_MOCK = bankItems(files, 'passage_grammar', pgMap, true);

  const mergeLex = (kind: string): Record<string, Any> => {
    const out: Record<string, Any> = {};
    for (const [p, f] of Object.entries(files)) if (p.startsWith('lexicon/') && (f as Any).kind === kind) Object.assign(out, (f as Any).items);
    return out;
  };
  return { KANJI_READ_BANK, KANJI_READ_MOCK, ORTHOGRAPHY_BANK, ORTHOGRAPHY_MOCK, CONTEXT_BANK, CONTEXT_MOCK, SYNONYM_BANK, SYNONYM_MOCK, USAGE_MOCK, GRAMMAR_FORM_MOCK, ORDER_MOCK, KNOWLEDGE_BANK, READING, READING_MOCK, LISTENING, PASSAGE_GRAMMAR, PASSAGE_GRAMMAR_MOCK, MEANING_L10N: mergeLex('meaning'), EXAMPLE_L10N: mergeLex('example'), KANJIGLOSS_L10N: mergeLex('kanjigloss'), FURIGANA_L10N: mergeLex('furigana'), VOCAB_FIX: mergeLex('vocabfix'), KANJI_FIX: mergeLex('kanjifix'), GRAMMAR_FIX: mergeLex('grammarfix'), PASSAGE_TRANS_NE, PASSAGE_TRANS_EN, Q_TRANS_NE, Q_TRANS_EN };
}
