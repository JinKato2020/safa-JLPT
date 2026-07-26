# 語彙読み上げ音声 実装計画（Neural2-B・事前生成mp3・単語タブ▷）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 単語（語彙）リストの全3,526語を、各行のシンプルな「▷」で正しい読み・アクセントの音声再生できるようにする。

**Architecture:** 事前生成mp3（Google Neural2-B女声・漢字入力＋同表記異音語はかな上書き）を `app/assets/audio/vocab/<id>.mp3` に置き、既存ワークフローがGitHub Pagesへ自動配信。アプリはオンデマンドDL＋端末キャッシュで再生し、失敗時のみ expo-speech へフォールバック。

**Tech Stack:** Python生成（既存 build_choukai_audio.py の認証/Neural2/-20dBFS正規化を流用）、TypeScript/React Native（expo-av・expo-file-system/legacy・expo-speech・@expo/vector-icons Ionicons）、node:test。

## Global Constraints

- 声 = Google Cloud TTS **`ja-JP-Neural2-B`**（女声）固定。`audioEncoding: MP3`, `speakingRate: 1.0`。
- 送信テキスト = **既定は漢字表記（`word`）**。ただし「同表記で複数読みを持つ表記（vocab.json から動的算出＝表記→読み集合が2以上）」＋「`vocab_tts_kana_override.json` に列挙した id/表記」は **かな読み（`reading`）** を送信。
- 音量 = 全mp3 **-20dBFS RMS正規化・ピーク-1dBFS**（既存聴解と同基準）。
- 配信URL構造 = `https://jinkato2020.github.io/safa-JLPT/assets/audio/vocab/<id>.mp3`。**既存の聴解音声URL構造（`assets/audio/<id>.mp3`）を壊さない**（別サブディレクトリ `vocab/` に隔離）。
- mp3のファイル名 = vocab.json の `id`（例 `n5-v-1`）。1語1ファイル・3,526本。
- 失敗時は**無音にしない**＝ `expo-speech` で `reading` を `ja-JP` 合成。
- SDK54のため expo-file-system は **`expo-file-system/legacy`** から import。
- Git repo は `app/` のみ。`問題/` `docs/` は**リポジトリ外**（`問題/tools/` の生成スクリプト・override・xlsx は git commit しない＝既存 `build_kakitori_strokes.mjs` と同じ運用）。commit 対象は `app/` 配下のみ。
- 新規テストファイルは必ず `app/package.json` の `test` スクリプトに追記する（追記しないと実行されない）。
- コスト: 本番生成は Neural2 ≈ $16/1M文字換算で **約¥30〜50（1回）**。1000円ルール内・承認済み。

---

## ファイル構成

**app/（git管理・TDD）**
- Create `app/src/data/audioBase.ts` — 純モジュール。`AUDIO_BASE_URL` 定数＋ `vocabAudioUrl(id)`。ネイティブ依存なし＝node테スト可。
- Modify `app/src/data/listeningAudio.ts` — `AUDIO_BASE_URL` を自前定義から `audioBase.ts` の再エクスポートへ（重複排除・挙動不変）。
- Create `app/src/data/vocabAudio.ts` — ネイティブ再生層。`playVocab(id)→boolean`・`stopVocab()`。DL＋キャッシュ＋expo-av。
- Create `app/src/data/audioBase.test.ts` — `vocabAudioUrl` の node テスト。
- Modify `app/src/screens/BrowseScreen.tsx` — 語彙行に「▷」Pressable追加→ `playVocab`→失敗時 `Speech.speak(reading)`。
- Modify `app/package.json` — test スクリプトに `audioBase.test.ts` 追記。
- 生成物 `app/assets/audio/vocab/<id>.mp3`（3,526本・Task 4で生成しcommit）。

**問題/（リポジトリ外・生成ツール・commitしない）**
- Create `問題/tools/build_vocab_audio.py` — 生成スクリプト（Neural2-B・入力決定・正規化・カバレッジlog・xlsx更新・--dry-run/--check/--force/--ids/--limit）。
- Create `問題/tools/vocab_tts_kana_override.json` — 初期値 `[]`。
- 生成 `問題/語彙音声.xlsx` — 管理Excel（規約#9）。

---

### Task 1: 音声ソースURL純モジュール（audioBase）＋再生層（vocabAudio）

**Files:**
- Create: `app/src/data/audioBase.ts`
- Create: `app/src/data/audioBase.test.ts`
- Modify: `app/src/data/listeningAudio.ts:11`
- Create: `app/src/data/vocabAudio.ts`
- Modify: `app/package.json`（test スクリプト）

**Interfaces:**
- Produces: `vocabAudioUrl(id: string): string`（`audioBase.ts`）／`AUDIO_BASE_URL: string`（`audioBase.ts`）／`playVocab(id: string): Promise<boolean>`・`stopVocab(): Promise<void>`（`vocabAudio.ts`）。
- Consumes: なし。

- [ ] **Step 1: 失敗するテストを書く**

Create `app/src/data/audioBase.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AUDIO_BASE_URL, vocabAudioUrl } from './audioBase.ts';

test('AUDIO_BASE_URL は既存の聴解と同じ配信ルート', () => {
  assert.equal(AUDIO_BASE_URL, 'https://jinkato2020.github.io/safa-JLPT/assets/audio/');
});

test('vocabAudioUrl は vocab/ サブディレクトリの mp3 を指す', () => {
  assert.equal(vocabAudioUrl('n5-v-1'), 'https://jinkato2020.github.io/safa-JLPT/assets/audio/vocab/n5-v-1.mp3');
  assert.equal(vocabAudioUrl('n3-v-999'), 'https://jinkato2020.github.io/safa-JLPT/assets/audio/vocab/n3-v-999.mp3');
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd app && node --import tsx --test src/data/audioBase.test.ts`
Expected: FAIL（`Cannot find module './audioBase.ts'`）

- [ ] **Step 3: 純モジュールを実装**

Create `app/src/data/audioBase.ts`:

```ts
// 音声配信元(GitHub Pages)の共通定数＋URL解決。ネイティブ依存を持たない=node테スト可。
// repo/移行時はこの1行だけ差し替え。既存聴解=<base>/<id>.mp3、語彙=<base>vocab/<id>.mp3。
export const AUDIO_BASE_URL = 'https://jinkato2020.github.io/safa-JLPT/assets/audio/';

/** 語彙読み上げ音声のURL。id=vocab.jsonのid(例 n5-v-1)。 */
export function vocabAudioUrl(id: string): string {
  return `${AUDIO_BASE_URL}vocab/${id}.mp3`;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `cd app && node --import tsx --test src/data/audioBase.test.ts`
Expected: PASS（2 tests）

- [ ] **Step 5: listeningAudio.ts の重複を排除（挙動不変）**

`app/src/data/listeningAudio.ts:11` の行

```ts
export const AUDIO_BASE_URL = 'https://jinkato2020.github.io/safa-JLPT/assets/audio/';
```

を次に置換（同ファイル内の `${AUDIO_BASE_URL}` 使用箇所はそのまま動く）:

```ts
export { AUDIO_BASE_URL } from './audioBase';
```

- [ ] **Step 6: 再生層 vocabAudio.ts を実装**

Create `app/src/data/vocabAudio.ts`:

```ts
// 語彙読み上げ音声の再生。事前生成mp3をPages配信＋端末キャッシュ。
// 音源が無い/失敗時は false を返し、呼び出し側が expo-speech へフォールバックする(無音にしない)。
import * as FileSystemNS from 'expo-file-system/legacy';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import { vocabAudioUrl } from './audioBase';

const FS = FileSystemNS as unknown as {
  documentDirectory?: string | null;
  makeDirectoryAsync?: (uri: string, opts?: { intermediates?: boolean }) => Promise<void>;
  getInfoAsync?: (uri: string) => Promise<{ exists: boolean }>;
  downloadAsync?: (url: string, dest: string) => Promise<{ uri: string }>;
};
const cacheDir = Platform.OS !== 'web' && FS.documentDirectory ? `${FS.documentDirectory}vocab/` : null;
const CACHEABLE = !!cacheDir && typeof FS.downloadAsync === 'function' && typeof FS.getInfoAsync === 'function';

let dirReady = false;
async function ensureDir(): Promise<void> {
  if (!cacheDir || dirReady) return;
  try { await FS.makeDirectoryAsync?.(cacheDir, { intermediates: true }); } catch { /* 既存等は無視 */ }
  dirReady = true;
}

async function resolveSource(id: string): Promise<{ uri: string }> {
  const url = vocabAudioUrl(id);
  if (!CACHEABLE) return { uri: url };
  try {
    await ensureDir();
    const local = `${cacheDir}${id}.mp3`;
    const info = await FS.getInfoAsync!(local);
    if (info?.exists) return { uri: local };
    const dl = await FS.downloadAsync!(url, local);
    return { uri: dl.uri };
  } catch {
    return { uri: url };
  }
}

let current: Audio.Sound | null = null;

/** 再生中の音を停止・解放。 */
export async function stopVocab(): Promise<void> {
  const s = current;
  current = null;
  if (s) { try { await s.unloadAsync(); } catch { /* 解放失敗は無視 */ } }
}

/** id の語を再生。成功=true / 音源なし・デコード失敗=false(呼び出し側がTTSフォールバック)。 */
export async function playVocab(id: string): Promise<boolean> {
  const src = await resolveSource(id);
  await stopVocab();
  try {
    const { sound, status } = await Audio.Sound.createAsync(src, { shouldPlay: true });
    if (!status.isLoaded) { try { await sound.unloadAsync(); } catch { /* noop */ } return false; }
    current = sound;
    sound.setOnPlaybackStatusUpdate((st) => {
      if (st.isLoaded && st.didJustFinish) { sound.unloadAsync().catch(() => {}); if (current === sound) current = null; }
    });
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 7: package.json の test スクリプトに追記**

`app/package.json` の `test` スクリプト末尾（`src/kakitori/furigana.test.ts` の後ろ）に ` src/data/audioBase.test.ts` を追加。

- [ ] **Step 8: 型チェックと全テスト**

Run: `cd app && npx tsc --noEmit && npm test`
Expected: tsc エラーなし。テスト全緑（既存＋audioBase 2件）。

- [ ] **Step 9: Commit**

```bash
cd app && git add src/data/audioBase.ts src/data/audioBase.test.ts src/data/listeningAudio.ts src/data/vocabAudio.ts package.json
git commit -m "feat(vocab-audio): 音声URL純モジュール＋再生層(vocabAudio)を追加"
```

---

### Task 2: 単語リスト行に「▷」再生ボタン（BrowseScreen）

**Files:**
- Modify: `app/src/screens/BrowseScreen.tsx`（import追加・語彙行に▷・スタイル追加）

**Interfaces:**
- Consumes: `playVocab(id)`・`stopVocab()`（`vocabAudio.ts`）／`Speech.speak`（expo-speech）／`Ionicons`（@expo/vector-icons）。
- Produces: なし（UI）。

- [ ] **Step 1: import を追加**

`app/src/screens/BrowseScreen.tsx` の import 群に追加（ファイル冒頭の既存 import の並びに合わせる）:

```ts
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { playVocab } from '../data/vocabAudio';
```

（`Pressable` は既に import 済み。未 import なら `react-native` の import に追加する。）

- [ ] **Step 2: 再生ハンドラを renderItem 内・rowInner 定義前に追加**

`renderItem` 関数内の先頭（`const rowInner = (` の直前）に追加:

```ts
    const playWord = (id: string, reading: string) => {
      playVocab(id).then((ok) => {
        if (!ok && reading) Speech.speak(reading, { language: 'ja-JP' });
      });
    };
```

- [ ] **Step 3: 語彙行に ▷ ボタンを追加**

`renderItem` の返却部で、`item.type === 'vocab'` の時だけ行末に ▷ を出す。現在の

```tsx
    return <View style={s.row}>{rowInner}</View>;
```

を次に置換:

```tsx
    if (item.type === 'vocab') {
      return (
        <View style={s.row}>
          {rowInner}
          <Pressable
            style={s.playBtn}
            hitSlop={10}
            onPress={() => playWord(item.id, item.reading)}
            accessibilityLabel={`${item.word} を再生`}
          >
            <Ionicons name="play" size={20} color={c.mute} />
          </Pressable>
        </View>
      );
    }
    return <View style={s.row}>{rowInner}</View>;
```

- [ ] **Step 4: スタイルを追加**

`StyleSheet.create({ ... })` に追加（`row` スタイルの近く）:

```ts
  playBtn: { paddingLeft: 10, paddingVertical: 4, alignSelf: 'center' },
```

- [ ] **Step 5: 型チェック**

Run: `cd app && npx tsc --noEmit`
Expected: エラーなし。（`c.mute` が既存の色トークンに存在することを確認。BrowseScreen 内で `c` が使われている＝OK。無ければ `c.faint` を使う。）

- [ ] **Step 6: Commit**

```bash
cd app && git add src/screens/BrowseScreen.tsx
git commit -m "feat(vocab-audio): 単語リスト各行に▷再生ボタン(失敗時TTSフォールバック)"
```

---

### Task 3: 生成スクリプト build_vocab_audio.py（Neural2-B・入力決定・--dry-run/--check）

**Files:**
- Create: `問題/tools/build_vocab_audio.py`（リポジトリ外・commitしない）
- Create: `問題/tools/vocab_tts_kana_override.json`（初期 `[]`・commitしない）

**Interfaces:**
- Consumes: `app/src/data/vocab.json`（id/word/reading/level）／`多言語教材/00_共通/tools/gtts_google._load_key`。
- Produces: `app/assets/audio/vocab/<id>.mp3`（Task 4で実行）／`問題/語彙音声.xlsx`。

- [ ] **Step 1: override 初期ファイルを作成**

Create `問題/tools/vocab_tts_kana_override.json`:

```json
[]
```

- [ ] **Step 2: スクリプト本体を作成**

Create `問題/tools/build_vocab_audio.py`:

```python
# -*- coding: utf-8 -*-
"""語彙読み上げ音声ビルダー(Neural2-B・事前生成mp3)。
入力決定: 既定=漢字表記(word)を送信。同表記で複数読みを持つ表記＋override列挙 は かな(reading)。
音量: -20dBFS RMS正規化・ピーク-1dBFS。出力: app/assets/audio/vocab/<id>.mp3。
使い方:
  python build_vocab_audio.py --dry-run   # 送信テキスト一覧(id/word/reading/text/kind)をCSV出力・生成しない
  python build_vocab_audio.py --check      # 同表記異音語が全てkanaかを検査(不一致で異常終了)・生成しない
  python build_vocab_audio.py              # 未生成のみ生成
  python build_vocab_audio.py --force      # 既存も作り直し
  python build_vocab_audio.py --ids n5-v-1,n5-v-2
  python build_vocab_audio.py --limit 20   # 先頭20件だけ(試験生成)
"""
import os, sys, json, base64, wave, subprocess, urllib.request, urllib.error, time, array, math, argparse, csv

sys.path.insert(0, r'C:\Users\jwpsa\Documents\desktop\claude\多言語教材\00_共通\tools')
from gtts_google import _load_key

CKEY = _load_key(); SR = 24000
VOICE = 'ja-JP-Neural2-B'
TARGET_RMS = -20.0; PEAK_DB = -1.0
ROOT = r'C:\Users\jwpsa\Documents\desktop\claude\JLPTアプリ'
VOCAB = os.path.join(ROOT, 'app', 'src', 'data', 'vocab.json')
OUTDIR = os.path.join(ROOT, 'app', 'assets', 'audio', 'vocab')
OVERRIDE = os.path.join(ROOT, '問題', 'tools', 'vocab_tts_kana_override.json')
XLSX = os.path.join(ROOT, '問題', '語彙音声.xlsx')
TMP = os.environ.get('TEMP', os.getcwd())

def load_vocab():
    with open(VOCAB, encoding='utf-8') as f: return json.load(f)

def load_override():
    with open(OVERRIDE, encoding='utf-8') as f: return set(json.load(f))

def homograph_words(vocab):
    """同表記で複数の読みを持つ表記の集合(漢字入力だと誤読するのでkana送信)。"""
    m = {}
    for v in vocab: m.setdefault(v['word'], set()).add(v['reading'])
    return {w for w, rs in m.items() if len(rs) > 1}

def tts_text(v, homographs, override):
    """(送信テキスト, 種別) を返す。kana=読みを送信 / kanji=表記を送信。"""
    if v['word'] in homographs or v['id'] in override or v['word'] in override:
        return v['reading'], 'kana'
    return v['word'], 'kanji'

def synth_pcm(text):
    body = json.dumps({'input': {'text': text},
        'voice': {'languageCode': 'ja-JP', 'name': VOICE},
        'audioConfig': {'audioEncoding': 'MP3', 'speakingRate': 1.0}}).encode()
    for a in range(6):
        try:
            d = json.load(urllib.request.urlopen(urllib.request.Request(
                f'https://texttospeech.googleapis.com/v1/text:synthesize?key={CKEY}',
                data=body, headers={'Content-Type': 'application/json'}), timeout=120)); break
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 503): time.sleep(8 * (a + 1)); continue
            raise
    else:
        raise RuntimeError('TTS失敗: ' + text)
    m = os.path.join(TMP, '_bv.mp3'); open(m, 'wb').write(base64.b64decode(d['audioContent']))
    w = os.path.join(TMP, '_bv.wav')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', m, '-ar', str(SR), '-ac', '1', w], check=True)
    with wave.open(w, 'rb') as f: pcm = f.readframes(f.getnframes())
    os.remove(m); os.remove(w); return pcm

def normalize(pcm):
    """-20dBFS RMS正規化＋ピーク-1dBFSクリップ回避。16bit mono。"""
    a = array.array('h'); a.frombytes(pcm)
    if not len(a): return pcm
    rms = math.sqrt(sum(x * x for x in a) / len(a)) or 1.0
    gain = (10 ** (TARGET_RMS / 20) * 32768) / rms
    peak = max(abs(x) for x in a) or 1
    max_gain = (10 ** (PEAK_DB / 20) * 32768) / peak
    gain = min(gain, max_gain)
    out = array.array('h', (max(-32768, min(32767, int(x * gain))) for x in a))
    return out.tobytes()

def write_mp3(pcm, dest):
    w = os.path.join(TMP, '_bvn.wav')
    with wave.open(w, 'wb') as f:
        f.setnchannels(1); f.setsampwidth(2); f.setframerate(SR); f.writeframes(pcm)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', w, '-c:a', 'libmp3lame', '-q:a', '4', dest], check=True)
    os.remove(w)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--ids', default='')
    ap.add_argument('--limit', type=int, default=0)
    args = ap.parse_args()

    vocab = load_vocab(); override = load_override(); homographs = homograph_words(vocab)
    plan = [(v, *tts_text(v, homographs, override)) for v in vocab]

    if args.check:
        bad = [v['id'] for v, _, k in plan if v['word'] in homographs and k != 'kana']
        if bad: print('NG: 同表記異音語がkanaでない:', bad); sys.exit(1)
        print(f'OK: 同表記異音語 {len(homographs)}表記 は全て kana 送信'); return

    if args.dry_run:
        out = os.path.join(TMP, 'vocab_tts_plan.csv')
        with open(out, 'w', encoding='utf-8-sig', newline='') as f:
            wr = csv.writer(f); wr.writerow(['id', 'level', 'word', 'reading', 'text', 'kind'])
            for v, text, kind in plan: wr.writerow([v['id'], v['level'], v['word'], v['reading'], text, kind])
        nk = sum(1 for _, _, k in plan if k == 'kana')
        print(f'dry-run: {len(plan)}語  kana送信={nk}  漢字送信={len(plan)-nk}  -> {out}')
        return

    os.makedirs(OUTDIR, exist_ok=True)
    want = set(args.ids.split(',')) if args.ids else None
    items = [p for p in plan if (want is None or p[0]['id'] in want)]
    if args.limit: items = items[:args.limit]
    made = skipped = 0; failed = []
    for v, text, kind in items:
        dest = os.path.join(OUTDIR, v['id'] + '.mp3')
        if os.path.exists(dest) and not args.force: skipped += 1; continue
        try:
            write_mp3(normalize(synth_pcm(text)), dest); made += 1
            if made % 100 == 0: print(f'  ...{made}本生成')
        except Exception as e:
            failed.append(v['id']); print(f'  FAIL {v["id"]} ({text}): {e}')
    total = len([p for p in plan])
    have = sum(1 for v in vocab if os.path.exists(os.path.join(OUTDIR, v['id'] + '.mp3')))
    print(f'生成={made} スキップ={skipped} 失敗={len(failed)}  カバレッジ={have}/{total}')
    if failed: print('失敗id:', failed)
    build_xlsx(plan)

def build_xlsx(plan):
    try:
        import openpyxl
    except ImportError:
        print('openpyxl未導入=xlsx更新スキップ'); return
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = '語彙音声'
    ws.append(['id', 'level', '表記', '読み', '送信テキスト', '入力種別', '声', '備考'])
    for v, text, kind in plan:
        ws.append([v['id'], v['level'], v['word'], v['reading'], text, kind, VOICE, ''])
    wb.save(XLSX); print('xlsx更新:', XLSX)

if __name__ == '__main__':
    main()
```

- [ ] **Step 3: --check で入力決定を検査**

Run: `cd "問題/tools" && python build_vocab_audio.py --check`
Expected: `OK: 同表記異音語 68表記 は全て kana 送信`（68はvocab.json実測値。数が違っても「全てkana」ならOK＝異常終了しなければ合格）

- [ ] **Step 4: --dry-run で送信テキスト一覧を確認**

Run: `cd "問題/tools" && python build_vocab_audio.py --dry-run`
Expected: `dry-run: 3526語  kana送信=... 漢字送信=... -> <TEMP>/vocab_tts_plan.csv`。CSVを開き、上=うえ/今日=きょう/明日=あした 等の同表記異音語が kind=kana になっていること、五日=いつか・果物=くだもの 等の熟字訓が正しい読みで送られること（漢字送信でGoogleが誤読しそうな熟字訓があれば override へ追記対象）を人手スポットチェック。

- [ ] **Step 5: --limit 3 で試験生成（少量・実費ほぼ0）**

Run: `cd "問題/tools" && python build_vocab_audio.py --limit 3`
Expected: `生成=3 ... カバレッジ=3/3526`。`app/assets/audio/vocab/n5-v-1.mp3` 等3本が生成され、ffprobe で 0.5〜2秒・再生可能なことを確認。確認後この3本は削除してよい（Task 4で全生成）。

※このタスクの成果物（.py / override.json）は**リポジトリ外のため git commit しない**。試験生成した mp3 はTask 4前に消してよい。

---

### Task 4: 全3,526語を本番生成しコミット（課金 約¥30〜50）

**Files:**
- Create: `app/assets/audio/vocab/*.mp3`（3,526本）

**Interfaces:**
- Consumes: Task 3 の `build_vocab_audio.py`。
- Produces: `app/assets/audio/vocab/<id>.mp3` 全語。

- [ ] **Step 1: 全生成を実行**

Run: `cd "問題/tools" && python build_vocab_audio.py`
Expected: 進捗 `...100本生成` を重ね、末尾 `生成=3526 スキップ=0 失敗=0  カバレッジ=3526/3526`。失敗idが出たら `--ids <失敗id>` で再試行し 0 にする。

- [ ] **Step 2: カバレッジと再生を検証**

Run: `cd app && ls assets/audio/vocab/*.mp3 | wc -l`
Expected: `3526`。数本を ffprobe で長さ確認（0.4〜3秒・空でない）。

- [ ] **Step 3: 既存聴解mp3が無傷か確認（URL構造保護）**

Run: `cd app && ls assets/audio/*.mp3 | wc -l`
Expected: `120`（既存聴解は不変。vocab/ は別サブディレクトリ）。

- [ ] **Step 4: Commit（大きめのバイナリ追加）**

```bash
cd app && git add assets/audio/vocab
git commit -m "assets(vocab-audio): 語彙3526語の読み上げmp3(Neural2-B)を生成・追加"
```

- [ ] **Step 5: 型チェックと全テスト（最終確認）**

Run: `cd app && npx tsc --noEmit && npm test`
Expected: tsc エラーなし・テスト全緑。

---

## Self-Review

**1. Spec coverage:**
- 声Neural2-B/漢字入力/かな上書き → Task 3（Global Constraints＋tts_text）✅
- 68同表記異音の上書き → Task 3 Step3 --check ✅
- id単位mp3・vocab/配下・URL構造保護 → Task 3/4＋Global Constraints ✅
- 配信（Pages自動・ワークフロー改修不要） → 既存 `cp -r assets/audio` で vocab/ も配信（本計画で確認済・改修タスク不要）✅
- オンデマンドDL＋キャッシュ → Task 1 vocabAudio.ts ✅
- 単語タブ各行の▷・失敗時TTSフォールバック → Task 2 ✅
- 自動再生しない → Task 2（手動onPressのみ）✅
- -20dBFS正規化 → Task 3 normalize ✅
- テスト（vocabAudioUrl・生成カバレッジ・上書き検査） → Task1 Step1／Task4 Step2／Task3 Step3 ✅
- Excel最新化（規約#9） → Task 3 build_xlsx ✅
- コスト¥30〜50 → Task 4 ✅

**2. Placeholder scan:** TBD/TODO/「適切に」等なし。全コード完全記載。✅

**3. Type consistency:** `vocabAudioUrl(id)`・`playVocab(id):Promise<boolean>`・`stopVocab()` はTask1で定義しTask2で同シグネチャ使用。`AUDIO_BASE_URL` はaudioBase.tsが正・listeningAudioは再エクスポート。Python `tts_text→(text,kind)`・`homograph_words`・`normalize`・`synth_pcm` は同一ファイル内で一貫。✅

**留意（実装者向け）:** BrowseScreenで色トークン `c.mute` が無ければ `c.faint` を使う（Step5で確認）。playVocab のDL失敗時に404本文をキャッシュし得るが、全生成後は404が起きないため実害なし（欠け時のみTTSフォールバックで無音回避）。
