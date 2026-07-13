// app/tools/content/build_content.ts — 既存バンクを読み新content/ツリー＋manifest＋READMEを生成し検証する。
// 実行: cd app && node --import tsx tools/content/build_content.ts        (書き出し)
//       cd app && node --import tsx tools/content/build_content.ts --check (検証のみ)
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { DAIMON_SPEC, DAIMON_LABELS, type ContentFile, type LexiconFile } from './schema.ts';
import { groupToFiles } from './migrate_problems.ts';
import { splitKnowledgeBank, readingToFiles, listeningToFiles, passageGrammarToFiles, lexiconToFiles } from './migrate_nested.ts';
import { buildManifest } from './manifest.ts';
import { checkIdsUnique, checkLangCompleteness, checkOrphanLexicon } from './validate.ts';

const R = (p: string) => JSON.parse(readFileSync(join('src/data', p), 'utf8'));
const OUT = 'content';

function main() {
  const checkOnly = process.argv.includes('--check');
  const files: Record<string, { text: string; count: number }> = {};
  const problemFiles: ContentFile[] = [];
  const lexFiles: LexiconFile[] = [];

  // 単票バンク(文字語彙)
  const SRC: Record<string, string> = { kanji_read: 'exam/kanjiReadingBank.json', orthography: 'exam/orthographyBank.json', context: 'exam/contextBank.json', synonym: 'exam/synonymBank.json' };
  for (const spec of DAIMON_SPEC) {
    if (!SRC[spec.daimon]) continue; // knowledgeBank由来(usage/grammar_form/order)は別処理
    for (const f of groupToFiles(R(SRC[spec.daimon]), spec)) problemFiles.push(f);
  }
  // knowledgeBank(usage/grammar_form/order)＋文章の文法(passageGrammar.json)
  for (const f of splitKnowledgeBank(R('exam/knowledgeBank.json'))) problemFiles.push(f);
  for (const f of passageGrammarToFiles(R('exam/passageGrammar.json'))) problemFiles.push(f);
  // 読解・聴解
  for (const f of readingToFiles(R('exam/reading.json'), R('exam/passageTransNe.json'))) problemFiles.push(f);
  for (const f of listeningToFiles(R('exam/listening.json'))) problemFiles.push(f);
  // lexicon(漢字1字キーは kanji.json の級で解決)
  const kanjiLevel: Record<string, string> = Object.fromEntries((R('dict/kanji.json') as any[]).map((k) => [k.char, k.level]));
  const levelOf = (key: string): string => {
    const m = key.match(/^n([1-5])-/); if (m) return 'N' + m[1];
    return kanjiLevel[key] ?? 'N?';
  };
  for (const f of lexiconToFiles(R('dict/meaningL10n.json'), 'meaning', levelOf)) lexFiles.push(f);
  for (const f of lexiconToFiles(R('dict/exampleL10n.json'), 'example', levelOf)) lexFiles.push(f);

  // ファイルパス割付(daimon→フォルダ)
  const FOLDER: Record<string, string> = {};
  for (const s of DAIMON_SPEC) FOLDER[s.daimon] = s.folder;
  for (const d of ['grammar_form', 'order', 'passage_grammar']) FOLDER[d] = 'bunpou';
  for (const d of ['naiyou_tan', 'naiyou_chu', 'choubun', 'joho']) FOLDER[d] = 'dokkai';
  for (const d of ['kadai', 'point', 'gaiyou', 'hatsuwa', 'sokuji']) FOLDER[d] = 'choukai';

  for (const f of problemFiles) files[`problems/${FOLDER[f.daimon]}/${f.daimon}_${f.level}.json`] = { text: JSON.stringify(f), count: f.items.length };
  for (const f of lexFiles) files[`lexicon/${f.kind}_${f.level}.json`] = { text: JSON.stringify(f), count: Object.keys(f.items).length };

  // README(日本語対応表)
  files['README.md'] = {
    text: ['# コンテンツ ファイル対応表', '', '| ファイル接頭辞 | 大問(日本語) |', '|---|---|',
      ...Object.entries(DAIMON_LABELS).map(([k, v]) => `| \`${k}\` | ${v} |`)].join('\n'),
    count: 0,
  };
  // manifest
  const manifest = buildManifest(files, process.env.CONTENT_VERSION ?? 'unset');
  files['_manifest.json'] = { text: JSON.stringify(manifest), count: 0 };

  // 検証(致命): id重複・ja訳の欠け。
  const errs: string[] = [];
  errs.push(...checkIdsUnique(problemFiles).map((x) => `dupId:${x}`));
  for (const f of problemFiles) errs.push(...checkLangCompleteness(f, ['ja'])); // ja必須(neは既存分のみ・他8言語は未生成)
  // 警告(非致命): 孤児lexicon。対象=実在する語彙/漢字(コア＋辞書拡張)。移行は忠実転写なので落とさず報告のみ。
  const ext = R('dict/dictExt.json');
  const lexUniverse = new Set<string>([
    ...(R('shared/vocab.json') as any[]).map((v) => v.id),
    ...(R('dict/kanji.json') as any[]).map((k) => k.char),
    ...((ext.vocab ?? []) as any[]).map((v) => v.id),
    ...((ext.kanji ?? []) as any[]).map((k) => k.char),
  ]);
  const warns: string[] = [];
  for (const f of lexFiles) warns.push(...checkOrphanLexicon(f, lexUniverse).map((x) => `orphan:${f.kind}:${x}`));

  console.log('FILES', Object.keys(files).length, '| PROBLEMS', problemFiles.length, '| LEX', lexFiles.length);
  console.log(problemFiles.map((f) => `${f.daimon}_${f.level}=${f.items.length}`).join(' '));
  if (warns.length) { console.warn('WARN orphan lexicon', warns.length, '(非致命)', warns.slice(0, 8).join(' ')); }
  if (errs.length) { console.error('VALIDATION ERRORS', errs.length); console.error(errs.slice(0, 40).join('\n')); process.exit(1); }
  console.log('VALIDATION OK');

  if (checkOnly) return;
  for (const [rel, { text }] of Object.entries(files)) {
    const path = join(OUT, rel);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text, 'utf8');
  }
  console.log('WROTE', OUT);
}
main();
