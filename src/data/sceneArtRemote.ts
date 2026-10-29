// 季節の場面画像(ホーム/各タブ背景・町マップ)をOTAで差し替える。カタログ＝ https://jlpt.safa-lang.com/scene-art/manifest.json
//  正本＝web/scene-art(作り方＝node tools/publish_scene_art.mjs --source フォルダ)。push でサイトへ配信＝アプリのビルド不要。
import { useSyncExternalStore } from 'react';
import type { ImageSourcePropType } from 'react-native';
import { createRemoteArtStore } from './remoteArtStore';
import { parseSceneManifest, pickSceneArt, sceneEntries, sceneFrame, type Frame, type SceneSlot } from './sceneArtCore';
import type { Daylight } from './daylight';

const store = createRemoteArtStore({
  base: 'https://jlpt.safa-lang.com/scene-art/',
  index: 'scene_art_manifest_v1',
  dir: 'scene_art_v1/',
  catalog: { parse: parseSceneManifest, entries: sceneEntries },
});

export function syncSceneArt(): Promise<void> {
  return store.sync();
}

/** 新しいカタログが有効になったら再描画する(タブ背景は開きっぱなしのため)。 */
export function useSceneArt() {
  return useSyncExternalStore(store.subscribe, store.get);
}

/** OTA画像(無ければ null=同梱画像を使う)。 */
export function sceneImage(slot: SceneSlot, period: Daylight): ImageSourcePropType | null {
  const entry = pickSceneArt(store.get(), slot, period);
  const uri = entry ? store.uri(entry) : null;
  return entry && uri ? { uri, width: entry.width, height: entry.height } : null;
}

/** 前面レイヤーの画像と位置。OTAが無ければ同梱画像＋同梱の位置。 */
export function sceneLayer(slot: SceneSlot, period: Daylight, bundled: ImageSourcePropType): { source: ImageSourcePropType; frame: Frame } {
  const entry = pickSceneArt(store.get(), slot, period);
  const uri = entry ? store.uri(entry) : null;
  const source = entry && uri ? { uri, width: entry.width, height: entry.height } : bundled;
  return { source, frame: sceneFrame(entry && uri ? entry : null, slot, period)! };
}
