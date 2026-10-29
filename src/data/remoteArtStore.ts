// 自社サーバーの画像カタログ(manifest.json＋内容アドレス名の画像)を端末へ保存し、OTAで差し替える共通の器。
//  学習後画像(afterStudyRemote)と季節の場面画像(sceneArtRemote)が共用。全ファイル検証済みのカタログだけを採用する。
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FS from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { createArtCache, type ArtCatalog, type ArtEntry } from './afterStudyRemoteCore';

export function createRemoteArtStore<M>(opts: { base: string; index: string; dir: string; catalog: ArtCatalog<M> }) {
  const { base, index, catalog } = opts;
  const DIR = FS.documentDirectory ? FS.documentDirectory + opts.dir : null;
  const supported = Platform.OS !== 'web' && !!DIR;

  async function valid(entry: ArtEntry, uri = DIR + entry.file): Promise<boolean> {
    const info = await FS.getInfoAsync(uri, { md5: true });
    return info.exists && !info.isDirectory && info.size === entry.bytes && info.md5 === entry.md5;
  }

  let restoredManifest: M | null = null;
  const cache = createArtCache<M>({
    load: async () => {
      restoredManifest = catalog.parse(JSON.parse(await AsyncStorage.getItem(index) || 'null'));
      return restoredManifest;
    },
    save: async manifest => { await AsyncStorage.setItem(index, JSON.stringify(manifest)); },
    valid,
    fetchManifest: async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(base + 'manifest.json', { signal: controller.signal, cache: 'no-store' });
        if (!res.ok) throw new Error('Art manifest unavailable');
        const text = await res.text();
        if (text.length > 32_000) throw new Error('Art manifest too large');
        return JSON.parse(text);
      } finally { clearTimeout(timer); }
    },
    download: async entry => {
      await FS.makeDirectoryAsync(DIR!, { intermediates: true });
      const destination = DIR + entry.file;
      const temporary = destination + '.part';
      await FS.deleteAsync(temporary, { idempotent: true });
      const task = FS.createDownloadResumable(base + 'images/' + entry.file, temporary, {});
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const result = await Promise.race([
          task.downloadAsync(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              void task.pauseAsync().catch(() => {});
              reject(new Error('Art download timeout'));
            }, 15_000);
          }),
        ]);
        if (!result || result.status !== 200 || !(await valid(entry, temporary))) throw new Error('Invalid art download');
        await FS.deleteAsync(destination, { idempotent: true });
        await FS.moveAsync({ from: temporary, to: destination });
      } finally { if (timer) clearTimeout(timer); }
    },
  }, catalog);

  async function prune(current: M, previous: M | null) {
    const keep = new Set([...catalog.entries(current), ...(previous ? catalog.entries(previous) : [])].map(e => e.file));
    for (const file of await FS.readDirectoryAsync(DIR!)) {
      if (/^[a-z0-9_-]+\.[a-f0-9]{32}\.(jpg|png)(\.part)?$/.test(file) && !keep.has(file)) {
        await FS.deleteAsync(DIR + file, { idempotent: true });
      }
    }
  }

  const listeners = new Set<() => void>();
  let lastCheck = -Infinity;
  let syncing: Promise<void> | null = null;
  /** Nonblocking at launch and foreground return. A screen keeps its selected art until it closes. */
  function sync(): Promise<void> {
    if (!supported) return Promise.resolve();
    if (syncing) return syncing;
    if (Date.now() - lastCheck < 5 * 60_000) return Promise.resolve();
    lastCheck = Date.now();
    syncing = (async () => {
      const previous = cache.get();
      await cache.sync();
      const current = cache.get();
      if (current !== previous) listeners.forEach(fn => fn());
      // Retain current + previous catalog (an open screen may still use the previous file).
      if (current && current !== previous && DIR) await prune(current, previous ?? restoredManifest);
    })().catch(() => {}).finally(() => { syncing = null; });
    return syncing;
  }

  return {
    sync,
    get: () => cache.get(),
    uri: (entry: ArtEntry) => (DIR ? DIR + entry.file : null),
    /** Called when a newly verified catalog becomes active (for screens that stay mounted). */
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
  };
}
