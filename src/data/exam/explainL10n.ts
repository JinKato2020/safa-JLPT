// 非日本語解説のランタイムローダー。1言語=1ファイルをPagesから取得→端末キャッシュ→メモリ。
// 要求言語→ja フォールバック。取得失敗は握りつぶす(必ずjaで表示可能)。UI専用(nativeFS依存)。
import { Platform } from 'react-native';
import * as FileSystemNS from 'expo-file-system/legacy';
import { resolveExplain } from './explainJa';
import { explainL10nUrl } from '../audioBase';

interface FSLike {
  documentDirectory?: string | null;
  makeDirectoryAsync?: (uri: string, opts?: { intermediates?: boolean }) => Promise<void>;
  getInfoAsync?: (uri: string) => Promise<{ exists: boolean }>;
  readAsStringAsync?: (uri: string) => Promise<string>;
  writeAsStringAsync?: (uri: string, contents: string) => Promise<void>;
}
const FS = FileSystemNS as unknown as FSLike;

const EXPLAIN_CACHE_VERSION = 1; // 内容更新時に+1で端末l10nキャッシュを破棄
const mem = new Map<string, Record<string, string>>(); // lang → {id: 訳}
const cacheDir = Platform.OS !== 'web' && FS.documentDirectory ? `${FS.documentDirectory}l10n/` : null;
let versionChecked = false;

async function ensureCacheVersion(): Promise<void> {
  if (versionChecked || !cacheDir) return;
  versionChecked = true;
  const marker = `${FS.documentDirectory}l10n_cache.v`;
  try {
    let ver = '';
    const info = await FS.getInfoAsync?.(marker);
    if (info?.exists) { try { ver = (await FS.readAsStringAsync?.(marker)) ?? ''; } catch { /* noop */ } }
    if (ver !== String(EXPLAIN_CACHE_VERSION)) {
      try { await FS.makeDirectoryAsync?.(cacheDir, { intermediates: true }); } catch { /* noop */ }
      try { await FS.writeAsStringAsync?.(marker, String(EXPLAIN_CACHE_VERSION)); } catch { /* noop */ }
    }
  } catch { /* noop */ }
}

/** 1言語ぶんの解説マップを取得してメモリ＋端末キャッシュに載せる。失敗は握りつぶす。 */
export async function prefetchExplain(lang: string): Promise<void> {
  if (lang === 'ja' || mem.has(lang)) return;
  await ensureCacheVersion();
  const file = cacheDir ? `${cacheDir}explain.${lang}.json` : null;
  // 1) 端末キャッシュ
  if (file) {
    try {
      const info = await FS.getInfoAsync?.(file);
      if (info?.exists) {
        const raw = await FS.readAsStringAsync?.(file);
        if (raw) { mem.set(lang, JSON.parse(raw)); return; }
      }
    } catch { /* noop */ }
  }
  // 2) Pages取得→キャッシュ
  try {
    const res = await fetch(explainL10nUrl(lang));
    if (!res.ok) return;
    const map = (await res.json()) as Record<string, string>;
    mem.set(lang, map);
    if (file && cacheDir) {
      try { await FS.makeDirectoryAsync?.(cacheDir, { intermediates: true }); } catch { /* noop */ }
      try { await FS.writeAsStringAsync?.(file, JSON.stringify(map)); } catch { /* noop */ }
    }
  } catch { /* オフライン等→jaフォールバックに委ねる */ }
}

/** 問題idの解説を要求言語で解決(→jaフォールバック)。 */
export async function getExplain(id: string, lang: string): Promise<string | undefined> {
  if (lang !== 'ja' && !mem.has(lang)) await prefetchExplain(lang);
  return resolveExplain(id, mem.get(lang));
}
