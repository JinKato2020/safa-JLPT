#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PDF から情報検索（大問6/7）の構造を抽出
"""
try:
    import PyPDF2
except ImportError:
    print("PyPDF2 をインストール中...")
    import subprocess
    subprocess.run(["pip", "install", "-q", "PyPDF2"], check=True)
    import PyPDF2

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
pdfs = {
    "N5": ROOT / "問題作成の参考" / "N5_読解.pdf",
    "N4": ROOT / "問題作成の参考" / "N4_読解.pdf",
    "N3": ROOT / "問題作成の参考" / "N3_読解.pdf",
}

for level, pdf_path in pdfs.items():
    if not pdf_path.exists():
        print(f"⚠️  {level} 見つかりません: {pdf_path}")
        continue

    with open(pdf_path, "rb") as f:
        reader = PyPDF2.PdfReader(f)
        print(f"\n{'='*60}")
        print(f"📄 {level}_読解.pdf（全{len(reader.pages)}ページ）")
        print(f"{'='*60}")

        # 最後の 3 ページを読む（情報検索は大問6/7で後ろに配置）
        for page_num in range(max(0, len(reader.pages) - 3), len(reader.pages)):
            page = reader.pages[page_num]
            text = page.extract_text()

            # 情報検索のキーワード検索
            if "情報検索" in text or "問題" in text or "表" in text:
                print(f"\n--- ページ {page_num + 1} ---")
                print(text[:1000])
                print("...")
