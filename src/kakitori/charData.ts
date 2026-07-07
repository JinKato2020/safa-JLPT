// 字形データ(hanzi-writer-data)の取得＋端末キャッシュ。WebViewはネットに触れず、
// ここで得た生JSONを KW.load(char, json) で注入する。[[expo-fs-legacy-sdk54]]
import * as FileSystem from 'expo-file-system/legacy';

const BASE = 'https://cdn.jsdelivr.net/npm/hanzi-writer-data@2';
const DIR = FileSystem.cacheDirectory + 'hwdata/';

export function charDataUrl(char: string): string {
  return `${BASE}/${encodeURIComponent(char)}.json`;
}

function cachePath(char: string): string {
  return DIR + char.codePointAt(0)!.toString(16) + '.json';
}

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
}

/** 字形JSON(生文字列)を返す。キャッシュ優先→無ければDLして保存。失敗時throw。 */
export async function fetchCharData(char: string): Promise<string> {
  await ensureDir();
  const path = cachePath(char);
  const cached = await FileSystem.getInfoAsync(path);
  if (cached.exists) {
    const s = await FileSystem.readAsStringAsync(path);
    if (s && s.length > 0) return s;
  }
  const res = await FileSystem.downloadAsync(charDataUrl(char), path);
  if (res.status !== 200) throw new Error('char data ' + res.status);
  return await FileSystem.readAsStringAsync(path);
}
