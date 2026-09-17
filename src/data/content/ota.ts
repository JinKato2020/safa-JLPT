// app/src/data/content/ota.ts — Pagesから変更/新規ファイルを逐次DLして端末キャッシュへ。読込はキャッシュ優先。
// SDK54 は expo-file-system/legacy を使う([expo-fs-legacy-sdk54] default importの新APIは無反応の罠)。
import * as FileSystem from 'expo-file-system/legacy';
import { diffManifest } from './otaDiff';
import bundledManifest from '../../../content/_manifest.json';

const BASE = 'https://jlpt.safa-lang.com/content/';
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

/** いま端末が実際に持っているコンテンツの sha 一覧。バンドル(baseline)を土台に、バンドルタグ一致時のみ
 *  OTAキャッシュ(cachedShas)を重ねる(loadCachedFiles と同じ優先順)。新バンドル導入直後に「既に同梱済みの
 *  ファイル」を更新扱いしない＝起動時プロンプトの誤検知(既に持っている問題の再DL要求)を防ぐ。 */
async function effectiveShas(cachedShas: Record<string, string>): Promise<Record<string, string>> {
  const bundled = (bundledManifest as { files?: Record<string, { sha256: string }> }).files ?? {};
  const base: Record<string, string> = {};
  for (const k of Object.keys(bundled)) base[k] = bundled[k].sha256;
  const storedTag = await FileSystem.readAsStringAsync(BUNDLE_TAG_PATH).catch(() => '');
  return storedTag === bundleTag() ? { ...base, ...cachedShas } : base;
}

/** 起動時チェック用: DLせずに「更新が必要なファイル数」だけ返す(タイムアウト5秒=起動を待たせない)。
 *  オフライン/失敗は0(=プロンプトを出さない=無害)。バンドル同梱済みは effectiveShas で更新扱いにしない。 */
export async function checkContentUpdate(): Promise<number> {
  try {
    const cachedShas = await readJson<Record<string, string>>(SHA_PATH, {});
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    let remote: { files: Record<string, { sha256: string }> };
    try {
      remote = JSON.parse(await (await fetch(BASE + '_manifest.json', { signal: ctrl.signal })).text());
    } finally { clearTimeout(timer); }
    return diffManifest(remote, await effectiveShas(cachedShas)).length;
  } catch { return 0; }
}

/** 1ファイルをタイムアウト付きで取得(res.ok以外/失敗はnull)。Androidで通信が固まっても全体を止めない。 */
async function fetchTextTO(url: string, ms: number): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    return res.ok ? await res.text() : null;
  } catch { return null; } finally { clearTimeout(timer); }
}

/** Pagesのmanifestを見て、sha変化/新規のファイルだけ「背景で」逐次DL→キャッシュ保存(プロンプトなし・両OS静かに更新)。
 *  適用は次回起動時(loadCachedFilesが読む)。呼び出しは App.tsx 起動useEffect(2026-09-17 サイレント化。旧「はい/いいえ確認」を置換)。
 *  堅牢化: ①各DLにタイムアウト＋1回リトライ ②進捗を10件ごとに逐次保存(途中で切れても次回は残りだけ=無限ループ防止)
 *  ③新バンドル(アプリ更新後の初回)は古いOTAキャッシュを破棄して作り直す。戻り値=今回DLしたファイル数。失敗/オフラインは無害。 */
export async function syncContent(): Promise<number> {
  try {
    const tag = bundleTag();
    const storedTag = await FileSystem.readAsStringAsync(BUNDLE_TAG_PATH).catch(() => '');
    let cachedShas: Record<string, string>;
    if (storedTag !== tag) {
      // 新バンドル: 古いOTAキャッシュは新バンドルより古い可能性→捨てて作り直し、以後このバンドルのキャッシュとして有効化。
      // タグを先に書くことで、以降の逐次保存(cachedShas)が次回起動から効く(部分DLでも残りだけで済む)。
      await FileSystem.deleteAsync(DIR, { idempotent: true }).catch(() => {});
      await FileSystem.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => {});
      await FileSystem.writeAsStringAsync(BUNDLE_TAG_PATH, tag);
      cachedShas = {};
    } else {
      await FileSystem.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => {});
      cachedShas = await readJson<Record<string, string>>(SHA_PATH, {});
    }
    const manifestText = await fetchTextTO(BASE + '_manifest.json', 8000);
    if (!manifestText) return 0; // manifest取得不可(オフライン等)→無害に終了
    const remote = JSON.parse(manifestText) as { files: Record<string, { sha256: string }> };
    const todo = diffManifest(remote, await effectiveShas(cachedShas));
    let n = 0, sinceSave = 0;
    for (const p of todo) { // 逐次(順次)=帯域を独占しない
      let text = await fetchTextTO(BASE + p, 15000);
      if (text === null) text = await fetchTextTO(BASE + p, 15000); // 1回だけリトライ
      if (text === null) continue; // 個別失敗はスキップ(次回再取得)
      try {
        await FileSystem.writeAsStringAsync(DIR + enc(p), text);
        cachedShas[p] = remote.files[p].sha256;
        n++; sinceSave++;
        if (sinceSave >= 10) { // 10件ごとに進捗を保存=途中で切れても次回は残りだけ(無限ループ防止)
          await FileSystem.writeAsStringAsync(SHA_PATH, JSON.stringify(cachedShas));
          sinceSave = 0;
        }
      } catch { /* 書込失敗はスキップ(次回再取得) */ }
    }
    await FileSystem.writeAsStringAsync(SHA_PATH, JSON.stringify(cachedShas));
    return n;
  } catch { return 0; /* オフライン/失敗は無害 */ }
}
