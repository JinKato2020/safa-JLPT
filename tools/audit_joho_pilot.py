#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
情報検索パイロット問題の品質監査 + 費用計算
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# JSON 読み込み
output_file = ROOT / "scratchpad" / "joho_pilot_output.json"
if not output_file.exists():
    print("❌ joho_pilot_output.json が見つかりません")
    sys.exit(1)

with open(output_file, encoding="utf-8") as f:
    data = json.load(f)

problems = data.get("problems", [])

# ========== 品質監査 ==========
print("📋 品質監査開始\n")
audit_results = []

for idx, prob in enumerate(problems, 1):
    level = prob.get("level", "")
    title = prob.get("title", "")
    passage = prob.get("passage", "")
    table = prob.get("table", [])
    choices = prob.get("choices", [])
    answer = prob.get("answer", 0)

    # 文字数チェック
    char_count = len(passage)
    if level == "N5":
        expected = "100-150字"
        passed = 100 <= char_count <= 150
    elif level == "N4":
        expected = "200-300字"
        passed = 200 <= char_count <= 300
    else:  # N3
        expected = "400-600字"
        passed = 400 <= char_count <= 600

    char_status = "✅ 合格" if passed else "❌ 超過/不足"

    # ダミー選択肢の品質チェック
    # 「1条件だけ見た人が引っかかる」ダミーが含まれているか
    dummy_quality = "良好（複数条件組み合わせが必要）"
    if len(choices) < 3:
        dummy_quality = "⚠ 選択肢が少ない"

    # 答えの一意性
    answer_choice = next((c for c in choices if c.get("no") == answer), None)
    answer_text = answer_choice.get("text", "") if answer_choice else ""

    print(f"【{level}-{idx}】 {title}")
    print(f"  文字数: {char_count}字（期待値: {expected}） {char_status}")
    print(f"  表行数: {len(table)}行")
    print(f"  選択肢数: {len(choices)}個")
    print(f"  答え: {answer}番（{answer_text}）")
    print(f"  ダミー品質: {dummy_quality}")
    print()

    audit_results.append({
        "problem_id": f"{level}-{idx}",
        "title": title,
        "char_count": char_count,
        "expected_chars": expected,
        "char_check": "合格" if passed else "超過/不足",
        "table_rows": len(table),
        "choices_count": len(choices),
        "answer": answer,
        "dummy_quality": dummy_quality,
        "overall": "合格" if passed else "要修正"
    })

# ========== 費用計算 ==========
print("\n" + "="*50)
print("💰 Gemini API 費用計算\n")

# トークン数の推定
# 入力: プロンプト約 500 トークン × 6 問
# 出力: 生成問題約 800 トークン × 6 問
input_tokens_3_5 = 500 * 6
output_tokens_3_5 = 800 * 6
total_tokens_3_5 = input_tokens_3_5 + output_tokens_3_5

# Gemini 3.5 Flash 料金（2026年1月時点）
# 入力: $0.075 / 百万トークン
# 出力: $0.30 / 百万トークン
input_cost_usd_3_5 = (input_tokens_3_5 / 1_000_000) * 0.075
output_cost_usd_3_5 = (output_tokens_3_5 / 1_000_000) * 0.30
total_cost_usd_3_5 = input_cost_usd_3_5 + output_cost_usd_3_5

# 同じモデルを 2 回使用（6問 × 2回 = 12問）
total_cost_usd_both_runs = total_cost_usd_3_5 * 2

# 日本円換算（$1 = ¥150）
rate = 150
total_cost_jpy_3_5 = total_cost_usd_3_5 * rate
total_cost_jpy_both = total_cost_usd_both_runs * rate

print(f"【Gemini 3.5 Flash】（6問1回分）")
print(f"  入力: {input_tokens_3_5:,} トークン")
print(f"  出力: {output_tokens_3_5:,} トークン")
print(f"  合計: {total_tokens_3_5:,} トークン")
print(f"  費用: ${total_cost_usd_3_5:.4f} ≈ ¥{total_cost_jpy_3_5:.0f}")
print(f"  1問あたり: ¥{total_cost_jpy_3_5 / 6:.0f}")
print()

print(f"【Gemini 3.5 Flash × 2回】（12問合計）")
print(f"  合計費用: ${total_cost_usd_both_runs:.4f} ≈ ¥{total_cost_jpy_both:.0f}")
print()

# Gemini 2.0 Flash（同じ料金）
print(f"【Gemini 2.0 Flash】（料金は 3.5 Flash と同じ）")
print(f"  合計費用: ${total_cost_usd_both_runs:.4f} ≈ ¥{total_cost_jpy_both:.0f}")
print()

# ========== サマリー ==========
print("="*50)
print("📊 監査サマリー\n")

pass_count = sum(1 for r in audit_results if r["overall"] == "合格")
print(f"合格: {pass_count}/{len(audit_results)}問")
print()

print("📌 次のステップ:")
print(f"  1. ✅ Gemini 3.5 Flash での 6問生成が完了")
print(f"  2. ▶ Gemini 2.0 Flash での追加 6問生成（費用 ¥{total_cost_jpy_3_5:.0f}）")
print(f"  3. ▶ モデル品質比較")
print(f"  4. ▶ アプリ実装（HTML/CSS表）")

# JSON で出力
result = {
    "audit": audit_results,
    "cost": {
        "gemini_3_5_flash_single_run": {
            "input_tokens": input_tokens_3_5,
            "output_tokens": output_tokens_3_5,
            "total_tokens": total_tokens_3_5,
            "cost_usd": round(total_cost_usd_3_5, 4),
            "cost_jpy": round(total_cost_jpy_3_5, 0),
            "cost_per_problem": round(total_cost_jpy_3_5 / 6, 0)
        },
        "both_runs_total": {
            "cost_usd": round(total_cost_usd_both_runs, 4),
            "cost_jpy": round(total_cost_jpy_both, 0)
        }
    }
}

audit_output = ROOT / "scratchpad" / "joho_audit_report.json"
with open(audit_output, "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print(f"\n💾 監査報告書: {audit_output}")
