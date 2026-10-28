import type { Daylight } from './daylight';

export type ArtEntry = { file: string; md5: string; bytes: number; width: number; height: number };
export type ArtManifest = { schema: 1; day: ArtEntry[]; night: ArtEntry[] };
export const artEntries = (m: ArtManifest) => [...m.day, ...m.night];

/** Only content-addressed image basenames under our own server are allowed. */
export function parseArtManifest(value: unknown): ArtManifest {
  if (!value || typeof value !== 'object') throw new Error('Invalid art manifest');
  const m = value as ArtManifest;
  if (m.schema !== 1) throw new Error('Unsupported art manifest');
  for (const period of ['day', 'night'] as const) {
    if (!Array.isArray(m[period]) || m[period].length < 1 || m[period].length > 10) throw new Error('Invalid art rotation');
    for (const e of m[period]) {
      if (!e || typeof e.file !== 'string' || typeof e.md5 !== 'string' ||
          !/^[a-z0-9_-]+\.[a-f0-9]{32}\.(jpg|png)$/.test(e.file) ||
          !/^[a-f0-9]{32}$/.test(e.md5) || !e.file.includes(`.${e.md5}.`) ||
          !Number.isInteger(e.bytes) || e.bytes < 1 || e.bytes > 5 * 1024 * 1024 ||
          !Number.isInteger(e.width) || !Number.isInteger(e.height) ||
          e.width < 1 || e.height < 1 || e.width > 4096 || e.height > 4096) throw new Error('Invalid art entry');
    }
  }
  if (artEntries(m).reduce((sum, e) => sum + e.bytes, 0) > 30 * 1024 * 1024) throw new Error('Art catalog too large');
  return { schema: 1, day: m.day, night: m.night };
}

export function pickRemoteArt(m: ArtManifest | null, seed: number, period: Daylight): ArtEntry | null {
  if (!m) return null;
  const items = m[period];
  const index = Number.isFinite(seed) ? Math.abs(Math.floor(seed)) : 0;
  return items[index % items.length];
}

export type ArtStorage = {
  load: () => Promise<unknown>;
  save: (manifest: ArtManifest) => Promise<void>;
  valid: (entry: ArtEntry) => Promise<boolean>;
  download: (entry: ArtEntry) => Promise<void>;
  fetchManifest: () => Promise<unknown>;
};

/** No partial rotation: commit a new catalog only after ALL files are verified. */
export function createArtCache(io: ArtStorage) {
  let current: ArtManifest | null = null;
  let restored = false;
  let flight: Promise<void> | null = null;
  return {
    get: () => current,
    sync(): Promise<void> {
      if (flight) return flight;
      flight = (async () => {
        if (!restored) {
          try {
            const cached = parseArtManifest(await io.load());
            if ((await Promise.all(artEntries(cached).map(entry => io.valid(entry)))).every(Boolean)) current = cached;
          } catch { /* First launch / corrupt index: keep bundled fallback. */ }
          restored = true;
        }
        try {
          const remote = parseArtManifest(await io.fetchManifest());
          for (const entry of artEntries(remote)) {
            if (!(await io.valid(entry))) await io.download(entry);
            if (!(await io.valid(entry))) throw new Error('Art verification failed');
          }
          if (JSON.stringify(current) !== JSON.stringify(remote)) await io.save(remote);
          current = remote;
        } catch { /* Offline / partial download: retain complete previous rotation. */ }
      })().finally(() => { flight = null; });
      return flight;
    },
  };
}
