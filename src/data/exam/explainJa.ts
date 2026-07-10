// 解説の日本語(同梱)アクセサ＋言語フォールバック解決。JSON import のみ＝node安全(FS/native非依存)。
import jaMap from './explain.ja.json';

const JA = jaMap as Record<string, string>;

/** 問題id(kb-NNNNNN)の日本語解説。無ければ undefined。 */
export function explainJa(id: string): string | undefined {
  return JA[id];
}

/** 要求言語のマップがあればその訳、無ければ ja へフォールバック。 */
export function resolveExplain(id: string, langMap: Record<string, string> | undefined): string | undefined {
  return (langMap && langMap[id]) || JA[id];
}
