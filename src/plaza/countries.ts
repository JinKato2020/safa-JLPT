// 国の選択肢(オンボーディングの「国」用)。日本語学習者に多い国を中心に厳選。
// 国旗絵文字はISO2コードから生成。名前は英語(中立)。端末の地域から自動判定して初期選択に使う。
import * as Localization from 'expo-localization';

export const flagOf = (cc: string): string =>
  cc.toUpperCase().replace(/./g, (ch) => String.fromCodePoint(127397 + ch.charCodeAt(0)));

export type Country = { code: string; name: string };

// 主要な学習者の国(+主要国)。末尾に「その他」。
export const COUNTRIES: Country[] = [
  { code: 'VN', name: 'Vietnam' }, { code: 'CN', name: 'China' }, { code: 'KR', name: 'Korea' },
  { code: 'TW', name: 'Taiwan' }, { code: 'NP', name: 'Nepal' }, { code: 'ID', name: 'Indonesia' },
  { code: 'MM', name: 'Myanmar' }, { code: 'TH', name: 'Thailand' }, { code: 'PH', name: 'Philippines' },
  { code: 'MN', name: 'Mongolia' }, { code: 'IN', name: 'India' }, { code: 'LK', name: 'Sri Lanka' },
  { code: 'BD', name: 'Bangladesh' }, { code: 'KH', name: 'Cambodia' }, { code: 'US', name: 'USA' },
  { code: 'BR', name: 'Brazil' }, { code: 'MX', name: 'Mexico' }, { code: 'PE', name: 'Peru' },
  { code: 'GB', name: 'UK' }, { code: 'FR', name: 'France' }, { code: 'DE', name: 'Germany' },
  { code: 'IT', name: 'Italy' }, { code: 'ES', name: 'Spain' }, { code: 'RU', name: 'Russia' },
  { code: 'UA', name: 'Ukraine' }, { code: 'TR', name: 'Turkey' }, { code: 'EG', name: 'Egypt' },
  { code: 'AU', name: 'Australia' }, { code: 'CA', name: 'Canada' }, { code: 'XX', name: 'Other' },
];

export const countryName = (code: string | undefined | null): string =>
  COUNTRIES.find((c) => c.code === code)?.name ?? 'Other';

/** 端末の地域から国コードを推定。リストに無ければ 'XX'(その他)。 */
export function detectCountry(): string {
  try {
    const r = Localization.getLocales?.()[0]?.regionCode;
    if (r) { const up = r.toUpperCase(); if (COUNTRIES.some((c) => c.code === up)) return up; }
  } catch { /* noop */ }
  return 'XX';
}
