// ポスター朗読の資源(画像png・音声mp3)のソース解決＋端末キャッシュ。
//  ・同梱しない(アプリ容量削減)。配信(GitHub Pages)から「テーマを開いた時にまとめてDL」→端末キャッシュ。
//  ・値は posterLessons.ts の配信キー(例 'family/poster_en.png' / 'family/audio/01_ja.mp3')。
//  ・聴解の listeningImage.ts / listeningAudio.ts と同方式。base 差し替えだけで移行可。Web はストリーミング。
import * as FileSystemNS from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import type { PosterLesson } from './posterLessons';

// 配信元(GitHub Pages)。assets/poster/<theme>/poster_<lang>.png ・ assets/poster/<theme>/audio/<NN>_<lang>.mp3
export const POSTER_BASE_URL = 'https://jinkato2020.github.io/safa-JLPT/assets/poster/';

const FS = FileSystemNS as unknown as {
  documentDirectory?: string | null;
  makeDirectoryAsync?: (uri: string, opts?: { intermediates?: boolean }) => Promise<void>;
  getInfoAsync?: (uri: string) => Promise<{ exists: boolean }>;
  downloadAsync?: (url: string, dest: string) => Promise<{ uri: string }>;
  writeAsStringAsync?: (uri: string, contents: string) => Promise<void>;
};
const cacheRoot = Platform.OS !== 'web' && FS.documentDirectory ? `${FS.documentDirectory}poster/` : null;
const CACHEABLE = !!cacheRoot && typeof FS.downloadAsync === 'function' && typeof FS.getInfoAsync === 'function';

/** 配信キー → 表示/再生に使うURI。キャッシュ可能ならローカル(要事前 ensurePosterTheme)、不可(web等)なら配信URL。
 *  ensurePosterTheme 完了後に呼ぶ前提(ローカルに存在)。未DLのキーを渡すとローカルの不在パスを返す点に注意。 */
export function posterUri(key?: string): string | undefined {
  if (!key) return undefined;
  return CACHEABLE ? `${cacheRoot}${key}` : `${POSTER_BASE_URL}${key}`;
}

// テーマ×言語が要求する配信キー一覧(画像1 + 音声 ja+lang: title+各カード)を平坦化。
function keysFor(lesson: PosterLesson, lang: string): string[] {
  const keys: string[] = [];
  const img = lesson.imageL1[lang] ?? lesson.imageL1.en ?? Object.values(lesson.imageL1)[0];
  if (img) keys.push(img);
  const pushAudio = (m?: { ja: string; l1: Record<string, string> }) => {
    if (!m) return;
    if (m.ja) keys.push(m.ja);
    const a = m.l1[lang] ?? m.l1.en;
    if (a) keys.push(a);
  };
  pushAudio(lesson.titleAudio);
  for (const c of lesson.cards) pushAudio({ ja: c.ja, l1: c.l1 });
  return Array.from(new Set(keys));
}

async function ensureDirFor(key: string): Promise<void> {
  if (!cacheRoot) return;
  const slash = key.lastIndexOf('/');
  const dir = slash > 0 ? `${cacheRoot}${key.slice(0, slash)}` : cacheRoot;
  try { await FS.makeDirectoryAsync?.(dir, { intermediates: true }); } catch { /* 既存等は無視 */ }
}

const readyMarker = (id: string, lang: string) => `${cacheRoot}${id}.${lang}.ready`;

/** テーマ×言語(ja+lang)の資源をまとめてDL/キャッシュ。完了で解決。失敗キーは握りつぶし(画面側が欠落を許容)。
 *  web/非キャッシュ端末は即解決(=配信URLからストリーミング)。 */
export async function ensurePosterTheme(
  lesson: PosterLesson, lang: string, onProgress?: (done: number, total: number) => void,
): Promise<void> {
  if (!CACHEABLE) { onProgress?.(1, 1); return; }
  const keys = keysFor(lesson, lang);
  let done = 0;
  for (const key of keys) {
    try {
      const local = `${cacheRoot}${key}`;
      const info = await FS.getInfoAsync!(local);
      if (!info?.exists) {
        await ensureDirFor(key);
        await FS.downloadAsync!(`${POSTER_BASE_URL}${key}`, local);
      }
    } catch { /* 1件の失敗で全体を止めない */ }
    onProgress?.(++done, keys.length);
  }
  try { await FS.writeAsStringAsync?.(readyMarker(lesson.id, lang), '1'); } catch { /* 記録失敗は無視 */ }
}

/** テーマ×言語がDL済みか(ready マーカーの有無・簡易)。テーマ一覧のバッジ等に。 */
export async function isPosterReady(lesson: PosterLesson, lang: string): Promise<boolean> {
  if (!CACHEABLE) return true; // web は常にストリーミング可
  try { return !!(await FS.getInfoAsync!(readyMarker(lesson.id, lang)))?.exists; } catch { return false; }
}
