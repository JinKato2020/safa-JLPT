// 語彙読み上げ音声の再生。事前生成mp3をPages配信＋端末キャッシュ。
// 音源が無い/失敗時は false を返し、呼び出し側が expo-speech へフォールバックする(無音にしない)。
import * as FileSystemNS from 'expo-file-system/legacy';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import { vocabAudioUrl } from './audioBase';

const FS = FileSystemNS as unknown as {
  documentDirectory?: string | null;
  makeDirectoryAsync?: (uri: string, opts?: { intermediates?: boolean }) => Promise<void>;
  getInfoAsync?: (uri: string) => Promise<{ exists: boolean }>;
  downloadAsync?: (url: string, dest: string) => Promise<{ uri: string }>;
};
const cacheDir = Platform.OS !== 'web' && FS.documentDirectory ? `${FS.documentDirectory}vocab/` : null;
const CACHEABLE = !!cacheDir && typeof FS.downloadAsync === 'function' && typeof FS.getInfoAsync === 'function';

let dirReady = false;
async function ensureDir(): Promise<void> {
  if (!cacheDir || dirReady) return;
  try { await FS.makeDirectoryAsync?.(cacheDir, { intermediates: true }); } catch { /* 既存等は無視 */ }
  dirReady = true;
}

async function resolveSource(id: string): Promise<{ uri: string }> {
  const url = vocabAudioUrl(id);
  if (!CACHEABLE) return { uri: url };
  try {
    await ensureDir();
    const local = `${cacheDir}${id}.mp3`;
    const info = await FS.getInfoAsync!(local);
    if (info?.exists) return { uri: local };
    const dl = await FS.downloadAsync!(url, local);
    return { uri: dl.uri };
  } catch {
    return { uri: url };
  }
}

let current: Audio.Sound | null = null;

/** 再生中の音を停止・解放。 */
export async function stopVocab(): Promise<void> {
  const s = current;
  current = null;
  if (s) { try { await s.unloadAsync(); } catch { /* 解放失敗は無視 */ } }
}

/** id の語を再生。成功=true / 音源なし・デコード失敗=false(呼び出し側がTTSフォールバック)。 */
export async function playVocab(id: string): Promise<boolean> {
  const src = await resolveSource(id);
  await stopVocab();
  try {
    const { sound, status } = await Audio.Sound.createAsync(src, { shouldPlay: true });
    if (!status.isLoaded) { try { await sound.unloadAsync(); } catch { /* noop */ } return false; }
    current = sound;
    sound.setOnPlaybackStatusUpdate((st) => {
      if (st.isLoaded && st.didJustFinish) { sound.unloadAsync().catch(() => {}); if (current === sound) current = null; }
    });
    return true;
  } catch {
    return false;
  }
}
