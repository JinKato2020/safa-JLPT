// 母語(L1)の一覧と、端末言語からの自動判定。言語決定はボタンでなく自動(掲示板)。
import * as Localization from 'expo-localization';

export const L1_LIST: { code: string; name: string }[] = [
  { code: 'vi', name: 'Tiếng Việt' },
  { code: 'ne', name: 'नेपाली' },
  { code: 'en', name: 'English' },
  { code: 'zh', name: '中文' },
  { code: 'id', name: 'Bahasa Indonesia' },
  { code: 'my', name: 'မြန်မာ' },
];
const SUPPORTED = new Set(L1_LIST.map((x) => x.code));

/** 端末の言語設定から対応する母語コードを判定。非対応・取得失敗時は英語。 */
export function detectL1(): string {
  try {
    for (const loc of Localization.getLocales()) {
      const code = (loc.languageCode || '').toLowerCase();
      if (SUPPORTED.has(code)) return code;
    }
  } catch {
    // 取得失敗 → 既定(en)
  }
  return 'en';
}

export const l1Name = (code: string): string => L1_LIST.find((x) => x.code === code)?.name ?? code;
