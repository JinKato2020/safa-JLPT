# プロジェクトスキル索引（索引型・初期ロードしない）

まいにちJLPT 専用スキル7個。**毎ターンの自動ロードを止め、必要な時にだけ該当 `SKILL.md` を Read** する運用（ユーザー希望 2026-07-21）。
`.claude\skills\` から `.claude\skills-archive\` へ移したので `Skill()` ツールでは呼べない。使う時は下記パスの SKILL.md を1本 Read すればそのまま手順になる。

## 作問
- **daimon-question-build** — 試験タブの大問（漢字読み/表記/文脈規定/言い換え類義/用法/文法形式/組み立て/文章の文法）を一意性担保で量産。生成→独立反証→修理→再反証→ゲート投入。
  `.claude\skills-archive\daimon-question-build\SKILL.md`
- **listening-question-build** — 聴解問題を公式の話速・モーラ数に寄せて量産（聴解.xlsx の列構成・台本作法・話速調整）。
  `.claude\skills-archive\listening-question-build\SKILL.md`
- **listening-skill** — 聴解の本番音声を作る統一手順（Gemini 2.5 Flash TTS・レベル別話速・音量 -20dBFS）。ビルダー = build_choukai3.py。
  `.claude\skills-archive\listening-skill\SKILL.md`
- **question-illustration** — 問題用イラストの画像生成AIプロンプト規約（英語を1次ソース→日本語併記・性別明示・赤ほっぺ禁止・シンプル）。
  `.claude\skills-archive\question-illustration\SKILL.md`

## ビルド・確認
- **jlpt-build** — 「ビルドして」＝ iOS TestFlight / Android へビルド提出（build-jlpt workflow・Build番号 = 2000+commits・content manifest 再生成・公開リリースは既定オフ）。content/**.json を編集してアプリへ反映する時にも。
  `.claude\skills-archive\jlpt-build\SKILL.md`
- **browser-url** — Expoアプリをトンネル起動し、実機ブラウザで開ける公開URLと exp:// URL を出す。
  `.claude\skills-archive\browser-url\SKILL.md`
- **web-mockups** — 画面を英語HTMLモック→スクショ→透過3D iPhone PNG 化（ストア/LP用のスマホ画像）。旧版は old/ へ退避。
  `.claude\skills-archive\web-mockups\SKILL.md`
