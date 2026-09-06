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
import zh2 from './zh2.json';
import bn from './bn.json';
import th from './th.json';

// 英語＋日本語を提供(2026-06-29 日本語を追加)。他言語に戻す時は下をアンコメント。
export const UI_LANGS: { code: string; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'ja', name: '日本語' },
  { code: 'ne', name: 'नेपाली' }, // 母語=ネパール語(意味/例文/解説をneで表示。2026-07-06 再有効化)
  { code: 'id', name: 'Bahasa Indonesia' }, // 母語=インドネシア語(UI/辞書/大問対訳をidで表示。2026-09-06 有効化・neと同格)
  { code: 'vi', name: 'Tiếng Việt' }, // 母語=ベトナム語(UI/辞書/大問対訳をviで表示。2026-09-06 有効化)
  { code: 'my', name: 'မြန်မာ' }, // 母語=ミャンマー語(UI/辞書/大問対訳をmyで表示。2026-09-06 有効化・全10言語コンプリート)
  { code: 'ko', name: '한국어' }, // 母語=韓国語(UI/辞書/大問対訳をkoで表示。2026-09-06 有効化)
  { code: 'zh', name: '中文（简体）' }, // 母語=中国語 簡体字(2026-09-06 有効化)。2026-09-06 に繁体字と分離
  { code: 'zh2', name: '中文（繁體）' }, // 母語=台湾繁体字(コード=zh2・国イニシャル統一)。OpenCC s2twp で zh から生成。URL slug は zh-hant
  { code: 'bn', name: 'বাংলা' }, // 母語=ベンガル語(UI/辞書/大問対訳をbnで表示。2026-09-06 有効化・id/ne/th/zhと同格)
  { code: 'th', name: 'ไทย' }, // 母語=タイ語(UI/辞書/大問対訳をthで表示。2026-09-06 有効化・id/neと同格)
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
  zh2: zh2 as Record<string, string>,
  bn: bn as Record<string, string>,
  th: th as Record<string, string>,
};
const SUPPORTED = new Set(UI_LANGS.map((l) => l.code));

/** 中国語は簡体字(zh)と繁体字(zh2=台湾繁体字)に分離。端末のlanguageTag(...-Hant)や地域(TW/HK/MO)で繁体字を判定。 */
function zhVariant(loc: { languageTag?: string | null; regionCode?: string | null }): string {
  const tag = (loc.languageTag || '').toLowerCase();
  const region = (loc.regionCode || '').toUpperCase();
  return tag.includes('hant') || ['TW', 'HK', 'MO'].includes(region) ? 'zh2' : 'zh';
}

/** UI言語判定。端末言語が対応(en/ja)ならそれ、対応外は en。中国語は簡体/繁体を地域で判定。 */
export function detectUiLang(): string {
  try {
    for (const loc of Localization.getLocales()) {
      const c = (loc.languageCode || '').toLowerCase();
      if (c === 'zh') return zhVariant(loc);
      if (SUPPORTED.has(c)) return c;
    }
  } catch { /* 取得失敗時は en */ }
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

/** 意味(訳)の表示言語。日本語UIのときは英語を既定にする(ネパール語などのL1を出さない)。
 *  それ以外は設定の母語(l1)を使う。学習後の正誤表・辞書・単語カード等、意味を出す全箇所で使う。 */
export function meaningL1(settings: { l1?: string; uiLang?: string }): string {
  const ui = settings.uiLang && SUPPORTED.has(settings.uiLang) ? settings.uiLang : detectUiLang();
  if (ui === 'ja') return 'en';
  return settings.l1 || 'en';
}

/** 大問対訳の表示言語ピック。lang→訳 のマップから l1(母語) を選び、無ければ en へフォールバック。
 *  言語汎用: content に i18n.<lang> がある言語は rehydrate が自動で map に載せるので、言語追加でこの関数もcallも改修不要。 */
export function pickTr<T>(l1: string, m?: Record<string, T>): T | undefined {
  if (!m) return undefined;
  return m[l1] ?? m.en;
}

/** 言語選択時に settings.l1(意味の表示言語) に入れる値。UI_LANGS にある言語のみ採用(ja は英語表示扱い)・他は en。
 *  言語追加は UI_LANGS に1行足す＋大問対訳データを流すだけ(ピッカー側の分岐改修は不要)。 */
export function meaningLangFor(code: string): string {
  if (code === 'ja') return 'en';
  return SUPPORTED.has(code) ? code : 'en';
}

// SNSモック撮影(Web専用)用の言語オーバーライド。DICTにある10言語を強制表示できる
// （UI_LANGS=選択可能言語は en/ja/ne のみだが、辞書は全10言語ぶん存在するため撮影は可能）。
// 本番では App の ?snsdemo 分岐でしか呼ばれない＝通常動作に一切影響しない。
let DEMO_LANG: string | null = null;
export function setDemoLang(l: string | null): void { DEMO_LANG = l && DICT[l] ? l : null; }

/** 現在のUI言語。設定(settings.uiLang)優先→端末判定。対応外は en。 */
export function useUiLang(): string {
  if (DEMO_LANG) return DEMO_LANG; // 撮影用オーバーライド（本番未使用）
  const st = useAppState();
  const lang = st.settings.uiLang;
  return lang && SUPPORTED.has(lang) ? lang : detectUiLang();
}

/** t(key, params?) を返すフック。コンポーネントで const t = useT(); {t('home.title')} の形で使う。 */
export function useT() {
  const lang = useUiLang();
  return (key: string, p?: Record<string, string | number>) => translate(lang, key, p);
}
