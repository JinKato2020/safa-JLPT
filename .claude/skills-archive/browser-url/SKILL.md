---
name: browser-url
description: safa JLPT Expoアプリをトンネルで起動し、実機ブラウザで開ける公開URLと exp:// URL を出す。「ブラウザURL」「実機で見たい」「外出先で見たい」「スマホで確認」等で使う。
---

# ブラウザURL（実機/ブラウザ確認用トンネル）

safa JLPT の Expo アプリを**トンネル**で起動し、スマホで開けるURLを発行する。アプリ本体は `app/`（このプロジェクト直下のExpoプロジェクト）。

## 重要な前提・ハマりどころ（必ず踏まえる）
- **`exp://` はブラウザでは開かない**（Expo Goアプリ専用スキーム）。**ブラウザ用は `https://….exp.direct`**。両方を必ず併記して渡す。
- 非対話起動（このCLI）だと**QR/URLがターミナルに描画されない**。URLは **ngrok API `http://127.0.0.1:4040/api/tunnels`** か Expoのログから取得する。
- **ポート8081は埋まっていることが多く**、非対話だと「別ポート使う？」プロンプトに答えられず落ちる。**`--port` を明示**（8083等）。
- ngrokトンネルは**初回接続でタイムアウト（"ngrok tunnel took too long to connect."）しがち**。その時は**もう一度起動**すれば繋がることが多い。
- 必ず **`app/` ディレクトリ**で実行（cwd=`app`）。
- トンネルは**このPCを中継**する。PCが起動・オンラインである必要（スリープ/シャットダウンで切れる）。
- トンネルURL（サブドメイン）は起動ごとに変わり得る。**ハードコードせず毎回取得**する。

## 手順

1. **既存トンネルの再利用を先に確認**（二重起動しない）:
   ```powershell
   Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -TimeoutSec 5
   ```
   `tunnels` に `public_url`（`https://….exp.direct`）があれば、それを使って手順5へ（起動不要）。無ければ次へ。

2. **ngrok未導入なら入れる**（初回のみ）。`app/` で:
   ```powershell
   npm install --save-dev "@expo/ngrok@^4.1.0"
   ```

3. **トンネル起動（バックグラウンド）**。`run_in_background: true` で、ログをtempにTeeする:
   ```powershell
   $log = Join-Path $env:TEMP "jlpt-tunnel.log"; if (Test-Path $log) { Remove-Item $log -Force }
   Push-Location "<このプロジェクト>\app"; npx expo start --tunnel --port 8083 2>&1 | Tee-Object -FilePath $log; Pop-Location
   ```
   - その後、別のバックグラウンド監視でログに **`Tunnel ready`**（成功）か **`CommandError` / `too long`**（失敗）が出るまで待つ。
   - 失敗したら**もう一度手順3**（ポートを8084等に変えてもよい）。

4. **公開URLを取得**:
   ```powershell
   (Invoke-RestMethod "http://127.0.0.1:4040/api/tunnels").tunnels | %% { $_.public_url }
   ```
   `https://` の `public_url`（例 `https://xxxx-8083.exp.direct`）を採用。

5. **到達確認**（死んだURLを渡さない）。ブラウザ相当のヘッダでWeb版HTMLが返るか:
   ```powershell
   Invoke-WebRequest -Uri "<https URL>" -Headers @{ Accept='text/html'; 'User-Agent'='Mozilla/5.0 (iPhone)' } -UseBasicParsing -TimeoutSec 40
   ```
   `HTTP 200` で `<!DOCTYPE html>` / `<title>safa JLPT</title>` が返ればOK。

6. **ユーザーに提示**（両方）:
   - 🌐 **ブラウザ用**: `https://….exp.direct` ← スマホのSafari/Chromeのアドレス欄に貼る（初回10〜60秒）
   - 📱 **Expo Go用**: `exp://….exp.direct`（同じホスト・https→exp に置換。Expo Goの「Enter URL manually」）
   - ⚠️ このPCは起動・オンラインのまま。

## 停止・後始末
- トンネルを止める: 該当バックグラウンドタスクを **TaskStop**。
- 一時ログ `jlpt-tunnel*.log` は用が済んだら削除（リポジトリは汚さない）。

## 補足
- ブラウザ版は react-native-web レンダリング。レイアウト/動線の目視確認には十分だが、ネイティブ固有の見え方は Expo Go(`exp://`)で確認する。
- LAN(同一WiFi)だけでよいなら `--tunnel` 無し（`exp://<PCのLAN IP>:<port>`）でも可。外出先・別回線は**必ず `--tunnel`**。
