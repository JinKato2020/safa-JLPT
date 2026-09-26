// 番人: 聴解音声は mp3 と opus を必ず併置する（メモリ audio-dual-format-mp3-and-opus）。
// assets/audio 直下(=聴解)の各 {id}.mp3 に {id}.opus が存在するか検査。
// 片方だけ更新（新規/修正で opus 生成を忘れる）とビルドが落ちる。opus生成= tools/audio/build_opus.py。
import { readdirSync } from 'fs';
import { join } from 'path';

const AUDIO_DIR = join(__dirname, '..', '..', 'assets', 'audio');

describe('聴解音声 mp3/opus 併置', () => {
  const files = readdirSync(AUDIO_DIR, { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => d.name);
  const mp3 = new Set(files.filter((f) => f.endsWith('.mp3')).map((f) => f.slice(0, -4)));
  const opus = new Set(files.filter((f) => f.endsWith('.opus')).map((f) => f.slice(0, -5)));

  it('全 mp3 に対応する opus がある（python tools/audio/build_opus.py で生成）', () => {
    const missing = [...mp3].filter((id) => !opus.has(id)).sort();
    expect({ missingOpusCount: missing.length, sample: missing.slice(0, 10) })
      .toEqual({ missingOpusCount: 0, sample: [] });
  });

  it('孤立 opus（対応する mp3 が無い）がない', () => {
    const orphan = [...opus].filter((id) => !mp3.has(id)).sort();
    expect({ orphanOpusCount: orphan.length, sample: orphan.slice(0, 10) })
      .toEqual({ orphanOpusCount: 0, sample: [] });
  });
});
