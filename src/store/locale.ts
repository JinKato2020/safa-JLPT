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

/** 母語コード判定。端末言語がネパール語なら 'ne'、それ以外は 'en'。 */
export function detectL1(): string {
  try {
    for (const loc of Localization.getLocales()) {
      if ((loc.languageCode || '').toLowerCase() === 'ne') return 'ne';
    }
  } catch { /* 取得失敗時は en */ }
  return 'en';
}

export const l1Name = (code: string): string => L1_LIST.find((x) => x.code === code)?.name ?? code;
