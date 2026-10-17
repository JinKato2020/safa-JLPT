# 漢字書き取り v2 第1弾（正確性）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 実機フィードバックの正確性4件を修正する — ①手本を日本字形(animCJK)に／⑥音声を鳴らす／見ないで書くで対象漢字を隠す／⑩カバー率漢字を79字基準に。

**Architecture:** 手本データを animCJK 日本語(HanziWriter形式)から**ビルド時に612字抽出→同梱**し、`charData.ts` をネットDLから**同梱ルックアップ**へ簡素化（完全オフライン・正確）。TTSは既存の音声セッション設定を書き取り画面にも適用。UI/セレクタは最小修正。

**Tech Stack:** React Native/Expo SDK54, TypeScript, HanziWriter(WebView), expo-av(音声モード), expo-speech(TTS)。テスト=`node --import tsx --test`（node:test）。データ生成=node(.mjs)。

## Global Constraints

- 設計: `docs/superpowers/specs/2026-07-08-kakitori-v2-corrections-design.md`。
- テストは jest 不使用。`node:test`＋`node:assert/strict`。新規/改名テストは `app/package.json` の `test` に明示追記。
- 手本データ源＝**animCJK 日本語**（`raw.githubusercontent.com/parsimonhi/animCJK/master/graphicsJa.txt`・1行1字の `{character,strokes,medians}`）。CC BY-SA/Arphic 帰属を謝辞に追加。
- 対象漢字＝`app/src/data/kanji.json` の `type==='kanji'`（N5 79/N4 166/N3 367＝計612）。
- 状態/後方互換・null安全を維持（[[verify-runtime-not-just-build]]）。UI言語 en/ja のみ。
- 各タスク末で該当テスト＋`npm run tsc`（`cd app`）緑・コミット。

---

### Task 1: animCJK 日本字形データを抽出して同梱

**Files:**
- Create: `問題/tools/build_kakitori_strokes.mjs`
- Create（生成物）: `app/src/data/kakitoriStrokes.json`

**Interfaces:**
- Produces: `kakitoriStrokes.json` = `Record<string, { strokes: string[]; medians: number[][][] }>`（対象612字）。

- [ ] **Step 1: 抽出スクリプトを書く**

`問題/tools/build_kakitori_strokes.mjs`:
```js
// animCJK(日本語)から JLPT対象漢字(612字)の筆画データ(HanziWriter形式)を抽出し
// app/src/data/kakitoriStrokes.json に同梱する。CDN(jsdelivr)は403のため raw.githubusercontent を使う。
// graphicsJa.txt は「1行=1文字のJSON」形式: {"character":"海","strokes":[...svg paths...],"medians":[[[x,y],...],...]}
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';

const here = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(here, '../../app');
const kanji = JSON.parse(fs.readFileSync(path.join(APP, 'src/data/kanji.json'), 'utf8'));
const targets = new Set(kanji.filter((k) => k.type === 'kanji').map((k) => k.char));
console.log('target kanji:', targets.size);

const URL = 'https://raw.githubusercontent.com/parsimonhi/animCJK/master/graphicsJa.txt';
function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'kakitori-build' } }, (res) => {
      if (res.statusCode !== 200) { reject(new Error('HTTP ' + res.statusCode)); return; }
      let d = ''; res.setEncoding('utf8');
      res.on('data', (c) => (d += c)); res.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

const raw = await get(URL);
const out = {};
for (const line of raw.split('\n')) {
  const t = line.trim(); if (!t) continue;
  let o; try { o = JSON.parse(t); } catch { continue; }
  const ch = o.character ?? o.char;
  if (ch && targets.has(ch) && o.strokes && o.medians) out[ch] = { strokes: o.strokes, medians: o.medians };
}
const missing = [...targets].filter((c) => !out[c]);
console.log('extracted:', Object.keys(out).length, '/', targets.size, 'missing:', missing.length, missing.slice(0, 50).join(''));
fs.writeFileSync(path.join(APP, 'src/data/kakitoriStrokes.json'), JSON.stringify(out));
console.log('wrote app/src/data/kakitoriStrokes.json', (fs.statSync(path.join(APP, 'src/data/kakitoriStrokes.json')).size / 1e6).toFixed(2), 'MB');
```

- [ ] **Step 2: 実行して抽出（スパイク＝形式とカバレッジを実測）**

Run（`cd 問題/tools`）: `node build_kakitori_strokes.mjs`
Expected: `target kanji: 612`、`extracted: N / 612`。**理想は 612/612**。`missing` が出たら文字を記録（後述フォールバック要否の判断材料）。`kakitoriStrokes.json` が生成（数MB）。
- もし graphicsJa.txt の1行の形式が想定と違う（`character/strokes/medians` キーが無い）場合は、実データの1行をログ出力してキー名を確認し、スクリプトのキー参照を修正する（例: `o.character`）。**形式が判明した時点で報告**。
- もし missing が多数（例 >20）なら **BLOCKED** で報告（フォールバック設計を追加するか、別データ源を検討）。missing が少数（例 ≤20・異体字等）なら、その字だけ現行 hanzi-writer-data CDN にフォールバックする方針を Task 2 に反映（本タスクでは missing 一覧を報告）。

- [ ] **Step 3: 妥当性確認**

Run: `node -e "const m=require('../../app/src/data/kakitoriStrokes.json'); const s=m['海']; console.log('海 strokes', Array.isArray(s.strokes), s.strokes.length, 'medians', Array.isArray(s.medians), s.medians.length)"`
Expected: `海 strokes true 10 medians true 10`（画数は目安・strokes と medians の要素数が一致し正の数）。

- [ ] **Step 4: Commit**
```bash
git add app/src/data/kakitoriStrokes.json ../../問題/tools/build_kakitori_strokes.mjs 2>/dev/null || git -C "$(git rev-parse --show-toplevel)" add app/src/data/kakitoriStrokes.json
git commit -m "feat(kakitori): bundle animCJK Japanese stroke data for 612 JLPT kanji"
```
※ `問題/tools/` は app リポジトリ外（app/ が git root）。スクリプトは app 外なのでコミット対象は `app/src/data/kakitoriStrokes.json` のみ（スクリプトはローカルツールとして保持）。報告に抽出結果（extracted/missing）を明記。

---

### Task 2: charData.ts を同梱ルックアップへ簡素化（＋テスト差し替え）

**Files:**
- Modify: `app/src/kakitori/charData.ts`（全面簡素化）
- Replace: `app/src/kakitori/charData_url.test.ts` → `app/src/kakitori/charData.test.ts`

**Interfaces:**
- Consumes: `../data/kakitoriStrokes.json`（Task 1）
- Produces: `fetchCharData(char: string): Promise<string>`（同梱データの `JSON.stringify` を返す・欠け字は reject）, `hasCharData(char: string): boolean`

- [ ] **Step 1: 失敗するテストを書く**

`app/src/kakitori/charData.test.ts`:
```ts
// 同梱字形データのルックアップ。実行: node --import tsx --test src/kakitori/charData.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchCharData, hasCharData } from './charData.ts';

test('存在する漢字はstrokes/mediansを返す', async () => {
  const s = await fetchCharData('海');
  const o = JSON.parse(s);
  assert.ok(Array.isArray(o.strokes) && o.strokes.length > 0);
  assert.ok(Array.isArray(o.medians) && o.medians.length === o.strokes.length);
});
test('hasCharData は収録有無を返す', () => {
  assert.equal(hasCharData('海'), true);
  assert.equal(hasCharData('\u{20000}'), false); // 収録外
});
test('収録外はreject', async () => {
  await assert.rejects(() => fetchCharData('\u{20000}'));
});
```
※ `海` が Task 1 の抽出に含まれる前提（含まれない場合は収録済みの別漢字に差し替え）。

- [ ] **Step 2: 失敗を確認**

Run: `node --import tsx --test src/kakitori/charData.test.ts`
Expected: FAIL（`hasCharData` 未定義 / 旧charDataはexpo-file-system importでnode実行不可）。

- [ ] **Step 3: 実装（全面置換）**

`app/src/kakitori/charData.ts`:
```ts
// 漢字の筆画データ(animCJK日本語・HanziWriter形式)を同梱JSONから同期ルックアップする。
// WebViewはネットに触れず、ここで得たJSONを KW.load(char, json) で注入する。完全オフライン。
import strokes from '../data/kakitoriStrokes.json';

type Entry = { strokes: string[]; medians: number[][][] };
const DATA = strokes as Record<string, Entry>;

export function hasCharData(char: string): boolean {
  return Object.prototype.hasOwnProperty.call(DATA, char);
}

/** 同梱の字形JSON(生文字列)を返す。互換のためPromise。収録外はreject(呼び出し側はエラーUI)。 */
export async function fetchCharData(char: string): Promise<string> {
  const e = DATA[char];
  if (!e) throw new Error('no stroke data: ' + char);
  return JSON.stringify(e);
}
```
※ `expo-file-system` import を撤去（他機能の利用には影響しない別ファイル）。tsconfig が `resolveJsonModule` 済みであること（既存の `import kanji from '../data/kanji.json'` が動くので前提OK）。

- [ ] **Step 4: 成功を確認**

Run: `node --import tsx --test src/kakitori/charData.test.ts`
Expected: PASS（3 tests）。

- [ ] **Step 5: 型検証＋Commit**

Run: `npm run tsc` → エラーなし（KakitoriScreen は `fetchCharData` を await 使用のまま動く）。
```bash
git add app/src/kakitori/charData.ts app/src/kakitori/charData.test.ts
git rm app/src/kakitori/charData_url.test.ts
git commit -m "refactor(kakitori): charData = bundled offline lookup (drop CDN fetch)"
```

---

### Task 3: KakitoriScreen — TTS修正＋見ないで書くで対象漢字を隠す

**Files:**
- Modify: `app/src/screens/KakitoriScreen.tsx`

**Interfaces:**
- Consumes: `expo-av`（`Audio.setAudioModeAsync`）, `kanjiInfo`（既存）

- [ ] **Step 1: 音声セッション設定を追加（iOSサイレント対策）**

`app/src/screens/KakitoriScreen.tsx`:
- import 追加: `import { Audio } from 'expo-av';`
- マウント時に一度呼ぶ useEffect を追加（既存の import/フック群の近くに）:
```ts
  useEffect(() => { Audio.setAudioModeAsync({ playsInSilentModeIOS: true }).catch(() => {}); }, []);
```
（`useEffect` が未importなら 'react' から追加）。

- [ ] **Step 2: 読み上げを常時発話＋読み欠けフォールバック**

- `speak` 関数を修正（現状 `if (!sound) return;` で手動🔊もゲートされている）。手動時は常に発話、自動時のみ `sound` を尊重するよう、引数で切り分ける:
```ts
  const speakReading = (ch: string): string => {
    const r = readingLine(ch);
    if (r) return r.split('・')[0];
    const info = kanjiInfo(ch);            // 読み欠けは kanji.json の音/訓 先頭へフォールバック
    const on = (info?.on ?? '').split('、')[0].split('・')[0];
    const kun = (info?.kun ?? '').split('、')[0].split('.')[0];
    return on || kun || '';
  };
  const speak = (ch: string, opts?: { manual?: boolean }) => {
    if (!opts?.manual && !sound) return;   // 自動読み上げのみ設定に従う。手動🔊は常時
    const r = speakReading(ch);
    if (r) Speech.speak(r, { language: 'ja-JP' });
  };
```
- 呼び出し側: 完了時の自動読み上げは `speak(char)`（現状のまま・step>=2時）。🔊 ボタンは `onPress={() => speak(char, { manual: true })}`。

- [ ] **Step 3: 見ないで書く(step2)で対象漢字グリフを隠す**

- 情報行の `infoChar`（`<Text style={s.infoChar}>{char}</Text>`）を、`step===2 && !free` の時は伏せ字にする:
```tsx
        <Text style={s.infoChar}>{step === 2 && !free ? '？' : char}</Text>
```
（意味・読み・例語・🔊 はそのまま＝読み/意味から記憶で書く手がかり）。

- [ ] **Step 4: 型検証＋実行確認**

Run: `npm run tsc` → エラーなし。
Run（web bundle スモーク・任意）: `npx expo export --platform web`（成功。webはWebViewフォールバックのためクラッシュしない）。重い/不要なら tsc 緑で可。

- [ ] **Step 5: Commit**
```bash
git add app/src/screens/KakitoriScreen.tsx
git commit -m "fix(kakitori): TTS plays in silent mode + reading fallback; hide target glyph on recall step"
```

---

### Task 4: カバー率「漢字」を79字（漢字1字）基準に

**Files:**
- Modify: `app/src/store/selectors.ts:257-258`

**Interfaces:**
- Consumes: 級内漢字データ（`kanji.json` type==='kanji' の {id, level}）。selectors 既存の VOCAB/GRAMMAR と同様に KANJI をimport。

- [ ] **Step 1: KANJI 母集団に変更**

`app/src/store/selectors.ts`:
- ファイル冒頭の data import 群を確認し、漢字データセットを取り込む。VOCAB/GRAMMAR がどこから来ているか（例 `../data` or `../data/index`）を確認し、同じ場所から漢字配列（`kanji.json` 相当・各要素 `{id, level, type, char}`）を import（既存の export 名があればそれを使う。無ければ `import kanjiData from '../data/kanji.json'` を追加し `type==='kanji'` で絞る）。
- 258行目の 'kanji' 行を差し替え:
```ts
    { key: 'kanji' as const, ...cov(KANJI_CHARS.filter((k) => k.type === 'kanji').map((k) => ({ id: k.id, level: k.level }))) }, // 漢字1字(79/166/367)
```
（`KANJI_CHARS` は上で用意した漢字配列。既存 export があればその名前に合わせる。）
- 244行のコメント「漢字は"漢字を含む語"で計測」を「漢字は漢字1字で計測(79/166/367)」へ更新。

- [ ] **Step 2: 母数を実測確認**

Run（`cd app`）:
```bash
node --import tsx -e "import('./src/store/selectors.ts').then(m=>{const s={settings:{level:'N5',targetExam:'jlpt'},items:{}};const b=m.coverageBars(s,Date.now());console.log(b.find(x=>x.key==='kanji'))})"
```
Expected: `{ key: 'kanji', learned: 0, total: 79 }`（N5＝79・空stateなのでlearned 0）。
※ selectors が RN 依存を推移importして node で動かない場合は、その旨を報告し、代わりに `KANJI_CHARS.filter(type==='kanji' && level==='N5').length===79` を単体で確認（純データ照合）。

- [ ] **Step 3: 型検証＋Commit**

Run: `npm run tsc` → エラーなし。
```bash
git add app/src/store/selectors.ts
git commit -m "fix(kakitori): kanji coverage counts kanji characters (79) not kanji-containing words (563)"
```

---

### Task 5: 謝辞追記・テスト登録・全体グリーン・実行時検証

**Files:**
- Modify: `app/package.json`（test スクリプト）, `app/src/i18n/en.json` / `ja.json`（謝辞）

- [ ] **Step 1: test スクリプトを更新（charData テスト改名を反映）**

`app/package.json` の `test` から `src/kakitori/charData_url.test.ts` を削除し `src/kakitori/charData.test.ts` を追加（他は不変）。まず `ls src/kakitori/*.test.ts` で存在確認し、存在するファイルだけ登録する。

- [ ] **Step 2: 謝辞に animCJK を追記**

`app/src/i18n/en.json` / `ja.json` の `profile.dataSourceBody` に1行追記（Task 1採用データ源）:
- en: `\n・Kanji stroke/writing data: animCJK (parsimonhi) — Arphic Public License / derived stroke data`
- ja: `\n・漢字の筆順・書き取りデータ：animCJK（parsimonhi）／Arphic Public License`
既存の HanziWriter(MIT) 行は残す。JSON 妥当性維持。

- [ ] **Step 3: 全テスト＋型検証**

Run（`cd app`）: `npm test` → 全PASS（既存＋charData差し替え）。件数を報告。
Run: `npm run tsc` → クリーン。

- [ ] **Step 4: 実行時安全スポットチェック（コード確認）**

- `fetchCharData` 収録外→reject→KakitoriScreen の error UI（loadCharのcatch）で `kakitori.load_error`＋再試行が出ること（コード確認）。
- 旧state（`kakitori` 無し）・`state.kakitori?.[char]?.stars ?? 0` のガード維持。

- [ ] **Step 5: Commit**
```bash
git add app/package.json app/src/i18n/en.json app/src/i18n/ja.json
git commit -m "chore(kakitori): register charData test, add animCJK attribution, verify green"
```

---

## Self-Review 結果（spec対応）

- ① 手本=animCJK日本字形 → Task 1（抽出・同梱）＋Task 2（charData同梱ルックアップ）＋Task 5（謝辞）。
- ⑥ 音声 → Task 3 Step1（音声モード）＋Step2（常時発話＋読み欠けフォールバック）。
- 見ないで書くで字を隠す → Task 3 Step3。
- ⑩ カバー率79 → Task 4。
- 後方互換/実行時 → Task 2（収録外reject→既存error UI）・Task 5 Step4。

未解決の実装時判断（明示済）: ①graphicsJa.txt の正確なキー名・612カバレッジ（Task 1 スパイクで実測・欠け多数ならBLOCKED報告）／selectors の漢字データ export 名（Task 4 Step1で現物確認）／selectors の node 実行可否（Task 4 Step2に代替確認）。
