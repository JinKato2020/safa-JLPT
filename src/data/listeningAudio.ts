// 聴解音声のソース解決。
//  ・既存15本は同梱(オフラインで即再生)。
//  ・追加分は配信URL(AUDIO_BASE_URL)から取得し、ネイティブは端末にキャッシュ(2回目以降はローカル)。
//  ・配信元は AUDIO_BASE_URL の差し替えだけで GitHub Pages → Cloudflare 等へ無痛移行。Web はブラウザキャッシュ任せ。
//  生成: data-build/gen_listening_audio.py (OpenAI gpt-4o-mini-tts nova+verse + ffmpeg)。
import * as FileSystemNS from 'expo-file-system';
import { Platform } from 'react-native';

import n4l1 from '../../assets/listening/n4-l-1.mp3';
import n4l2 from '../../assets/listening/n4-l-2.mp3';
import n4l3 from '../../assets/listening/n4-l-3.mp3';
import n4l4 from '../../assets/listening/n4-l-4.mp3';
import n4l5 from '../../assets/listening/n4-l-5.mp3';
import n5l1 from '../../assets/listening/n5-l-1.mp3';
import n5l2 from '../../assets/listening/n5-l-2.mp3';
import n5l3 from '../../assets/listening/n5-l-3.mp3';
import n5l4 from '../../assets/listening/n5-l-4.mp3';
import n5l5 from '../../assets/listening/n5-l-5.mp3';
import n3l1 from '../../assets/listening/n3-l-1.mp3';
import n3l2 from '../../assets/listening/n3-l-2.mp3';
import n3l3 from '../../assets/listening/n3-l-3.mp3';
import n3l4 from '../../assets/listening/n3-l-4.mp3';
import n3l5 from '../../assets/listening/n3-l-5.mp3';

// 同梱(初期セット)。これらはオフラインで即再生。追加コンテンツは配信から。
const BUNDLED: Record<string, number> = {
  'n4-l-1': n4l1, 'n4-l-2': n4l2, 'n4-l-3': n4l3, 'n4-l-4': n4l4, 'n4-l-5': n4l5,
  'n5-l-1': n5l1, 'n5-l-2': n5l2, 'n5-l-3': n5l3, 'n5-l-4': n5l4, 'n5-l-5': n5l5,
  'n3-l-1': n3l1, 'n3-l-2': n3l2, 'n3-l-3': n3l3, 'n3-l-4': n3l4, 'n3-l-5': n3l5,
};

// 配信元(GitHub Pages)。アセットrepo名を変える/Cloudflareへ移す場合はこの1行だけ差し替え。
// GitHubユーザー: JinKato2020 / 既定アセットrepo: safa-assets (要: Pages有効化＋ jlpt/audio/ に mp3 配置)。
export const AUDIO_BASE_URL = 'https://jinkato2020.github.io/safa-assets/jlpt/audio/';

export type AudioSource = number | { uri: string };

// expo-file-system は SDK 版差があるため any で受け、実行時に機能検出(無ければストリーミングへ)。
const FS = FileSystemNS as unknown as {
  cacheDirectory?: string | null;
  makeDirectoryAsync?: (uri: string, opts?: { intermediates?: boolean }) => Promise<void>;
  getInfoAsync?: (uri: string) => Promise<{ exists: boolean }>;
  downloadAsync?: (url: string, dest: string) => Promise<{ uri: string }>;
};
const cacheDir = Platform.OS !== 'web' && FS.cacheDirectory ? `${FS.cacheDirectory}listening/` : null;
let dirReady = false;
async function ensureDir(): Promise<void> {
  if (!cacheDir || dirReady) return;
  try {
    await FS.makeDirectoryAsync?.(cacheDir, { intermediates: true });
  } catch {
    // 既存等は無視
  }
  dirReady = true;
}

/** 再生ソース。同梱があれば同梱、無ければ配信URL(ネイティブはDL→ローカルキャッシュ、失敗時はストリーミング)。 */
export async function listeningSource(id: string): Promise<AudioSource | null> {
  if (BUNDLED[id] != null) return BUNDLED[id];
  const url = `${AUDIO_BASE_URL}${id}.mp3`;
  if (!cacheDir || typeof FS.downloadAsync !== 'function' || typeof FS.getInfoAsync !== 'function') {
    return { uri: url };
  }
  try {
    await ensureDir();
    const local = `${cacheDir}${id}.mp3`;
    const info = await FS.getInfoAsync(local);
    if (info?.exists) return { uri: local };
    const dl = await FS.downloadAsync(url, local);
    return { uri: dl.uri };
  } catch {
    return { uri: url };
  }
}

// 後方互換(同梱の同期参照が要る箇所用)。新規は listeningSource を使う。
export const LISTENING_AUDIO = BUNDLED;
