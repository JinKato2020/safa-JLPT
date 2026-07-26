#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
info_search_viewer.html を data URL に変換して QR コード生成
"""
import base64
from pathlib import Path

try:
    import qrcode
except ImportError:
    print("⚠️  qrcode がインストールされていません")
    print("実行: pip install qrcode[pil]")
    exit(1)

ROOT = Path(__file__).resolve().parent.parent
html_file = ROOT / "scratchpad" / "info_search_viewer.html"

if not html_file.exists():
    print(f"❌ {html_file} が見つかりません")
    exit(1)

# HTML 読み込み
with open(html_file, "rb") as f:
    html_content = f.read()

# Base64 エンコード
b64 = base64.b64encode(html_content).decode('ascii')
data_url = f"data:text/html;base64,{b64}"

print("✅ Data URL 生成完了")
print(f"📊 URL長: {len(data_url)} 文字")
print("")

# URL が長すぎて QR コードに収まらないので、テキストファイルに保存
url_file = ROOT / "scratchpad" / "info_search_viewer.url"
with open(url_file, "w", encoding="utf-8") as f:
    f.write(data_url)

print(f"✅ Data URL をファイルに保存")
print(f"📁 {url_file}")
print("")
print(f"💡 使用方法:")
print(f"   1. PC で上記ファイルを開く")
print(f"   2. URL 全体をコピー")
print(f"   3. iPhone Safari のアドレスバーに貼り付け")
print(f"   4. Enter キーで開く")
