// 発話表現イラストのソース解決＋端末キャッシュ。
//  ・同梱しない(アプリ容量削減)。配信(GitHub Pages)から「問題表示時にオンデマンドDL」→端末キャッシュ。
//  ・配信元は ILLUST_BASE_URL 差し替えだけで移行可。Web はストリーミング(ブラウザキャッシュ任せ)。
import * as FileSystemNS from 'expo-file-system/legacy';
import { Platform } from 'react-native';

// 配信元(GitHub Pages)。assets/hatsuwa/ に発話表現イラスト(384px png)。
export const ILLUST_BASE_URL = 'https://jinkato2020.github.io/safa-JLPT/assets/hatsuwa/';

const FS = FileSystemNS as unknown as {
  documentDirectory?: string | null;
  makeDirectoryAsync?: (uri: string, opts?: { intermediates?: boolean }) => Promise<void>;
  getInfoAsync?: (uri: string) => Promise<{ exists: boolean }>;
  downloadAsync?: (url: string, dest: string) => Promise<{ uri: string }>;
};
const cacheDir = Platform.OS !== 'web' && FS.documentDirectory ? `${FS.documentDirectory}hatsuwa/` : null;
const CACHEABLE = !!cacheDir && typeof FS.downloadAsync === 'function' && typeof FS.getInfoAsync === 'function';

let dirReady = false;
async function ensureDir(): Promise<void> {
  if (!cacheDir || dirReady) return;
  try { await FS.makeDirectoryAsync?.(cacheDir, { intermediates: true }); } catch { /* 既存等は無視 */ }
  dirReady = true;
}

/** イラスト表示URI。キャッシュ済みはローカル、無ければDL→キャッシュ(失敗時/web は配信URL)。 */
export async function illustSource(id: string): Promise<string> {
  const url = `${ILLUST_BASE_URL}${id}.png`;
  if (!CACHEABLE) return url;
  try {
    await ensureDir();
    const local = `${cacheDir}${id}.png`;
    const info = await FS.getInfoAsync!(local);
    if (info?.exists) return local;
    const dl = await FS.downloadAsync!(url, local);
    return dl.uri;
  } catch {
    return url;
  }
}
