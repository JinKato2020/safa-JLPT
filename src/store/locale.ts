// 母語(L1)の一覧と判定。※英語のみ運用(2026-06-28・App C英語枠)。多言語復帰時は全言語＋自動判定を戻す。

export const L1_LIST: { code: string; name: string }[] = [
  { code: 'en', name: 'English' },
  // { code: 'vi', name: 'Tiếng Việt' },
  // { code: 'ne', name: 'नेपाली' },
  // { code: 'zh', name: '中文' },
  // { code: 'id', name: 'Bahasa Indonesia' },
  // { code: 'my', name: 'မြန်မာ' },
];

/** 母語コード判定。※英語のみ運用につき常に 'en'。 */
export function detectL1(): string {
  return 'en';
}

export const l1Name = (code: string): string => L1_LIST.find((x) => x.code === code)?.name ?? code;
