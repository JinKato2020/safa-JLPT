// 母語(L1)の一覧と判定。ネパール語を再有効化(2026-07-06)。意味/例文/解説のne翻訳が揃っているため。
import * as Localization from 'expo-localization';

export const L1_LIST: { code: string; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'ne', name: 'नेपाली' },
  // { code: 'vi', name: 'Tiếng Việt' },
  // { code: 'zh', name: '中文' },
  // { code: 'id', name: 'Bahasa Indonesia' },
  // { code: 'my', name: 'မြန်မာ' },
];

/** 母語コード判定。端末の「主要」言語がネパール語なら 'ne'、それ以外(日本語・英語含む)は 'en'。
 *  ※以前は locale 一覧の"どれか"が ne なら ne にしていたため、日本語端末でもテスト用の ne を拾う不具合があった。 */
export function detectL1(): string {
  try {
    const primary = (Localization.getLocales()[0]?.languageCode || '').toLowerCase();
    return primary === 'ne' ? 'ne' : 'en';
  } catch { /* 取得失敗時は en */ }
  return 'en';
}

export const l1Name = (code: string): string => L1_LIST.find((x) => x.code === code)?.name ?? code;
