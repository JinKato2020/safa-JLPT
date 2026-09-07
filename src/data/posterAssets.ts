// ポスター朗読の資源(音声mp3・ポスターwebp)のローダ。アプリ同梱をやめ、GitHub Release(packs-poster)の
//  言語別 STORED zip パックとして取得し端末キャッシュする。版管理=カタログの langごと version。
//   - poster-catalog.json = { version, langs:{ ja:{url,bytes,version}, bn:.., .. } }
//   - poster-<L>.zip は STORED(無圧縮)。エントリ名 "<theme>/audio/NN_<L>.mp3" / "title_<L>.mp3" /
//     (非JAのみ)"<theme>/poster_<L>.webp"。JAは音声のみ。
//   zip はディスク上から範囲読み(STORED)して各エントリを ${documentDirectory}poster/<entryname> へ展開(OOM安全)。
//   録り直し時は build_packs.py の VERSION を上げて再アップ→version不一致で全端末が自動再取得(ファイル名不変)。
import * as FileSystem from 'expo-file-system/legacy';
import type { PosterLesson } from './posterLessons';

export const POSTER_CATALOG_URL =
  'https://github.com/JinKato2020/safa-JLPT/releases/download/packs-poster/poster-catalog.json';

const posterRoot = () => `${FileSystem.documentDirectory}poster/`;
const markerUri = (lang: string) => `${posterRoot()}${lang}.version`;

async function fetchJson(url: string, timeoutMs = 8000): Promise<any> {
  const busted = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(busted, { cache: 'no-store' as any, headers: { 'Cache-Control': 'no-cache' }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let last: any;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) { last = e; if (i < tries - 1) await sleep(700 * (i + 1)); }
  }
  throw last;
}

// base64 -> Uint8Array (RN グローバルの atob)。zipヘッダ解析用。
function b64ToU8(b64: string): Uint8Array {
  const bin = (global as any).atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

// poster-<L>.zip を DL → STORED zip をストリーミング展開して各エントリを posterRoot()/<entryname> に書き出す。
//  版が最新ならスキップ。失敗は throw せず握りつぶし(呼び出し側は未解決/欠落を許容)。
async function ensureLangZip(lang: string, entry: any, onProgress?: (done: number, total: number) => void): Promise<void> {
  if (!entry?.url) return;
  const marker = markerUri(lang);
  const m = await FileSystem.getInfoAsync(marker);
  if (m.exists) {
    try {
      const v = await FileSystem.readAsStringAsync(marker);
      if (v === String(entry.version ?? '')) return; // 最新キャッシュ済み
    } catch {}
  }
  await FileSystem.makeDirectoryAsync(posterRoot(), { intermediates: true });

  const zipUri = `${posterRoot()}${lang}.zip`;
  const total: number = entry.bytes || 0;
  const dl = FileSystem.createDownloadResumable(entry.url, zipUri, {}, (p: any) => {
    const exp = p.totalBytesExpectedToWrite || total || 1;
    onProgress?.(Math.min(1, p.totalBytesWritten / exp), 1);
  });
  await dl.downloadAsync();

  // STORED(無圧縮)前提の範囲読み展開。zip全体をメモリに載せず各エントリを書き出す(ピークメモリ=1ファイル)。
  const zinfo: any = await FileSystem.getInfoAsync(zipUri);
  const zipSize: number = zinfo?.size ?? 0;
  const HDR = 30;
  let off = 0, fcount = 0;
  while (off + 4 <= zipSize) {
    const head = b64ToU8(await FileSystem.readAsStringAsync(zipUri, { encoding: 'base64' as any, position: off, length: Math.min(HDR + 256, zipSize - off) }));
    if (!(head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04)) break; // PK\x03\x04 でなければ終了
    const u16 = (i: number) => head[i] | (head[i + 1] << 8);
    const u32 = (i: number) => head[i] + head[i + 1] * 256 + head[i + 2] * 65536 + head[i + 3] * 16777216;
    const comp = u32(18);            // 圧縮後サイズ(STORED=実サイズ)
    const nameLen = u16(26);
    const extraLen = u16(28);
    let name = '';
    if (HDR + nameLen <= head.length) {
      for (let k = 0; k < nameLen; k++) name += String.fromCharCode(head[HDR + k]);
    } else {
      const nb = b64ToU8(await FileSystem.readAsStringAsync(zipUri, { encoding: 'base64' as any, position: off + HDR, length: nameLen }));
      for (let k = 0; k < nameLen; k++) name += String.fromCharCode(nb[k]);
    }
    const dataPos = off + HDR + nameLen + extraLen;
    if (comp > 0 && name && !name.endsWith('/')) {
      const slash = name.lastIndexOf('/');
      if (slash > 0) await FileSystem.makeDirectoryAsync(`${posterRoot()}${name.slice(0, slash)}`, { intermediates: true });
      const b64 = await FileSystem.readAsStringAsync(zipUri, { encoding: 'base64' as any, position: dataPos, length: comp });
      await FileSystem.writeAsStringAsync(`${posterRoot()}${name}`, b64, { encoding: 'base64' as any });
      fcount++;
    }
    off = dataPos + comp;
  }
  if (fcount === 0) throw new Error('poster zip展開で0ファイル(破損/形式不一致)');
  await FileSystem.writeAsStringAsync(marker, String(entry.version ?? ''));
  await FileSystem.deleteAsync(zipUri, { idempotent: true });
}

// 表示言語 lang が要する言語パック一覧。ja=音声のみ(画像なし)なので、ja表示時は画像フォールバック先 en も取得。
function neededLangs(lang: string): string[] {
  if (lang === 'ja') return ['ja', 'en'];
  return ['ja', lang];
}

/** 指定言語のポスターパック(ja + 表示言語)をDL/展開。langごと marker(<L>.version)で版管理。
 *  失敗は throw せず握りつぶす(画面側が ready にならず/画像欠落を許容)。web等 documentDirectory 不在では何もしない。 */
export async function ensurePosterPack(lang: string, onProgress?: (done: number, total: number) => void): Promise<void> {
  if (!FileSystem.documentDirectory) { onProgress?.(1, 1); return; }
  let catalog: any = null;
  try { catalog = await withRetry(() => fetchJson(POSTER_CATALOG_URL, 8000)); } catch { return; }
  const langs = catalog?.langs || {};
  const needed = neededLangs(lang);
  for (let i = 0; i < needed.length; i++) {
    const L = needed[i];
    try {
      await ensureLangZip(L, langs[L], onProgress ? (d, t) => onProgress((i + d) / needed.length, t) : undefined);
    } catch {}
  }
}

/** zip内エントリのキー → 端末上の file:// uri。key 未指定なら undefined(ready前など)。 */
export function posterUri(key?: string): string | undefined {
  return key ? `${posterRoot()}${key}` : undefined;
}

/** ja と表示言語のパックが両方DL済み(marker有り)なら true(簡易)。web等は常に true(=DL不要扱い)。 */
export async function isPosterReady(_lesson: PosterLesson | null, lang: string): Promise<boolean> {
  if (!FileSystem.documentDirectory) return true;
  for (const L of neededLangs(lang)) {
    const info = await FileSystem.getInfoAsync(markerUri(L));
    if (!info.exists) return false;
  }
  return true;
}
