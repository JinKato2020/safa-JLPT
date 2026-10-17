// 番人: 聴解音声は mp3 と m4a(AAC) を必ず併置する（メモリ audio-dual-format-mp3-and-opus）。
// assets/audio 直下(=聴解)の各 {id}.mp3 に {id}.m4a が存在するか検査。
// 片方だけ更新（新規/修正で m4a 生成を忘れる）とビルドが落ちる。m4a生成= python tools/audio/build_m4a.py。
// ※旧opus(.opus)はiPad(iOS)で再生できず廃止(2026-09-27)。新アプリ再生形式=m4a。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

// テストは常にリポジトリルートから実行される(build.ps1 は $APP=ルート / npm test も同様)。
const AUDIO_DIR = join(process.cwd(), 'assets', 'audio');
const files = readdirSync(AUDIO_DIR, { withFileTypes: true })
  .filter((d) => d.isFile())
  .map((d) => d.name);
const mp3 = new Set(files.filter((f) => f.endsWith('.mp3')).map((f) => f.slice(0, -4)));
const m4a = new Set(files.filter((f) => f.endsWith('.m4a')).map((f) => f.slice(0, -4)));

test('全 mp3 に対応する m4a がある（python tools/audio/build_m4a.py で生成）', () => {
  const missing = [...mp3].filter((id) => !m4a.has(id)).sort();
  assert.deepEqual({ missing: missing.length, sample: missing.slice(0, 10) }, { missing: 0, sample: [] });
});

test('孤立 m4a（対応する mp3 が無い）がない', () => {
  const orphan = [...m4a].filter((id) => !mp3.has(id)).sort();
  assert.deepEqual({ orphan: orphan.length, sample: orphan.slice(0, 10) }, { orphan: 0, sample: [] });
});
