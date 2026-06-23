// UI多言語化(i18n)。UI文字列のみ(語彙等のコンテンツは対象外)。
// 基準=ja.json。各言語JSONに無いキーは ja → key の順でフォールバック。{name} はプレースホルダ。
// 既定UI言語=端末言語の自動判定(対応外は en)。設定で手動変更可(settings.uiLang)。
import * as Localization from 'expo-localization';
import { useAppState } from '../store/store';
import ja from './ja.json';
import en from './en.json';
import ne from './ne.json';
import vi from './vi.json';
import my from './my.json';
import id from './id.json';
import ko from './ko.json';
import zh from './zh.json';
import bn from './bn.json';
import th from './th.json';

export const UI_LANGS: { code: string; name: string }[] = [
  { code: 'ja', name: '日本語' },
  { code: 'en', name: 'English' },
  { code: 'ne', name: 'नेपाली' },
  { code: 'vi', name: 'Tiếng Việt' },
  { code: 'my', name: 'မြန်မာ' },
  { code: 'id', name: 'Bahasa Indonesia' },
  { code: 'ko', name: '한국어' },
  { code: 'zh', name: '中文' },
  { code: 'bn', name: 'বাংলা' },
  { code: 'th', name: 'ไทย' },
];

const DICT: Record<string, Record<string, string>> = {
  ja: ja as Record<string, string>,
  en: en as Record<string, string>,
  ne: ne as Record<string, string>,
  vi: vi as Record<string, string>,
  my: my as Record<string, string>,
  id: id as Record<string, string>,
  ko: ko as Record<string, string>,
  zh: zh as Record<string, string>,
  bn: bn as Record<string, string>,
  th: th as Record<string, string>,
};
const SUPPORTED = new Set(UI_LANGS.map((l) => l.code));

/** 端末言語からUI言語を判定。対応外は en。 */
export function detectUiLang(): string {
  try {
    for (const loc of Localization.getLocales()) {
      const c = (loc.languageCode || '').toLowerCase();
      if (SUPPORTED.has(c)) return c;
    }
  } catch {
    /* noop */
  }
  return 'en';
}

function fmt(s: string, p?: Record<string, string | number>): string {
  return p ? s.replace(/\{(\w+)\}/g, (_, k) => String(p[k] ?? '')) : s;
}

/** 純粋翻訳(lang指定)。lang→ja→key の順でフォールバック。 */
export function translate(lang: string, key: string, p?: Record<string, string | number>): string {
  const s = DICT[lang]?.[key] ?? DICT.ja[key] ?? key;
  return fmt(s, p);
}

/** 現在のUI言語(settings.uiLang or 端末判定)。 */
export function useUiLang(): string {
  const { settings } = useAppState();
  return settings.uiLang || detectUiLang();
}

/** t(key, params?) を返すフック。コンポーネントで const t = useT(); {t('home.title')} の形で使う。 */
export function useT() {
  const lang = useUiLang();
  return (key: string, p?: Record<string, string | number>) => translate(lang, key, p);
}
