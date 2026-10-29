// 季節の場面画像(ホーム/各タブ背景・町マップ)のOTAカタログ(純ロジック・react-native非依存=node --test で検証可能)。
//  ・カタログに無い場所は同梱画像を使う(空カタログ {schema:1,slots:{}} = 全部同梱に戻す)。
//  ・町マップは背景と前面レイヤー(木・家)が画素で重なるため、4枠そろって差し替える(一部だけは不可)。
//  ・前面レイヤーの位置はワールド座標(1024)。カタログに frame が無ければ同梱の秋版の位置を使う。
import { isArtEntry, type ArtEntry } from './afterStudyRemoteCore';
import type { Daylight } from './daylight';

export const SCENE_SLOTS = ['home', 'word', 'exam', 'dict', 'map', 'map_tree', 'roof_shosai', 'roof_shoko'] as const;
export type SceneSlot = (typeof SCENE_SLOTS)[number];
export const MAP_GROUP: SceneSlot[] = ['map', 'map_tree', 'roof_shosai', 'roof_shoko'];
export type Frame = { x: number; y: number; w: number; h: number };
export type SceneEntry = ArtEntry & { frame?: Frame };
export type SceneManifest = { schema: 1; slots: Partial<Record<SceneSlot, Record<Daylight, SceneEntry>>> };

const WORLD = 1024;
// 同梱の秋版の前面レイヤー位置(KotobaTownScreen と共用)。木は原寸1254pxの地図で画素一致を確認済み→1024へ換算。
export const BUNDLED_FRAMES: Partial<Record<SceneSlot, Record<Daylight, Frame>>> = {
  map_tree: {
    day: { x: 404 * WORLD / 1254, y: 247 * WORLD / 1254, w: 390 * WORLD / 1254, h: 267 * WORLD / 1254 },
    night: { x: 411 * WORLD / 1254, y: 258 * WORLD / 1254, w: 373 * WORLD / 1254, h: 240 * WORLD / 1254 },
  },
  roof_shosai: { day: { x: 742, y: 448, w: 256, h: 160 }, night: { x: 742, y: 448, w: 256, h: 160 } },
  roof_shoko: { day: { x: 349, y: 625, w: 356, h: 180 }, night: { x: 349, y: 623, w: 356, h: 180 } },
};

function isFrame(f: unknown): f is Frame {
  const a = f as Frame;
  return !!a && [a.x, a.y, a.w, a.h].every(n => typeof n === 'number' && Number.isFinite(n)) &&
    a.x >= 0 && a.y >= 0 && a.w > 0 && a.h > 0 && a.x + a.w <= WORLD && a.y + a.h <= WORLD;
}

export function parseSceneManifest(value: unknown): SceneManifest {
  if (!value || typeof value !== 'object') throw new Error('Invalid scene manifest');
  const m = value as SceneManifest;
  if (m.schema !== 1 || !m.slots || typeof m.slots !== 'object' || Array.isArray(m.slots)) throw new Error('Unsupported scene manifest');
  const slots: SceneManifest['slots'] = {};
  for (const [key, pair] of Object.entries(m.slots)) {
    if (!(SCENE_SLOTS as readonly string[]).includes(key)) throw new Error('Unknown scene slot');
    for (const period of ['day', 'night'] as const) {
      const e = pair?.[period];
      if (!isArtEntry(e)) throw new Error('Invalid scene entry');
      if (e.frame !== undefined && !isFrame(e.frame)) throw new Error('Invalid scene frame');
    }
    slots[key as SceneSlot] = { day: pair.day, night: pair.night };
  }
  const mapCount = MAP_GROUP.filter(k => slots[k]).length;
  if (mapCount !== 0 && mapCount !== MAP_GROUP.length) throw new Error('Map art must be replaced as a full set');
  const total = sceneEntries({ schema: 1, slots }).reduce((sum, e) => sum + e.bytes, 0);
  if (total > 40 * 1024 * 1024) throw new Error('Scene catalog too large');
  return { schema: 1, slots };
}

export function sceneEntries(m: SceneManifest): ArtEntry[] {
  return Object.values(m.slots).flatMap(pair => (pair ? [pair.day, pair.night] : []));
}

export function pickSceneArt(m: SceneManifest | null, slot: SceneSlot, period: Daylight): SceneEntry | null {
  return m?.slots[slot]?.[period] ?? null;
}

/** 前面レイヤーの位置: カタログ指定 → 同梱の位置。 */
export function sceneFrame(entry: SceneEntry | null, slot: SceneSlot, period: Daylight): Frame | null {
  return entry?.frame ?? BUNDLED_FRAMES[slot]?.[period] ?? null;
}
