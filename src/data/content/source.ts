// app/src/data/content/source.ts — 問題コンテンツの現行ソース。既定=バンドル(baseline)。
// 起動時にキャッシュ済みOTAファイルがあれば setContentFiles で上書き合成する(cached優先)。
// data/index.ts は getContentFiles() を rehydrate に渡す(import時に一度評価)。
import { BUNDLED } from './bundled.generated';

let CONTENT_FILES: Record<string, unknown> = BUNDLED;
export function getContentFiles(): Record<string, unknown> { return CONTENT_FILES; }
/** キャッシュ済みOTAファイル(path→parsed)を baseline に上書き合成。data/index 読込より前に呼ぶこと。 */
export function setContentFiles(cached: Record<string, unknown>): void {
  CONTENT_FILES = { ...BUNDLED, ...cached };
}
