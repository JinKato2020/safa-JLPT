// 国の選択肢(オンボーディングの「国」用)。日本語学習者に多い国を中心に厳選。
// 国旗絵文字はISO2コードから生成。表示名は英語(name)＋日本語(ja)。端末の言語から自動判定して初期選択に使う。
import * as Localization from 'expo-localization';

export const flagOf = (cc: string): string =>
  cc.toUpperCase().replace(/./g, (ch) => String.fromCodePoint(127397 + ch.charCodeAt(0)));

export type Country = { code: string; name: string; ja: string };

// 母語(意味の翻訳)に対応する言語の国＋日本＋英語圏(アメリカ)＋その他。ja=日本語表示名。
// 対応言語: vi/zh/ko/ne/id/my/th/bn(意味翻訳あり)＋ja(日本)＋en(アメリカ)。台湾はzh圏として併記。
export const COUNTRIES: Country[] = [
  { code: 'VN', name: 'Vietnam', ja: 'ベトナム' }, { code: 'CN', name: 'China', ja: '中国' }, { code: 'TW', name: 'Taiwan', ja: '台湾' },
  { code: 'KR', name: 'Korea', ja: '韓国' }, { code: 'NP', name: 'Nepal', ja: 'ネパール' }, { code: 'ID', name: 'Indonesia', ja: 'インドネシア' },
  { code: 'MM', name: 'Myanmar', ja: 'ミャンマー' }, { code: 'TH', name: 'Thailand', ja: 'タイ' }, { code: 'BD', name: 'Bangladesh', ja: 'バングラデシュ' },
  { code: 'JP', name: 'Japan', ja: '日本' }, { code: 'US', name: 'USA', ja: 'アメリカ' },
  { code: 'XX', name: 'Other', ja: 'その他' },
];

// 言語コード→代表国。1言語=ほぼ1国のものだけ(あいまいな言語はAMBIGUOUSで地域判定に回す)。
const LANG_CC: Record<string, string> = {
  ja: 'JP', ne: 'NP', vi: 'VN', ko: 'KR', th: 'TH', id: 'ID', my: 'MM', mn: 'MN',
  km: 'KH', si: 'LK', bn: 'BD', hi: 'IN', ta: 'IN', tr: 'TR', uk: 'UA', ru: 'RU',
  it: 'IT', de: 'DE', tl: 'PH', fil: 'PH',
};
// 複数国で使う言語=言語だけでは国を決められないので端末の地域で判定する。
const AMBIGUOUS = new Set(['en', 'zh', 'es', 'pt', 'fr', 'ar']);

/** 表示名。lang='ja' のとき日本語名、それ以外は英語名。 */
export const countryLabel = (code: string | undefined | null, lang?: string): string => {
  const c = COUNTRIES.find((x) => x.code === code);
  if (!c) return lang === 'ja' ? 'その他' : 'Other';
  return lang === 'ja' ? c.ja : c.name;
};

// 後方互換(英語名)。
export const countryName = (code: string | undefined | null): string => countryLabel(code, 'en');

/** 端末の「言語」から国を推定(=デバイスの言語で自動選択)。
 *  ・英語/中国語など複数国で使う言語は端末の地域で判定(en+AU→豪, zh+TW→台湾)。
 *  ・それ以外は言語→代表国(ベトナム語→ベトナム 等)。取れなければ地域→'XX'。 */
export function detectCountry(): string {
  try {
    const loc = Localization.getLocales?.()[0];
    const lang = (loc?.languageCode || '').toLowerCase();
    const region = (loc?.regionCode || '').toUpperCase();
    const inList = (cc: string) => COUNTRIES.some((c) => c.code === cc);
    if (AMBIGUOUS.has(lang) && inList(region)) return region;
    const byLang = LANG_CC[lang];
    if (byLang && inList(byLang)) return byLang;
    if (inList(region)) return region;
  } catch { /* noop */ }
  return 'XX';
}
