// app/tools/content/validate.ts — 新コンテンツの整合チェック(id一意・訳完全性・manifest一致・孤児lexicon)。
import { DAIMON_SPEC, type ContentFile, type LexiconFile, type Manifest } from './schema.ts';
import { fileEntry } from './manifest.ts';

// item単位で必須の訳フィールド。現状は context/orthography/synonym の explain のみ(DAIMON_SPEC由来)。
// 読解/聴解の explain は設問単位なので item検査の対象外。用法/文法系は解説データ未整備。
const translateFieldsOf = (daimon: string): string[] =>
  DAIMON_SPEC.find((d) => d.daimon === daimon)?.translate ?? [];

export function checkIdsUnique(files: ContentFile[]): string[] {
  const seen = new Set<string>(); const dup = new Set<string>();
  for (const f of files) for (const it of f.items) { if (seen.has(it.id)) dup.add(it.id); seen.add(it.id); }
  return [...dup];
}
export function checkLangCompleteness(file: ContentFile, requiredLangs: string[]): string[] {
  const fields = translateFieldsOf(file.daimon);
  if (!fields.length) return [];
  const miss: string[] = [];
  for (const it of file.items) for (const lang of requiredLangs) for (const fld of fields) {
    if (!it.i18n?.[lang]?.[fld]) miss.push(`${it.id}#${lang}#${fld}`);
  }
  return miss;
}
export function checkManifest(manifest: Manifest, actual: Record<string, { text: string; count: number }>): string[] {
  const errs: string[] = [];
  for (const [path, { text, count }] of Object.entries(actual)) {
    const want = manifest.files[path];
    const got = fileEntry(text, count);
    if (!want) { errs.push(`missing:${path}`); continue; }
    if (want.sha256 !== got.sha256) errs.push(`sha:${path}`);
    if (want.count !== got.count) errs.push(`count:${path}`);
  }
  return errs;
}
export function checkOrphanLexicon(lex: LexiconFile, validIds: Set<string>): string[] {
  return Object.keys(lex.items).filter((k) => !validIds.has(k));
}
