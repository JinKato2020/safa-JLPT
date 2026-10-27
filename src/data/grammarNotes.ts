// 文法の「くわしい解説」(サイト app_website の解説を取り込んだもの)の取得層。
//  ・正本生成 = tools/import_grammar_notes.py → web/grammar-notes/<lang>/<id>.json。deploy-pages が配信。
//  ・同梱は「解説がある点のID一覧」だけ(ボタン表示判定)。本文は開いた時に1点×1言語だけ取得(数KB)。
//  ・オンライン時は毎回取得して端末に保存＝サイト更新が即反映。オフライン時は保存済みを表示。
import * as FileSystemNS from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import NOTE_IDS from './grammarNoteIds.json';

export const GRAMMAR_NOTE_BASE_URL = 'https://jlpt.safa-lang.com/grammar-notes/';
const LANGS = new Set(['ja', 'en', 'ne', 'bn', 'id', 'ko', 'my', 'th', 'vi', 'zh', 'zh2']);

export interface GrammarNote {
  id: string;
  title: string;
  summary: string;
  patterns: { form: string; gloss?: string }[];
  body: { h: string; p: string }[];
  examples: { ja: string; romaji?: string; tr?: string; note?: string }[];
  pitfalls: string[];
}

const IDS = new Set<string>(NOTE_IDS as string[]);
/** この文法点に「くわしい解説」があるか。 */
export function hasGrammarNote(id: string): boolean { return IDS.has(id); }

const FS = FileSystemNS as unknown as {
  documentDirectory?: string | null;
  makeDirectoryAsync?: (uri: string, opts?: { intermediates?: boolean }) => Promise<void>;
  readAsStringAsync?: (uri: string) => Promise<string>;
  writeAsStringAsync?: (uri: string, s: string) => Promise<void>;
};
const cacheDir = Platform.OS !== 'web' && FS.documentDirectory ? `${FS.documentDirectory}grammar-notes/` : null;
const mem = new Map<string, GrammarNote>();

async function fetchJson(url: string, ms = 8000): Promise<GrammarNote> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()) as GrammarNote;
  } finally { clearTimeout(timer); }
}

/** 解説を取得(表示言語。対応外は en)。取得も保存済みも無ければ null。 */
export async function loadGrammarNote(id: string, uiLang: string): Promise<GrammarNote | null> {
  const lang = LANGS.has(uiLang) ? uiLang : 'en';
  const key = `${lang}/${id}`;
  const hit = mem.get(key);
  if (hit) return hit;
  const local = cacheDir ? `${cacheDir}${lang}_${id}.json` : null;
  try {
    const note = await fetchJson(`${GRAMMAR_NOTE_BASE_URL}${key}.json`);
    mem.set(key, note);
    if (local) {
      try {
        await FS.makeDirectoryAsync?.(cacheDir!, { intermediates: true });
      } catch { /* 既存は無視 */ }
      FS.writeAsStringAsync?.(local, JSON.stringify(note)).catch(() => {});
    }
    return note;
  } catch {
    if (!local || !FS.readAsStringAsync) return null;
    try {
      const note = JSON.parse(await FS.readAsStringAsync(local)) as GrammarNote;
      mem.set(key, note);
      return note;
    } catch { return null; }
  }
}
