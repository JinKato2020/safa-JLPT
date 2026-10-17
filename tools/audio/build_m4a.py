# 聴解音声 mp3 -> m4a(AAC 40k mono) 併置生成ツール（仕組みの正本）。
#
# 方針（メモリ [[audio-dual-format-mp3-and-opus]]）:
#  ・m4a(AAC) は必ず現行の 48k mp3 から変換する（git履歴の原本からは作らない＝内容変質回避）。
#  ・mp3 と m4a を assets/audio/ に併置（{id}.mp3 と {id}.m4a）。mp3 の CDN URL は不変＝旧アプリ互換。
#  ・新アプリ(iOS/Android)は m4a を取得。opus は iPad(iOS)で再生できない端末があるため廃止（2026-09-27）。
#  ・AAC は iOS/iPad/Android すべてで確実に再生できる標準形式。faststart でストリーミング開始も速い。
#  ・音声を新規作成・修正したら、このツールを流して m4a も必ず更新する（片方だけ禁止）。
#
# 使い方:
#   python tools/audio/build_m4a.py            # 差分生成（m4a欠落 or mp3が新しいものだけ）
#   python tools/audio/build_m4a.py --force    # 全再生成
#   python tools/audio/build_m4a.py --file assets/audio/N3-C-K-0001.mp3   # 個別
#
# 対象 = assets/audio 直下の *.mp3（聴解のみ。vocab/ kanji/ は辞書音声=対象外=mp3のまま）。
import os, sys, glob, subprocess
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
AUDIO_DIR = os.path.join(ROOT, 'assets', 'audio')
BITRATE = '40k'  # AAC-LC mono。試験リスニングの明瞭さを保ちつつ mp3(48k) 比約2割減。iOS/iPad/Android 再生可。

def targets(force, one):
    if one:
        return [one]
    return sorted(glob.glob(os.path.join(AUDIO_DIR, '*.mp3')))  # 直下のみ=聴解

def needs(mp3, force):
    m4a = mp3[:-4] + '.m4a'
    if force or not os.path.exists(m4a):
        return True
    return os.path.getmtime(mp3) > os.path.getmtime(m4a)

def convert(mp3):
    m4a = mp3[:-4] + '.m4a'
    r = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', mp3,
                        '-c:a', 'aac', '-b:a', BITRATE, '-ac', '1',
                        '-movflags', '+faststart', m4a],
                       capture_output=True, text=True)
    if r.returncode != 0:
        return ('fail', mp3, r.stderr.strip()[:200])
    return ('ok', mp3, None)

def main():
    force = '--force' in sys.argv
    one = None
    if '--file' in sys.argv:
        one = os.path.abspath(sys.argv[sys.argv.index('--file') + 1])
    allmp3 = targets(force, one)
    todo = [m for m in allmp3 if needs(m, force)]
    print(f'mp3総数={len(allmp3)} / 変換対象={len(todo)} (bitrate={BITRATE} mono AAC)')
    ok = fail = 0; fails = []
    with ThreadPoolExecutor(max_workers=8) as ex:
        for status, mp3, err in ex.map(convert, todo):
            if status == 'ok': ok += 1
            else:
                fail += 1; fails.append((mp3, err))
    print(f'完了: 変換{ok} / 失敗{fail} / スキップ{len(allmp3)-len(todo)}')
    for mp3, err in fails[:10]:
        print('  FAIL', os.path.basename(mp3), err)
    sys.exit(1 if fail else 0)

if __name__ == '__main__':
    main()
