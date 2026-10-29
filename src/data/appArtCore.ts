// アプリ同梱画像(assets/ 配下の png/jpg すべて)をOTAで差し替えるカタログ(純ロジック・react-native非依存=node --test で検証可能)。
//  ・キー＝assets/ からの相対パス(例 home/hair/hair_long.png)。カタログに無い画像は同梱のまま。
//  ・桜/柴の立ち絵は、見かけの大きさを揃える実測値(hfrac/sizeFrac・charNorm.ts と同じ意味)を一緒に配る。
import { isArtEntry, type ArtEntry } from './afterStudyRemoteCore';

export type AppArtEntry = ArtEntry & { hfrac?: number; sizeFrac?: number };
export type AppArtManifest = { schema: 1; images: Record<string, AppArtEntry> };

const KEY = /^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-][A-Za-z0-9_.-]*)*\.(png|jpe?g)$/;
const isFrac = (n: unknown) => n === undefined || (typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= 1);

/**
 * 同梱画像の位置情報(httpServerLocation)→キー。書式はビルド方式で違うので全部を同じ形に畳む:
 *  "/assets/assets/home/hair" ・ "/assets/?unstable_path=.%2Fassets%2Fhome%2Fhair" ・ "?export_path=/assets/home/hair" → "home/hair/<name>.<type>"
 */
export function appArtKey(location: string, name: string, type: string): string {
  let dir = location ?? '';
  const q = dir.match(/[?&](?:export_path|unstable_path)=([^&]*)/);
  if (q) dir = q[1];
  try { dir = decodeURIComponent(dir); } catch { /* keep raw */ }
  const parts = dir.split('/').filter(p => p && p !== '.');
  while (parts[0] === 'assets') parts.shift();
  return [...parts, `${name}.${type}`].join('/');
}

export function parseAppArtManifest(value: unknown): AppArtManifest {
  if (!value || typeof value !== 'object') throw new Error('Invalid app art manifest');
  const m = value as AppArtManifest;
  if (m.schema !== 1 || !m.images || typeof m.images !== 'object' || Array.isArray(m.images)) throw new Error('Unsupported app art manifest');
  const keys = Object.keys(m.images);
  if (keys.length > 800) throw new Error('App art catalog too long');
  let total = 0;
  for (const key of keys) {
    const e = m.images[key];
    if (!KEY.test(key) || key.includes('..')) throw new Error('Invalid app art key');
    if (!isArtEntry(e) || !isFrac(e.hfrac) || !isFrac(e.sizeFrac)) throw new Error('Invalid app art entry');
    total += e.bytes;
  }
  if (total > 150 * 1024 * 1024) throw new Error('App art catalog too large');
  return { schema: 1, images: m.images };
}

export function appArtEntries(m: AppArtManifest): ArtEntry[] {
  return Object.values(m.images);
}

export function pickAppArt(m: AppArtManifest | null, key: string): AppArtEntry | null {
  return m?.images[key] ?? null;
}
