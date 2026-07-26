#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
joho_pilot_output.json を読み込んで、テキストファイルに変換
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# JSON 読み込み
input_file = ROOT / "scratchpad" / "joho_pilot_output.json"
output_file = ROOT / "情報検索パイロット_6問.txt"

if not input_file.exists():
    print(f"❌ {input_file} が見つかりません")
    exit(1)

with open(input_file, encoding="utf-8") as f:
    data = json.load(f)

problems = data.get("problems", [])

# テキスト生成
lines = []
lines.append("=" * 80)
lines.append("JLPT 読解「情報検索」（大問7）パイロット問題 — 6問")
lines.append("=" * 80)
lines.append("")

for idx, prob in enumerate(problems, 1):
    level = prob.get("level", "")
    title = prob.get("title", "")
    passage = prob.get("passage", "")
    table = prob.get("table", [])
    question = prob.get("question", "")
    choices = prob.get("choices", [])
    answer = prob.get("answer", 0)
    explain_answer = prob.get("explain_answer", "")

    lines.append(f"【{level}-{idx}】 {title}")
    lines.append("-" * 80)
    lines.append("")

    # 本文
    lines.append("■ 本文")
    lines.append(passage)
    lines.append("")

    # 表
    if table:
        lines.append("■ 表")
        # ヘッダー
        columns = list(table[0].keys())
        col_widths = {col: max(len(col), max(len(str(row.get(col, ""))) for row in table)) for col in columns}

        header = " | ".join(col.ljust(col_widths[col]) for col in columns)
        lines.append(header)
        lines.append("-" * len(header))

        # 行
        for row in table:
            row_str = " | ".join(str(row.get(col, "")).ljust(col_widths[col]) for col in columns)
            lines.append(row_str)
        lines.append("")

    # 設問
    lines.append("■ 設問")
    lines.append(question)
    lines.append("")

    # 選択肢
    lines.append("■ 選択肢")
    for choice in choices:
        no = choice.get("no", 0)
        text = choice.get("text", "")
        explain = choice.get("explain", "")
        lines.append(f"{no}. {text}")
        lines.append(f"   → {explain}")
    lines.append("")

    # 正解と解説
    lines.append("■ 正解")
    answer_choice = next((c for c in choices if c.get("no") == answer), None)
    if answer_choice:
        lines.append(f"{answer}. {answer_choice.get('text', '')}")
    lines.append("")

    lines.append("■ 解説")
    lines.append(explain_answer)
    lines.append("")
    lines.append("")

# ファイル保存
with open(output_file, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))

print(f"✅ テキストファイルを保存しました")
print(f"📁 {output_file}")
print(f"📊 {len(problems)}問を出力")
