import type { ImageURISource } from 'react-native';
import { artEntries, parseArtManifest, pickRemoteArt } from './afterStudyRemoteCore';
import { createRemoteArtStore } from './remoteArtStore';
import type { Daylight } from './daylight';

// 保存先・索引キーは旧実装と同じ(既存端末のキャッシュをそのまま使う)。
const store = createRemoteArtStore({
  base: 'https://jlpt.safa-lang.com/afterstudy/',
  index: 'afterstudy_art_manifest_v1',
  dir: 'afterstudy_art_v1/',
  catalog: { parse: parseArtManifest, entries: artEntries },
});

/** Nonblocking at launch and foreground return. A screen keeps its selected art until it closes. */
export function syncAfterStudyArt(): Promise<void> {
  return store.sync();
}

export function cachedAfterStudyImage(seed: number, daylight: Daylight): ImageURISource | null {
  const entry = pickRemoteArt(store.get(), seed, daylight);
  const uri = entry ? store.uri(entry) : null;
  return entry && uri ? { uri, width: entry.width, height: entry.height } : null;
}
