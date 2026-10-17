# App B「聞いて話せる日本語」辞書タブ 統合手順（ドロップイン）

このフォルダは **JLPTアプリが供給する辞書のドロップイン部品**。App B セッションは下記を貼るだけで辞書タブが動く。
共有コード(`packages/shared`)への変更は **AppShell に汎用フック1つ＋タブ1個** のみ（DictScreen 本体とデータは App B ローカル＝sharedLock 最小）。

## 前提（同期済み）
JLPT 側で `node data-build/dict/sync-dict.mjs` 実行済なら、辞書データは既に2か所へ配布されている：
- 家族リファレンス: `聞いて話せるシリーズ/dict/`（このdoc・DictScreen.tsx も同梱）
- **App B バンドル位置**: `聞いて話せる日本語/expo-app/data/dict/`（`ja-vocab.json` / `ja-kanji.json` / `ja-synonyms.json` / **`ja-examples.json`** / **`ja-kanji-examples.json`** / `manifest.json`）
  → metro でそのまま import 可能。再同期は上記コマンド1発（冪等）。

### フル機能データ（2026-06-25 追加・まいにちJLPT同等にする）
- **`ja-examples.json`** … 語彙例文 `{ "語|読み": {ja, en} }`（7528件）。表示時に該当語を**下線**にすると学習効果UP。
  ```tsx
  const exMap = require('../../data/dict/ja-examples.json');
  const ex = exMap[`${v.word}|${v.reading}`];            // → {ja, en} or undefined
  // ja の中の v.word を下線表示(簡易): split で挟む or 既存 HighlightedText 流用
  ```
- **`ja-kanji-examples.json`** … 漢字の音訓 例語 `{ 漢字: {on:[{reading,word,wordReading}], kun:[…]} }`（1946字・複数読み・頻度順）。
  ```tsx
  const kex = require('../../data/dict/ja-kanji-examples.json')[k.char];
  const fmt = (l) => l.map(e => e.wordReading !== e.reading ? `${e.reading}：${e.word}（${e.wordReading}）` : `${e.reading}：${e.word}`).join('　');
  // <Text>音 {fmt(kex.on)}</Text>  <Text>訓 {fmt(kex.kun)}</Text>
  ```
  → 例: 注 = 訓「さす:注す　つぐ:注ぐ　そそぐ:注ぐ」。生 = 音「セイ:学生　ショウ:誕生」/訓「…」。

## 手順（App B セッション）

### 1) DictScreen を App B ローカルへ配置（sharedLock 不要）
`聞いて話せるシリーズ/dict/integration/DictScreen.tsx` を
→ `聞いて話せる日本語/expo-app/src/screens/DictScreen.tsx` にコピー。

### 2) 辞書タブの中身を組む（App B ローカル・データ注入）
`聞いて話せる日本語/expo-app/src/screens/DictTab.tsx` を新規作成：
```tsx
import DictScreen from './DictScreen';
import vocab from '../../data/dict/ja-vocab.json';
import kanji from '../../data/dict/ja-kanji.json';
import { useI18n } from '@safa/shared';            // 任意: 多言語ラベル
// import { useTokens } from '@safa/shared';        // 任意: テーマ統一

export default function DictTab() {
  const { t } = useI18n();
  return (
    <DictScreen
      vocab={vocab as any}
      kanji={kanji as any}
      // labels で多言語化（未指定は日本語デフォルトで動く）
      labels={{
        title: t('nav.dict'),
        searchPlaceholder: t('dict.search'),
        vocab: t('dict.vocab'),
        kanji: t('dict.kanji'),
        allLevels: t('dict.all'),
        count: (n) => t('dict.count', { n }),
        empty: t('dict.empty'),
      }}
      // colors={useTokens()...}   // テーマを揃えたい場合のみ
    />
  );
}
```
> 注: 意味(gloss)は JMdict 由来＝**英語**。多言語の意味は別途翻訳が必要（要コスト）。まずは英語意味＋日本語/読みで運用可。

### 3) AppShell に dict タブを足す（`packages/shared/src/AppShell.tsx`・sharedLock 取得）
`answerScreen` と同じ「画面を props 注入」パターンで、共有を汚さず App B 専用画面を差し込む。

(a) TabKey に `'dict'` を追加：
```ts
export type TabKey = 'home' | 'conversation' | 'grammar' | 'listening' | 'vocabulary' | 'vocation' | 'short' | 'long' | 'dict';
```
(b) `MainTabs` の引数に `dictScreen` を追加し、defs に dict エントリを足す（long の隣）：
```tsx
function MainTabs({ /* ...既存..., */ answerScreen, dictScreen }: { /* ...既存..., */ answerScreen?: any; dictScreen?: any }) {
  ...
  // defs(タブ定義マップ)に追記:
  dict: { name: 'DictTab', title: t('nav.dict'), icon: DictIcon, render: () => dictScreen ?? <ScaffoldScreen area="chobun" /> },
```
(c) `AppShellProps` と `AppShell()` に `dictScreen?: React.ReactNode` を追加し、`MainTabs` へ素通し（`answerScreen` の隣に同じ書き方で）。
(d) `DictIcon` を用意（既存アイコン群の隣に1つ。本📖 や検索🔍 の SVG/絵文字で可）。

### 4) App B 本体で配線（`聞いて話せる日本語/expo-app/App.tsx`）
```tsx
import DictTab from './src/screens/DictTab';
// ...
<AppShell
  /* ...既存 props... */
  tabs={['home', 'short', 'long', 'dict']}   // ← App B 個人版タブ（pending方針）
  dictScreen={<DictTab />}
/>
```

### 5) i18n キー（7言語）
各 `expo-app/src/i18n/*.json` に最低限：
```json
{ "nav": { "dict": "辞書" },
  "dict": { "search": "単語・読み・意味で検索", "vocab": "語彙", "kanji": "漢字", "all": "すべて", "count": "{n}件", "empty": "見つかりませんでした" } }
```
（未注入でも DictScreen は日本語デフォルトで動く＝段階導入可）

### 6) 確認
`npx tsc --noEmit`（App B）→ Web/実機で辞書タブ表示・検索・級フィルタを確認。

## サイズ注意
辞書データは合計 ~1.9MB（`ja-vocab.json` 1.5MB）。バンドル同梱で問題なければこのままでよい。
アプリサイズを抑えたい場合は App B 既存のパック方式（packLoader）に載せ替え可（その場合は data/dict を同梱から外し DL に回す）。

## 更新フロー
辞書を更新したら **JLPT 側で `node data-build/dict/sync-dict.mjs`** を実行 → `expo-app/data/dict/` が冪等に最新化される。
App B 側はパック方式でなければ再ビルド（同梱データ更新）で反映。`manifest.json.version` でズレ検知可。
