// プライバシーポリシー / 利用規約の本番URL(safa-lang.com にホスト・11言語)。
// アプリ内には本文を持たず、端末のUI言語に応じたページをブラウザで開く(ストア審査もこのURLを申告)。
// 対応言語コードはアプリのUI言語(UI_LANGS)と一致。未対応言語は英語にフォールバック。
// URLスラッグは小文字。台湾繁体字はアプリ内コード=zh2 で、WEBの繁体字ページも /jlpt/zh2/ にある
// (本番実測 2026-09-29: zh2/terms=「使用條款」lang=zh-Hant で到達。zh-hant は日本語トップへフォールバック=NG)。
export const LEGAL_LANGS = ['en', 'ja', 'zh', 'zh2', 'vi', 'ko', 'id', 'ne', 'th', 'bn', 'my', 'hi'] as const;
// アプリ内言語コード → WEBのURLスラッグ(異なる場合のみ)。既定は lang.toLowerCase()。現状は全言語が既定どおり。
const URL_SLUG: Record<string, string> = {};

/** 種別(privacy|terms)とUI言語から本番URLを組み立てる。例: https://safa-lang.com/jlpt/ja/privacy/ */
export function legalUrl(kind: 'privacy' | 'terms', lang: string): string {
  const l = (LEGAL_LANGS as readonly string[]).includes(lang) ? lang : 'en';
  const slug = URL_SLUG[l] ?? l.toLowerCase();
  return `https://safa-lang.com/jlpt/${slug}/${kind}/`;
}
