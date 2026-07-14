// app/tools/content/migrate_nested.ts — ネスト構造(読解/聴解/knowledgeBank/lexicon)の新形式変換。
import { type ContentFile, type ContentItem, type LexiconFile } from './schema.ts';

const groupBy = <T>(rows: T[], key: (r: T) => string): Map<string, T[]> => {
  const m = new Map<string, T[]>();
  for (const r of rows) { const k = key(r); (m.get(k) ?? m.set(k, []).get(k)!).push(r); }
  return m;
};

// knowledgeBank は生成バンクの「生の実体」(context/usage/grammar_form/order/passage_grammar が同居)。
// アプリ(daimon.ts)が後段で ambiguous order と passage_grammar を除外して使うため、ここでは
// フィルタも大問分割もせず、全daimon・全フィールドを保存してレベル別1ファイルにする(挙動不変・pointId等を維持)。
export function splitKnowledgeBank(kb: any[]): ContentFile[] {
  const out: ContentFile[] = [];
  for (const [level, lrows] of groupBy(kb, (r) => r.level)) {
    const items: ContentItem[] = lrows.map((r) => ({ ...r, i18n: {} }));
    out.push({ schema: 1, daimon: 'knowledgebank', level, languages: ['ja', 'ne'], items });
  }
  return out;
}
// 言語非依存フィールド(format/category/type/title/body/subtype/level 等)は全保存(spread)。
// 設問の explain(JA)は q.i18n.ja.explain へ移設。passageTransNe[id](行配列)は i18n.ne.body へ配列のまま格納。
export function readingToFiles(reading: any[], passageTransNe: Record<string, unknown>): ContentFile[] {
  const out: ContentFile[] = [];
  for (const [subtype, srows] of groupBy(reading, (r) => r.subtype)) {
    for (const [level, lrows] of groupBy(srows, (r) => r.level)) {
      const items: ContentItem[] = lrows.map((r) => {
        const { questions, ...rest } = r;
        const i18n: ContentItem['i18n'] = {};
        const pv = passageTransNe[r.id];
        if (pv) i18n.ne = { body: pv as string[] };
        return {
          ...rest,
          questions: (questions ?? []).map((q: any) => { const { explain, ...qr } = q; return { ...qr, i18n: explain ? { ja: { explain } } : {} }; }),
          i18n,
        };
      });
      out.push({ schema: 1, daimon: subtype, level, languages: ['ja', 'ne'], items });
    }
  }
  return out;
}
// 文章の文法=passageGrammar.json(セット形式)。1セット=1item(passages＋questions)。level分割。
// passageTransNe は読解＋文章の文法の両方の本文訳(行配列)を持つ。pgセット分は i18n.ne.body へ格納。
export function passageGrammarToFiles(pg: any[], passageTransNe: Record<string, unknown> = {}): ContentFile[] {
  const out: ContentFile[] = [];
  for (const [level, lrows] of groupBy(pg, (r) => r.level)) {
    const items: ContentItem[] = lrows.map((r) => {
      const { questions, ...rest } = r;
      const i18n: ContentItem['i18n'] = {};
      const pv = passageTransNe[r.id];
      if (pv) i18n.ne = { body: pv as string[] };
      return { ...rest, questions: (questions ?? []).map((q: any) => ({ ...q, i18n: {} })), i18n };
    });
    out.push({ schema: 1, daimon: 'passage_grammar', level, languages: ['ja', 'ne'], items });
  }
  return out;
}
export function listeningToFiles(listening: any[]): ContentFile[] {
  const out: ContentFile[] = [];
  for (const [subtype, srows] of groupBy(listening, (r) => r.subtype)) {
    for (const [level, lrows] of groupBy(srows, (r) => r.level)) {
      const items: ContentItem[] = lrows.map((r) => {
        const { questions, ...rest } = r;
        return {
          ...rest,
          questions: (questions ?? []).map((q: any) => { const { explain, ...qr } = q; return { ...qr, i18n: explain ? { ja: { explain } } : {} }; }),
          i18n: {},
        };
      });
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
