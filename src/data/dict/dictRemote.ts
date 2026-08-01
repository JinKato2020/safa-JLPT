// 共有辞書(汎用日本語辞書)の「単一ソース」取得層。
//  ・正本は1か所(GitHub Pages /dict/)に公開し、JLPT・App B が同じURLから取得＋端末キャッシュ。
//    ＝コピーを同期するのではなく「同じデータを共有」(音声 listeningAudio.ts と同型)。
//  ・配信元は DICT_BASE_URL 差し替えだけで移行可。Web は fetch 直(ブラウザキャッシュ任せ)。
//  ・manifest.version 差分でキャッシュを更新(中身が変われば両アプリへ即反映)。
//  公開: ワークフロー deploy-pages が app/dict/ を _site/dict/ へコピー。正本生成: data-build/dict/。
import * as FileSystemNS from 'expo-file-system/legacy';
import { Platform } from 'react-native';

// 配信元(GitHub Pages)。repo/移行時はこの1行だけ差し替え。App B も同じURLを使う。
export const DICT_BASE_URL = 'https://jinkato2020.github.io/safa-JLPT/dict/';
export const DICT_FILES = ['ja-vocab.json', 'ja-kanji.json', 'ja-synonyms.json', 'ja-examples.json', 'ja-kanji-examples.json'] as const;

const FS = FileSystemNS as unknown as {
  documentDirectory?: string | null;
  makeDirectoryAsync?: (uri: string, opts?: { intermediates?: boolean }) => Promise<void>;
  getInfoAsync?: (uri: string) => Promise<{ exists: boolean }>;
  downloadAsync?: (url: string, dest: string) => Promise<{ uri: string }>;
  readAsStringAsync?: (uri: string) => Promise<string>;
};
const cacheDir = Platform.OS !== 'web' && FS.documentDirectory ? `${FS.documentDirectory}dict/` : null;
/** キャッシュ可能な端末か(web等はfetch直＝事前DL不要)。 */
export const DICT_CACHEABLE = !!cacheDir
  && typeof FS.downloadAsync === 'function'
  && typeof FS.getInfoAsync === 'function'
  && typeof FS.readAsStringAsync === 'function';

let dirReady = false;
async function ensureDir(): Promise<void> {
  if (!cacheDir || dirReady) return;
  try { await FS.makeDirectoryAsync?.(cacheDir, { intermediates: true }); } catch { /* 既存等は無視 */ }
  dirReady = true;
}

/** 1ファイル取得。キャッシュ優先→無ければDL→キャッシュ。web/非対応端末や失敗時は fetch 直。 */
async function getJson<T>(name: string): Promise<T> {
  const url = `${DICT_BASE_URL}${name}`;
  if (!DICT_CACHEABLE) { const r = await fetch(url); return (await r.json()) as T; }
  try {
    await ensureDir();
    const local = `${cacheDir}${name}`;
    const info = await FS.getInfoAsync!(local);
    if (!info?.exists) await FS.downloadAsync!(url, local);
    return JSON.parse(await FS.readAsStringAsync!(local)) as T;
  } catch {
    const r = await fetch(url); return (await r.json()) as T;
  }
}

export type DictManifest = { name?: string; version: string; syncedAt?: string; counts?: Record<string, unknown> };

/** 配信元の manifest(version) を取得。オフライン時は null。 */
export async function remoteDictManifest(): Promise<DictManifest | null> {
  try { const r = await fetch(`${DICT_BASE_URL}manifest.json`, { cache: 'no-store' as RequestCache }); return (await r.json()) as DictManifest; }
  catch { return null; }
}

/** キャッシュ済みの manifest(version)。未取得は null。 */
async function cachedDictManifest(): Promise<DictManifest | null> {
  if (!DICT_CACHEABLE) return null;
  try {
    const info = await FS.getInfoAsync!(`${cacheDir}manifest.json`);
    if (!info?.exists) return null;
    return JSON.parse(await FS.readAsStringAsync!(`${cacheDir}manifest.json`)) as DictManifest;
  } catch { return null; }
}

/** 配信元の version とキャッシュを突き合わせ、変化していれば全ファイル更新。初回/更新確認時に呼ぶ。
 *  返り値: 'updated'(DLした) | 'fresh'(既に最新) | 'offline'(配信元に届かずキャッシュ据え置き) | 'web'(キャッシュ非対応)。 */
export async function syncDictCache(onProgress?: (done: number, total: number) => void): Promise<'updated' | 'fresh' | 'offline' | 'web'> {
  if (!DICT_CACHEABLE) { onProgress?.(1, 1); return 'web'; }
  await ensureDir();
  const [remote, cached] = await Promise.all([remoteDictManifest(), cachedDictManifest()]);
  if (!remote) { onProgress?.(1, 1); return 'offline'; }
  const need = !cached || cached.version !== remote.version;
  const files = [...DICT_FILES, 'manifest.json'];
  let done = 0;
  for (const f of files) {
    try {
      const local = `${cacheDir}${f}`;
      const info = await FS.getInfoAsync!(local);
      if (need || !info?.exists) await FS.downloadAsync!(`${DICT_BASE_URL}${f}`, local);
    } catch { /* 個別失敗は次回再試行 */ }
    onProgress?.(++done, files.length);
  }
  return need ? 'updated' : 'fresh';
}

export type SharedDictVocab = { word: string; reading: string; level: string; gloss?: string; senses?: string[]; pos?: string[]; pri?: string[] };
export type SharedDictKanji = { char: string; on?: string[]; kun?: string[]; meanings?: string[]; grade?: number; strokes?: number; freq?: number };
export type SharedDict = {
  vocab: SharedDictVocab[];
  kanji: SharedDictKanji[];
  synonyms: Record<string, string>;
  examples: Record<string, { ja: string; en: string }>;      // "語|読み" → 例文
  kanjiExamples: Record<string, { on?: unknown[]; kun?: unknown[] }>;
};

/** 共有辞書を一括ロード(キャッシュ優先)。App B も同じ DICT_BASE_URL から同じ形で読める。 */
export async function loadSharedDict(): Promise<SharedDict> {
  const [vocab, kanji, synonyms, examples, kanjiExamples] = await Promise.all([
    getJson<SharedDictVocab[]>('ja-vocab.json'),
    getJson<SharedDictKanji[]>('ja-kanji.json'),
    getJson<Record<string, string>>('ja-synonyms.json'),
    getJson<Record<string, { ja: string; en: string }>>('ja-examples.json'),
    getJson<Record<string, { on?: unknown[]; kun?: unknown[] }>>('ja-kanji-examples.json'),
  ]);
  return { vocab, kanji, synonyms, examples, kanjiExamples };
}
