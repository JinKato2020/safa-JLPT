// app/src/data/content/ota.ts — Pagesから変更/新規ファイルを逐次DLして端末キャッシュへ。読込はキャッシュ優先。
// SDK54 は expo-file-system/legacy を使う([expo-fs-legacy-sdk54] default importの新APIは無反応の罠)。
import * as FileSystem from 'expo-file-system/legacy';
import * as Network from 'expo-network';
import { diffManifest } from './otaDiff';
import bundledManifest from '../../../content/_manifest.json';

const BASE = 'https://jinkato2020.github.io/safa-JLPT/content/';
const DIR = FileSystem.cacheDirectory + 'content/';
const SHA_PATH = DIR + '_shas.json';
const BUNDLE_TAG_PATH = DIR + '_bundle.tag';
const enc = (p: string) => encodeURIComponent(p); // パス→安全なローカル名(セグメントの'_'も壊さない)

// バンドル同梱コンテンツの識別子(全file→shaから決定的に算出)。アプリ更新でバンドルが変わると値が変わる。
// これが変わったら「端末の古いOTAキャッシュは新バンドルより古い可能性」=そのキャッシュで新バンドルを上書きしない。
function bundleTag(): string {
  const files = (bundledManifest as { files?: Record<string, { sha256: string }> }).files ?? {};
  const s = Object.keys(files).sort().map((k) => k + ':' + files[k].sha256).join('|');
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

async function readJson<T>(uri: string, fallback: T): Promise<T> {
  try { return JSON.parse(await FileSystem.readAsStringAsync(uri)) as T; } catch { return fallback; }
}

/** 起動時: キャッシュ済みOTAファイルを path→parsed で読み出す(無ければ空)。data/index 読込より前に使う。 */
export async function loadCachedFiles(): Promise<Record<string, unknown>> {
  try {
    const info = await FileSystem.getInfoAsync(DIR);
    if (!info.exists) return {};
    // アプリ(バンドル)が更新されていたら、古いOTAキャッシュは使わない(バンドル=そのバージョンの正を優先)。
    // 直後に syncContent が Pages から最新を取り直し、タグを更新する。これで「新バンドルの新規コンテンツが
    // 旧OTAキャッシュに隠される」問題を無くす(例: 文法の母語訳が英語のまま出る)。失敗時も return{}=バンドルで安全。
    const storedTag = await FileSystem.readAsStringAsync(BUNDLE_TAG_PATH).catch(() => '');
    if (storedTag !== bundleTag()) return {};
    const names = await FileSystem.readDirectoryAsync(DIR);
    const out: Record<string, unknown> = {};
    for (const name of names) {
      if (name === '_shas.json') continue;
      const text = await FileSystem.readAsStringAsync(DIR + name).catch(() => '');
      if (text) { try { out[decodeURIComponent(name)] = JSON.parse(text); } catch { /* skip壊れ */ } }
    }
    return out;
  } catch { return {}; }
}

/** Pagesのmanifestを見て、sha変化/新規のファイルだけ逐次DL→キャッシュ保存。失敗/オフラインは無害(baselineで継続)。
 *  既定(自動)はモバイル通信(セルラー)では走らせない=ギガを使わない。force=true(設定の手動更新)はセルラーでも実行。
 *  戻り値=今回DLしたファイル数(手動更新の結果表示に使う)。反映は次回起動(手動更新はreloadで即反映)。 */
export async function syncContent(opts?: { force?: boolean }): Promise<number> {
  try {
    if (!opts?.force) {
      try {
        const st = await Network.getNetworkStateAsync();
        if (st.type === Network.NetworkStateType.CELLULAR) return 0; // 自動同期はWi-Fi/有線/不明の時だけ
      } catch { /* 判定不可なら従来どおり続行 */ }
    }
    await FileSystem.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => {});
    const cachedShas = await readJson<Record<string, string>>(SHA_PATH, {});
    const remote = JSON.parse(await (await fetch(BASE + '_manifest.json')).text()) as { files: Record<string, { sha256: string }> };
    const todo = diffManifest(remote, cachedShas);
    let n = 0;
    for (const p of todo) { // 逐次(順次)=帯域を独占しない
      try {
        const res = await fetch(BASE + p);
        if (!res.ok) continue;
        const text = await res.text();
        await FileSystem.writeAsStringAsync(DIR + enc(p), text);
        cachedShas[p] = remote.files[p].sha256;
        n++;
      } catch { /* 個別失敗はスキップ(次回再取得) */ }
    }
    await FileSystem.writeAsStringAsync(SHA_PATH, JSON.stringify(cachedShas));
    await FileSystem.writeAsStringAsync(BUNDLE_TAG_PATH, bundleTag()); // このバンドル版で同期完了=次回からキャッシュ有効
    return n;
  } catch { return 0; /* オフライン/失敗は無害 */ }
}
