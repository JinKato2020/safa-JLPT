// app/tools/content/migrate_nested.ts — ネスト構造(読解/聴解/knowledgeBank/lexicon)の新形式変換。
import { type ContentFile, type ContentItem, type LexiconFile } from './schema.ts';

const groupBy = <T>(rows: T[], key: (r: T) => string): Map<string, T[]> => {
  const m = new Map<string, T[]>();
  for (const r of rows) { const k = key(r); (m.get(k) ?? m.set(k, []).get(k)!).push(r); }
  return m;
};

// knowledgeBankにはcontext等も入るが、アプリが実際にknowledgeBankから引くのは usage/grammar_form/order のみ
// (context/kanji_read/表記/言い換えは固定バンク使用)。その3daimonだけを採る。orderはambiguousを除外。
const KB_DAIMONS = new Set(['usage', 'grammar_form', 'order']);
export function splitKnowledgeBank(kb: any[]): ContentFile[] {
  const rows = kb.filter((x) => KB_DAIMONS.has(x.daimon)).filter((x) => !(x.daimon === 'order' && x.ambiguous));
  const out: ContentFile[] = [];
  for (const [daimon, drows] of groupBy(rows, (r) => r.daimon)) {
    for (const [level, lrows] of groupBy(drows, (r) => r.level)) {
      const items: ContentItem[] = lrows.map((r) => ({ id: r.id, stem: r.stem, question: r.question, answer: r.answer, choices: r.choices, i18n: {} }));
      out.push({ schema: 1, daimon, level, languages: ['ja', 'ne'], items });
    }
  }
  return out;
}
// passageTransNe[id] は行ごとの配列(まれに文字列)。i18n.ne.body に改行連結で格納(取りこぼしを避ける)。
export function readingToFiles(reading: any[], passageTransNe: Record<string, unknown>): ContentFile[] {
  const out: ContentFile[] = [];
  for (const [subtype, srows] of groupBy(reading, (r) => r.subtype)) {
    for (const [level, lrows] of groupBy(srows, (r) => r.level)) {
      const items: ContentItem[] = lrows.map((r) => {
        const i18n: ContentItem['i18n'] = {};
        const pv = passageTransNe[r.id];
        if (pv) i18n.ne = { body: Array.isArray(pv) ? pv.join('\n') : String(pv) };
        const questions = (r.questions ?? []).map((q: any) => ({
          id: q.id, q: q.q, choices: q.choices, answerIndex: q.answerIndex,
          i18n: q.explain ? { ja: { explain: q.explain } } : {},
        }));
        return { id: r.id, title: r.title, body: r.body, questions, i18n };
      });
      out.push({ schema: 1, daimon: subtype, level, languages: ['ja', 'ne'], items });
    }
  }
  return out;
}
// 文章の文法=passageGrammar.json(セット形式)。1セット=1item(passages＋questions)。level分割。
export function passageGrammarToFiles(pg: any[]): ContentFile[] {
  const out: ContentFile[] = [];
  for (const [level, lrows] of groupBy(pg, (r) => r.level)) {
    const items: ContentItem[] = lrows.map((r) => ({
      id: r.id, kind: r.kind, passages: r.passages,
      questions: (r.questions ?? []).map((q: any) => ({ id: q.id, blankNo: q.blankNo, choices: q.choices, answerIndex: q.answerIndex, pointId: q.pointId, i18n: {} })),
      i18n: {},
    }));
    out.push({ schema: 1, daimon: 'passage_grammar', level, languages: ['ja', 'ne'], items });
  }
  return out;
}
export function listeningToFiles(listening: any[]): ContentFile[] {
  const out: ContentFile[] = [];
  for (const [subtype, srows] of groupBy(listening, (r) => r.subtype)) {
    for (const [level, lrows] of groupBy(srows, (r) => r.level)) {
      const items: ContentItem[] = lrows.map((r) => ({
        id: r.id, title: r.title, script: r.script, audio: r.audio, audioChoices: r.audioChoices,
        questions: (r.questions ?? []).map((q: any) => ({ id: q.id, q: q.q, choices: q.choices, answerIndex: q.answerIndex, i18n: q.explain ? { ja: { explain: q.explain } } : {} })),
        i18n: {},
      }));
      out.push({ schema: 1, daimon: subtype, level, languages: ['ja', 'ne'], items });
    }
  }
  return out;
}
// meaningL10n は vocab id(n5-v-…)と漢字1字(会 等)が混在。漢字は接頭辞から級が取れないため levelOf で解決する。
export function lexiconToFiles(
  l10n: Record<string, Record<string, string>>,
  kind: 'meaning' | 'example',
  levelOf: (key: string) => string,
): LexiconFile[] {
  const byLevel = groupBy(Object.entries(l10n), ([id]) => levelOf(id));
  return [...byLevel.entries()].filter(([lv]) => lv !== 'N?').map(([level, entries]) => ({
    schema: 1, kind, level, languages: ['ne'], items: Object.fromEntries(entries),
  }));
}
