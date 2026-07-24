// 聴解音声のソース解決＋レベル一括プリフェッチ。
//  ・全音声(現39本・将来レベルごとに増加)は配信(GitHub Pages)＋端末キャッシュでオフライン対応。
//    同梱は廃止(アプリ容量削減)。レベル別の問題リスト= listening.json(OTA更新可)が実質マニフェスト。
//  ・オンボードのレベル選択時、または聴解開始時に、そのレベルの全音声を一括DL(prefetchListening)。
//  ・配信元は AUDIO_BASE_URL 差し替えだけで移行可。Web はストリーミング(ブラウザキャッシュ任せ)。
//  生成: data-build/gen_listening_audio.py。
import * as FileSystemNS from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { AUDIO_BASE_URL } from './audioBase';

// 配信元(GitHub Pages)。assets/audio/ に全mp3。repo/移行時はこの1行だけ差し替え。
export { AUDIO_BASE_URL };

export type AudioSource = { uri: string };

// expo-file-system は SDK 版差があるため any で受け、実行時に機能検出(無ければストリーミングへ)。
const FS = FileSystemNS as unknown as {
  documentDirectory?: string | null;
  makeDirectoryAsync?: (uri: string, opts?: { intermediates?: boolean }) => Promise<void>;
  getInfoAsync?: (uri: string) => Promise<{ exists: boolean }>;
  downloadAsync?: (url: string, dest: string) => Promise<{ uri: string }>;
};
// 配信済み音声の内容を差し替えた時はこの版を上げる→旧キャッシュ(別フォルダ)を捨てて全音声を再DLさせる。
// 同名{id}.mp3はキャッシュ優先で再DLされないため、内容更新はこの版上げが唯一の伝達手段。
// v2(2026-07-25): 発話001-010を差し替え(All Chirp3-HD・正解位置シャッフル)。
const LISTENING_CACHE_VER = 'v2';
const cacheDir = Platform.OS !== 'web' && FS.documentDirectory ? `${FS.documentDirectory}listening_${LISTENING_CACHE_VER}/` : null;
/** キャッシュ可能な端末か(web等はストリーミングのみ=事前DL不要)。 */
export const LISTENING_CACHEABLE = !!cacheDir && typeof FS.downloadAsync === 'function' && typeof FS.getInfoAsync === 'function';

let dirReady = false;
async function ensureDir(): Promise<void> {
  if (!cacheDir || dirReady) return;
  try { await FS.makeDirectoryAsync?.(cacheDir, { intermediates: true }); } catch { /* 既存等は無視 */ }
  dirReady = true;
}

/**
 * 再生ソース。キャッシュ済みならローカル、無ければ配信URL。
 *  ・既定(download): ネイティブはDL→キャッシュ(オフライン再生)。
 *  ・stream=true(配信モード): キャッシュがあれば使うが、無ければDLせず都度ストリーミング(容量節約)。
 *  ・web/非対応端末・失敗時は常にストリーミング。
 */
export async function listeningSource(id: string, opts?: { stream?: boolean }): Promise<AudioSource | null> {
  const url = `${AUDIO_BASE_URL}${id}.mp3`;
  if (!LISTENING_CACHEABLE) return { uri: url };
  try {
    await ensureDir();
    const local = `${cacheDir}${id}.mp3`;
    const info = await FS.getInfoAsync!(local);
    if (info?.exists) return { uri: local };
    if (opts?.stream) return { uri: url }; // 配信モード: DLせずストリーミング
    const dl = await FS.downloadAsync!(url, local);
    return { uri: dl.uri };
  } catch {
    return { uri: url };
  }
}

/** そのレベルの全音声がキャッシュ済みか(web/非対応端末は常にtrue=ストリーミング前提)。 */
export async function listeningReady(ids: string[]): Promise<boolean> {
  if (!LISTENING_CACHEABLE) return true;
  for (const id of ids) {
    try {
      const info = await FS.getInfoAsync!(`${cacheDir}${id}.mp3`);
      if (!info?.exists) return false;
    } catch { return false; }
  }
  return true;
}

/** レベルの全音声を一括DL→キャッシュ。onProgress(done,total)。個別失敗は黙ってスキップ(後で再試行可)。 */
export async function prefetchListening(ids: string[], onProgress?: (done: number, total: number) => void): Promise<void> {
  if (!LISTENING_CACHEABLE) { onProgress?.(ids.length, ids.length); return; }
  await ensureDir();
  let done = 0;
  for (const id of ids) {
    try {
      const local = `${cacheDir}${id}.mp3`;
      const info = await FS.getInfoAsync!(local);
      if (!info?.exists) await FS.downloadAsync!(`${AUDIO_BASE_URL}${id}.mp3`, local);
    } catch { /* 個別失敗は無視 */ }
    onProgress?.(++done, ids.length);
  }
}

/** DL前のサイズ概算(bytes)。1本≈360KB×件数(同意画面の目安用。厳密なHEAD合計は省略)。 */
export function listeningBytesEstimate(ids: string[]): number {
  return ids.length * 360 * 1024;
}
