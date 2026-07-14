// app/src/data/content/ota.ts — Pagesから変更/新規ファイルを逐次DLして端末キャッシュへ。読込はキャッシュ優先。
// SDK54 は expo-file-system/legacy を使う([expo-fs-legacy-sdk54] default importの新APIは無反応の罠)。
import * as FileSystem from 'expo-file-system/legacy';
import { diffManifest } from './otaDiff';

const BASE = 'https://jinkato2020.github.io/safa-JLPT/content/';
const DIR = FileSystem.cacheDirectory + 'content/';
const SHA_PATH = DIR + '_shas.json';
const enc = (p: string) => encodeURIComponent(p); // パス→安全なローカル名(セグメントの'_'も壊さない)

async function readJson<T>(uri: string, fallback: T): Promise<T> {
  try { return JSON.parse(await FileSystem.readAsStringAsync(uri)) as T; } catch { return fallback; }
}

/** 起動時: キャッシュ済みOTAファイルを path→parsed で読み出す(無ければ空)。data/index 読込より前に使う。 */
export async function loadCachedFiles(): Promise<Record<string, unknown>> {
  try {
    const info = await FileSystem.getInfoAsync(DIR);
    if (!info.exists) return {};
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

/** Pagesのmanifestを見て、sha変化/新規のファイルだけ逐次DL→キャッシュ保存。失敗/オフラインは無害(baselineで継続)。 */
export async function syncContent(): Promise<void> {
  try {
    await FileSystem.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => {});
    const cachedShas = await readJson<Record<string, string>>(SHA_PATH, {});
    const remote = JSON.parse(await (await fetch(BASE + '_manifest.json')).text()) as { files: Record<string, { sha256: string }> };
    const todo = diffManifest(remote, cachedShas);
    for (const p of todo) { // 逐次(順次)=帯域を独占しない
      try {
        const res = await fetch(BASE + p);
        if (!res.ok) continue;
        const text = await res.text();
        await FileSystem.writeAsStringAsync(DIR + enc(p), text);
        cachedShas[p] = remote.files[p].sha256;
      } catch { /* 個別失敗はスキップ(次回再取得) */ }
    }
    await FileSystem.writeAsStringAsync(SHA_PATH, JSON.stringify(cachedShas));
  } catch { /* オフライン/失敗は無害 */ }
}
