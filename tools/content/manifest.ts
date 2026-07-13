// app/tools/content/manifest.ts — manifest(各ファイルのsha256/件数・大問ラベル)を組み立てる純関数。
import { createHash } from 'node:crypto';
import { DAIMON_LABELS, LANGS, type Manifest, type ManifestEntry } from './schema.ts';

export function fileEntry(text: string, count: number): ManifestEntry {
  return { sha256: createHash('sha256').update(text, 'utf8').digest('hex'), bytes: Buffer.byteLength(text, 'utf8'), count };
}
export function buildManifest(files: Record<string, { text: string; count: number }>, contentVersion: string): Manifest {
  const out: Manifest['files'] = {};
  for (const [path, { text, count }] of Object.entries(files)) out[path] = fileEntry(text, count);
  return { schema: 1, contentVersion, languages: [...LANGS], daimonLabels: DAIMON_LABELS, files: out };
}
