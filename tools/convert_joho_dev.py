#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
新規生成6問をアプリ形式に変換
"""

import json
import sys
from pathlib import Path

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

# 生成データ読み込み
gen_file = Path("scratchpad/joho_correct_final.json")
gen_data = json.loads(gen_file.read_text(encoding="utf-8"))

# レベル別に構成
by_level = {"N5": [], "N4": [], "N3": []}

for problem in gen_data["problems"]:
    level = problem["level"]
    # シンプル形式：Gemini 出力をそのまま使用
    by_level[level].append({
        "id": f"{level}-joho-{len(by_level[level])+1}",
        "level": level,
        "title": problem.get("title", ""),
        "passage": problem.get("passage", ""),
        "table": problem.get("table", []),
        "question": problem.get("question", ""),
        "choices": [c.get("text", "") for c in problem.get("choices", [])],
        "answer": problem.get("answer", 1) - 1,  # 0-indexed
        "explain_answer": problem.get("explain_answer", ""),
    })

# 各レベルのファイルに書き込み
for level in ["N5", "N4", "N3"]:
    output_file = Path(f"app/content/problems/dokkai/joho_{level}_dev.json")
    output_data = {
        "schema": 1,
        "daimon": "joho",
        "level": level,
        "type": "情報検索",
        "source": "gemini-3.5-flash",
        "items": by_level[level],
    }

    output_file.write_text(json.dumps(output_data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"✅ {output_file}: {len(by_level[level])}問")
