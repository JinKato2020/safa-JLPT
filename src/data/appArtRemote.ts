// アプリ同梱画像のOTA差し替え。カタログ＝ https://jlpt.safa-lang.com/app-art/manifest.json
//  正本＝web/app-art(作り方＝node --import tsx tools/publish_app_art.mjs --source フォルダ)。push でサイトへ配信＝アプリのビルド不要。
//  仕組み: RN が require('…png') を表示用に解決する所へ割り込み、カタログに有る画像だけ端末保存版に置き換える。
//   画面側の変更は不要(Image/ImageBackground/Animated.Image すべて対象)。届くまで・カタログに無い画像は同梱のまま。
//   アプリアイコン・起動画面(スプラッシュ)はOSが表示するので対象外(ビルドが必要)。
import 'expo-asset'; // expo-asset の解決処理を先に登録させ、その前に自前を差し込む(順序が肝)
import { Asset, ANDROID_EMBEDDED_URL_BASE_RESOURCE } from 'expo-asset';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { useSyncExternalStore } from 'react';
import { Image, type ImageSourcePropType } from 'react-native';
import { createRemoteArtStore } from './remoteArtStore';
import { appArtEntries, appArtKey, parseAppArtManifest, pickAppArt, type AppArtEntry } from './appArtCore';

const store = createRemoteArtStore({
  base: 'https://jlpt.safa-lang.com/app-art/',
  index: 'app_art_manifest_v1',
  dir: 'app_art_v1/',
  catalog: { parse: parseAppArtManifest, entries: appArtEntries },
  maxManifestChars: 600_000,
});

export function syncAppArt(): Promise<void> {
  return store.sync();
}

/** 差し替えが有効になったら再描画する(開きっぱなしの画面用)。 */
export function useAppArt() {
  return useSyncExternalStore(store.subscribe, store.get);
}

type Resolver = {
  asset: { httpServerLocation: string; name: string; type: string; fileHashes?: string[] };
  defaultAsset(): unknown; fromSource(uri: string): unknown; resourceIdentifierWithoutScale(): unknown;
};
const keyCache = new WeakMap<object, string>();
const keyOf = (asset: Resolver['asset']) => {
  let k = keyCache.get(asset);
  if (k === undefined) { k = appArtKey(asset.httpServerLocation, asset.name, asset.type); keyCache.set(asset, k); }
  return k;
};
const byUri = new Map<string, AppArtEntry>();

function otaTransformer(resolver: Resolver) {
  const entry = pickAppArt(store.get(), keyOf(resolver.asset));
  const uri = entry ? store.uri(entry) : null;
  if (!entry || !uri) return null;
  byUri.set(uri, entry);
  return { __packager_asset: false, uri, width: entry.width, height: entry.height, scale: 1 };
}

// expo-asset(PlatformUtils)と同じ判定=OTA更新版(expo-updates)の画像を使う状態か。Expo Go は本番に無いので省く。
const ExpoUpdates = requireOptionalNativeModule<{ isEnabled?: boolean; isUsingEmbeddedAssets?: boolean }>('ExpoUpdates');
const IS_ENV_WITH_LOCAL_ASSETS = !!ExpoUpdates?.isEnabled && !ExpoUpdates?.isUsingEmbeddedAssets;

// expo-asset(Asset.fx)と同じ処理。setCustomSourceTransformer は既存を消すので、自前の後ろへ同じものを積み直す。
function expoAssetTransformer(resolver: Resolver) {
  try {
    if (resolver.asset.fileHashes) {
      const asset = Asset.fromMetadata(resolver.asset as never);
      if (asset.uri.startsWith(ANDROID_EMBEDDED_URL_BASE_RESOURCE)) return resolver.resourceIdentifierWithoutScale();
      return resolver.fromSource(asset.downloaded ? asset.localUri! : asset.uri);
    }
    return resolver.defaultAsset();
  } catch {
    return resolver.defaultAsset();
  }
}

const ras = Image.resolveAssetSource as unknown as {
  setCustomSourceTransformer?: (fn: (r: Resolver) => unknown) => void;
  addCustomSourceTransformer?: (fn: (r: Resolver) => unknown) => void;
};
if (ras.setCustomSourceTransformer && ras.addCustomSourceTransformer) {
  ras.setCustomSourceTransformer(otaTransformer);
  if (IS_ENV_WITH_LOCAL_ASSETS) ras.addCustomSourceTransformer(expoAssetTransformer);
}

/** この画像が差し替え中なら配信版の情報(寸法・実測値)。同梱のままなら null。 */
export function appArtFor(source: ImageSourcePropType | null | undefined): AppArtEntry | null {
  if (source == null || typeof source !== 'number') return null;
  const uri = Image.resolveAssetSource(source)?.uri;
  return uri ? byUri.get(uri) ?? null : null;
}
