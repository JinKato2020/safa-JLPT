// プライバシーポリシー / 利用規約の本番URL(safa-lang.com にホスト・10言語)。
// アプリ内には本文を持たず、端末のUI言語に応じたページをブラウザで開く(ストア審査もこのURLを申告)。
// 対応言語コードはアプリのUI言語(UI_LANGS)と一致。未対応言語は英語にフォールバック。
export const LEGAL_LANGS = ['en', 'ja', 'zh', 'vi', 'ko', 'id', 'ne', 'th', 'bn', 'my'] as const;

/** 種別(privacy|terms)とUI言語から本番URLを組み立てる。例: https://safa-lang.com/jlpt/ja/privacy/ */
export function legalUrl(kind: 'privacy' | 'terms', lang: string): string {
  const l = (LEGAL_LANGS as readonly string[]).includes(lang) ? lang : 'en';
  return `https://safa-lang.com/jlpt/${l}/${kind}/`;
}
