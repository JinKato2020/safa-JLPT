// app/src/data/content/otaDiff.ts — OTA差分の純関数(要ダウンロードのパス算出)。RN非依存でテスト可能。
type ManifestLike = { files: Record<string, { sha256: string }> };
/** リモートmanifestとキャッシュ済みsha群を比較し、sha変化＋新規のパスだけ返す。 */
export function diffManifest(remote: ManifestLike, cachedShas: Record<string, string>): string[] {
  return Object.entries(remote.files).filter(([p, e]) => cachedShas[p] !== e.sha256).map(([p]) => p);
}
