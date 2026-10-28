import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FS from 'expo-file-system/legacy';
import { Platform, type ImageURISource } from 'react-native';
import { artEntries, createArtCache, parseArtManifest, pickRemoteArt, type ArtEntry, type ArtManifest } from './afterStudyRemoteCore';
import type { Daylight } from './daylight';

const BASE = 'https://jlpt.safa-lang.com/afterstudy/';
const INDEX = 'afterstudy_art_manifest_v1';
const DIR = FS.documentDirectory ? FS.documentDirectory + 'afterstudy_art_v1/' : null;
const supported = Platform.OS !== 'web' && !!DIR;

async function valid(entry: ArtEntry, uri = DIR + entry.file): Promise<boolean> {
  const info = await FS.getInfoAsync(uri, { md5: true });
  return info.exists && !info.isDirectory && info.size === entry.bytes && info.md5 === entry.md5;
}

let restoredManifest: ArtManifest | null = null;
const cache = createArtCache({
  load: async () => {
    restoredManifest = parseArtManifest(JSON.parse(await AsyncStorage.getItem(INDEX) || 'null'));
    return restoredManifest;
  },
  save: async manifest => { await AsyncStorage.setItem(INDEX, JSON.stringify(manifest)); },
  valid,
  fetchManifest: async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(BASE + 'manifest.json', { signal: controller.signal, cache: 'no-store' });
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
    const task = FS.createDownloadResumable(BASE + 'images/' + entry.file, temporary, {});
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
});

let lastCheck = -Infinity;
let syncing: Promise<void> | null = null;
/** Nonblocking at launch and foreground return. A screen keeps its selected art until it closes. */
export function syncAfterStudyArt(): Promise<void> {
  if (!supported) return Promise.resolve();
  if (syncing) return syncing;
  if (Date.now() - lastCheck < 5 * 60_000) return Promise.resolve();
  lastCheck = Date.now();
  syncing = (async () => {
    const previous = cache.get();
    await cache.sync();
    const current = cache.get();
    // Retain current + previous catalog (an open result screen may still use the previous file).
    if (current && current !== previous) await prune(current, previous ?? restoredManifest);
  })().catch(() => {}).finally(() => { syncing = null; });
  return syncing;
}

async function prune(current: ArtManifest, previous: ArtManifest | null) {
  const keep = new Set([...artEntries(current), ...(previous ? artEntries(previous) : [])].map(e => e.file));
  for (const file of await FS.readDirectoryAsync(DIR!)) {
    if (/^[a-z0-9_-]+\.[a-f0-9]{32}\.(jpg|png)(\.part)?$/.test(file) && !keep.has(file)) {
      await FS.deleteAsync(DIR + file, { idempotent: true });
    }
  }
}

export function cachedAfterStudyImage(seed: number, daylight: Daylight): ImageURISource | null {
  const entry = pickRemoteArt(cache.get(), seed, daylight);
  return entry && DIR ? { uri: DIR + entry.file, width: entry.width, height: entry.height } : null;
}
