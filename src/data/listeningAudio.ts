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
// v3(2026-08-09): 全520本を48kbpsモノラルへ再エンコード=配信容量 272.5MB→102.2MB(-62.5%)。話し声は聞き分け不可の劣化のみ。
// v4(2026-09-26): 配信/再生を mp3→opus に切替(-54%)。※opusは一部のiPad(iOS)で再生できず廃止。
// v5(2026-09-27): opus→AAC(m4a 40k mono)に切替=iOS/iPad/Android全端末で確実に再生。一括DL容量 604MB→493MB(-18%)。旧opusキャッシュは破棄しm4aを再DL。
const LISTENING_CACHE_VER = 'v5';
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
  const url = `${AUDIO_BASE_URL}${id}.m4a`;
  if (!LISTENING_CACHEABLE) return { uri: url };
  try {
    await ensureDir();
    const local = `${cacheDir}${id}.m4a`;
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
      const info = await FS.getInfoAsync!(`${cacheDir}${id}.m4a`);
      if (!info?.exists) return false;
    } catch { return false; }
  }
  return true;
}

/**
 * レベルの全音声を一括DL→キャッシュ。onProgress(done,total)。個別失敗は黙ってスキップ(後で再試行可)。
 * shouldCancel()=true になったら次のクリップに進む前に中断する(Apple審査 2.1(a)対策=DL中に中止できる)。
 * 中断は例外にせず正常終了。落とせた分はキャッシュに残る=次回は続きからDLされる。
 */
export async function prefetchListening(
  ids: string[],
  onProgress?: (done: number, total: number) => void,
  shouldCancel?: () => boolean,
  concurrency = 16,
): Promise<void> {
  if (!LISTENING_CACHEABLE) { onProgress?.(ids.length, ids.length); return; }
  await ensureDir();
  const total = ids.length;
  let done = 0;
  let next = 0;
  // 並行ワーカー: 小さいクリップ数百本を1本ずつ落とすと接続の往復待ちが積み重なって遅い(Apple審査 2.1(a)=DLできず不合格の主因)。
  // 同時に concurrency 本まで走らせて往復待ちを重ねる=数倍速。JSは単一スレッドなので next++ は await 間で競合しない。
  const worker = async (): Promise<void> => {
    for (;;) {
      if (shouldCancel?.()) return;      // 中止=このワーカーは撤収(取得済みは保持=次回続きから)
      const i = next++;
      if (i >= total) return;
      const id = ids[i];
      try {
        const local = `${cacheDir}${id}.m4a`;
        const info = await FS.getInfoAsync!(local);
        if (!info?.exists) await FS.downloadAsync!(`${AUDIO_BASE_URL}${id}.m4a`, local);
      } catch { /* 個別失敗は無視(後で再試行可) */ }
      onProgress?.(++done, total);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, total) }, () => worker()));
}

// DL前のサイズ概算に使う「1本あたり平均KB」。AAC(m4a 40k・v5)化後の実測平均(級で長さが違う)。
// idは "N3-…"/"N4-…"/"N5-…" と級で始まるので、先頭2文字で級別平均を当てる。
const AVG_KB_BY_LEVEL: Record<string, number> = { N3: 191, N4: 164, N5: 131 };
/** DL前のサイズ概算(bytes)。級別の実測平均×件数(同意画面の目安用。厳密なHEAD合計は省略)。 */
export function listeningBytesEstimate(ids: string[]): number {
  return ids.reduce((sum, id) => sum + (AVG_KB_BY_LEVEL[id.slice(0, 2)] ?? 164) * 1024, 0);
}
