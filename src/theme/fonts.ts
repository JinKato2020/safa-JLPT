// アプリ全体のフォント。設定で切替可(system/丸ゴシック/明朝/教科書体)。すべてOFL・商用可。
// App B「聞いて話せる日本語」から移植(共有UI正本=このJLPT側に集約)。
// ・useAppFonts() で同梱ttfをロード。
// ・setActiveFont(key) で現在フォントを切替(App Rootが設定値で毎レンダー同期)。
// ・installGlobalFont() が全 <Text> の fontWeight を現在フォントの対応ファミリーへ自動マッピング
//   (Androidは custom font の fontWeight が無効なため、ウェイト別ファミリー指定が必須)。
// ・fontFamily を自前指定している Text(アイコン等)は変更せず尊重。
import { useFonts } from 'expo-font';
import { Text as RNText, StyleSheet } from 'react-native';

type WeightMap = { r: string; m: string; b: string };
// null = 端末既定(何も指定しない)。
export const FONT_SETS: Record<string, WeightMap | null> = {
  system: null,
  maru: { r: 'ZenMaruGothic-Regular', m: 'ZenMaruGothic-Medium', b: 'ZenMaruGothic-Bold' },
  mincho: { r: 'ShipporiMincho-Regular', m: 'ShipporiMincho-Regular', b: 'ShipporiMincho-Bold' },
  kyokasho: { r: 'KleeOne-Regular', m: 'KleeOne-Regular', b: 'KleeOne-SemiBold' },
};
export const FONT_KEYS = ['system', 'maru', 'mincho', 'kyokasho'] as const;
export type FontKey = (typeof FONT_KEYS)[number];

// 既定=丸ゴシック(App B と同じ「誠意体」寄りの柔らかい書体)。
let ACTIVE = 'maru';
/** 現在フォントを設定。未知キーは無視。 */
export function setActiveFont(k: string | undefined) {
  if (k && k in FONT_SETS) ACTIVE = k;
}

function familyFor(weight?: string | number): string | undefined {
  const set = FONT_SETS[ACTIVE];
  if (!set) return undefined; // system
  const w = weight != null ? String(weight) : '400';
  if (w === '700' || w === '800' || w === '900' || w === 'bold') return set.b;
  if (w === '500' || w === '600') return set.m;
  return set.r;
}

/** 同梱フォントをロード。[loaded, error] を返す。 */
export function useAppFonts() {
  return useFonts({
    'ZenMaruGothic-Regular': require('../../assets/fonts/ZenMaruGothic-Regular.ttf'),
    'ZenMaruGothic-Medium': require('../../assets/fonts/ZenMaruGothic-Medium.ttf'),
    'ZenMaruGothic-Bold': require('../../assets/fonts/ZenMaruGothic-Bold.ttf'),
    'ShipporiMincho-Regular': require('../../assets/fonts/ShipporiMincho-Regular.ttf'),
    'ShipporiMincho-Bold': require('../../assets/fonts/ShipporiMincho-Bold.ttf'),
    'KleeOne-Regular': require('../../assets/fonts/KleeOne-Regular.ttf'),
    'KleeOne-SemiBold': require('../../assets/fonts/KleeOne-SemiBold.ttf'),
  });
}

let patched = false;
// 現在フォントのファミリーを style へ注入(既に fontFamily 指定=アイコン等は尊重)。
function injectFont<T extends { style?: unknown }>(props: T): T {
  const flat = StyleSheet.flatten(props.style as never) as { fontWeight?: string | number; fontFamily?: string } | undefined;
  if (flat && flat.fontFamily) return props;
  const fam = familyFor(flat?.fontWeight);
  if (!fam) return props; // system既定
  return { ...props, style: [{ fontFamily: fam }, props.style, { fontWeight: undefined }] };
}

/** 全 <Text> に現在フォントを適用。RN0.81/React19 の Text は関数コンポーネントで .render を持たないため、
 *  自動JSXランタイム(react/jsx-runtime の jsx/jsxs, dev の jsxDEV)を包んで Text 生成時にフォントを注入する。 */
export function installGlobalFont() {
  if (patched) return;
  patched = true;
  const wrap = (orig: (...a: unknown[]) => unknown) =>
    function (type: unknown, props: { style?: unknown } | null, ...rest: unknown[]) {
      if (type === RNText && props != null) return orig(type, injectFont(props), ...rest);
      return orig(type, props as never, ...rest);
    };
  const patchMod = (mod: Record<string, unknown> | null, keys: string[]) => {
    if (!mod) return;
    for (const k of keys) {
      const fn = mod[k];
      if (typeof fn === 'function') { try { mod[k] = wrap(fn as (...a: unknown[]) => unknown); } catch { /* frozen: 無視 */ } }
    }
  };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  try { patchMod(require('react/jsx-runtime') as Record<string, unknown>, ['jsx', 'jsxs']); } catch { /* noop */ }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  try { patchMod(require('react/jsx-dev-runtime') as Record<string, unknown>, ['jsxDEV']); } catch { /* noop */ }
  // 保険: classicランタイム(React.createElement)経路も包む(ライブラリ等)。
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  try {
    const React = require('react') as { createElement: (...a: unknown[]) => unknown };
    const oc = React.createElement;
    React.createElement = function (...args: unknown[]) {
      const type = args[0];
      const props = args[1] as { style?: unknown } | null;
      if (type === RNText && props != null) return oc(type, injectFont(props), ...args.slice(2));
      return oc(...args);
    };
  } catch { /* noop */ }
}

// import時に一度だけパッチ(ロード前は端末既定→ロード後に反映)。
installGlobalFont();
