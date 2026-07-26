#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Stop フック統合スクリプト（CLAUDE.md A2/A3）。

1回の Stop で 3 つを片付ける:
  1) 在庫問題数の更新   … tools/stock_report.py --quiet --if-changed をそのまま呼ぶ
  2) handoff.md の自動欄 … 走行中 run ID / 直近の変更ファイルを機械で書き直す
  3) 文脈サイズの監視   … 会話が育ちすぎ / ツールループが長すぎる時に警告する

3) の背景 = md\事故例_トークン浪費.md ④。1セッションが5,052往復・平均文脈34万まで
育ち、24時間の消費の92%を1本が占めた。コストは往復数のほぼ2乗で効くのに、
「ループが長い」という判断は作業中には浮かばない。だから判断ではなく検知にする。

handoff.md は「/clear しても失わない状態の正本」。上書き式で肥大させない。
AUTO:BEGIN 〜 AUTO:END の間だけスクリプトが書き換え、その外（＝「次の一手」）は
Claude が会話の区切りに 1 行だけ手で更新する。人と機械の担当を分けるのが要点。

作業は絶対に止めない（何が失敗しても exit 0）。
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HANDOFF = ROOT / "memory" / "handoff.md"
LEDGER = Path.home() / ".claude" / "run-ledger.jsonl"

BEGIN = "<!-- AUTO:BEGIN -->"
END = "<!-- AUTO:END -->"

# 直近の変更とみなす時間 / 表示する最大件数
RECENT_HOURS = 24
MAX_FILES = 8
MAX_RUNS = 5

# 文脈サイズのしきい値（トークン）
# settings.json の autoCompactWindow=200000 が実際の上限。20万に達すると自動圧縮が走り、
# 会話は要約に置き換わる（≒7万まで落ちて再び伸びる）。だから 20万/30万で警告しても遅い or
# 到達不能。窓に対する割合で切り、「自動圧縮に飲まれる前に、区切りで自分から /clear」を促す。
CTX_WINDOW = 200_000  # settings.json の autoCompactWindow と合わせること
CTX_WARN = 130_000    # 窓の65%。画面に注意を出す
CTX_ALERT = 170_000   # 窓の85%。handoff.md の先頭にも赤ペンを入れる
# 直前のユーザー指示から連続した私のターン数（ツール呼び出しループの長さ）
LOOP_WARN = 40

SKIP_DIRS = {
    ".git", ".expo", ".claude", "node_modules", "__pycache__", "build", "dist",
    "android", "ios", ".gradle", ".venv", "venv", ".next", "coverage",
}
SKIP_SUFFIX = {".pyc", ".log", ".lock", ".jsonl"}

TEMPLATE = f"""# handoff（/clear 耐性・上書き式・常に最新のみ）

## 次の一手
- （未設定）

{BEGIN}
{END}
"""


def run_stock_report() -> None:
    """在庫更新。存在しなければ黙って飛ばす。"""
    script = ROOT / "tools" / "stock_report.py"
    if not script.exists():
        return
    try:
        subprocess.run(
            [sys.executable, str(script), "--quiet", "--if-changed"],
            cwd=str(ROOT), timeout=30,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
    except Exception:
        pass


def running_runs() -> list[str]:
    """台帳から「開始したが完了していない run」を拾う。"""
    if not LEDGER.exists():
        return []
    started: dict[str, str] = {}
    done: set[str] = set()
    try:
        with LEDGER.open("r", encoding="utf-8", errors="replace") as fh:
            lines = fh.readlines()[-400:]  # 台帳が育っても末尾だけ見る
    except Exception:
        return []
    for line in lines:
        try:
            rec = json.loads(line)
        except Exception:
            continue
        rid = rec.get("id")
        if not rid:
            continue
        # サブエージェント= SubagentStart/Stop、ToDoタスク= TaskCreated/Completed。
        # 旧設定は TaskCreated をサブエージェント用と誤認しており台帳が空だった（2026-07-19 修正）
        ev = rec.get("event")
        if ev in ("SubagentStop", "TaskCompleted"):
            done.add(rid)
        elif ev in ("SubagentStart", "TaskCreated"):
            label = (rec.get("label") or rec.get("tool") or rec.get("agent_type") or "")[:60]
            started[rid] = label
    out = [f"{rid} {label}".strip() for rid, label in started.items() if rid not in done]
    return out[-MAX_RUNS:]


def recent_files() -> list[str]:
    """直近 RECENT_HOURS 時間に変更されたファイルを新しい順に。"""
    cutoff = time.time() - RECENT_HOURS * 3600
    hits: list[tuple[float, str]] = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".")]
        for name in filenames:
            if Path(name).suffix in SKIP_SUFFIX:
                continue
            full = Path(dirpath) / name
            try:
                mtime = full.stat().st_mtime
            except OSError:
                continue
            if mtime >= cutoff:
                try:
                    rel = full.relative_to(ROOT).as_posix()
                except ValueError:
                    continue
                hits.append((mtime, rel))
    hits.sort(reverse=True)
    return [rel for _, rel in hits[:MAX_FILES]]


def hook_input() -> dict:
    """Stop フックが stdin で渡す JSON（transcript_path 等）。無ければ空。"""
    try:
        if sys.stdin is None or sys.stdin.isatty():
            return {}
        raw = sys.stdin.read()
    except Exception:
        return {}
    try:
        return json.loads(raw) if raw.strip() else {}
    except Exception:
        return {}


def scan_transcript(path: str) -> dict:
    """今の会話の重さを測る。文脈サイズ・往復数・ツールループ長。

    ファイルは会話に載らないので全部なめてよい。JSON 解析は必要な行だけに絞る。
    """
    out = {"ctx": 0, "turns": 0, "loop": 0, "tools": 0}
    p = Path(path)
    if not path or not p.exists():
        return out
    try:
        with p.open("r", encoding="utf-8", errors="replace") as fh:
            for line in fh:
                if '"usage"' not in line and '"type":"user"' not in line and '"type": "user"' not in line:
                    continue
                try:
                    rec = json.loads(line)
                except Exception:
                    continue
                kind = rec.get("type")
                msg = rec.get("message") or {}

                if kind == "user" and not rec.get("isMeta"):
                    content = msg.get("content")
                    # tool_result はループの途中。人の指示だけをループの起点にする
                    is_tool_result = isinstance(content, list) and any(
                        isinstance(c, dict) and c.get("type") == "tool_result" for c in content
                    )
                    if not is_tool_result:
                        out["loop"] = 0
                        out["tools"] = 0
                    continue

                usage = msg.get("usage")
                if not isinstance(usage, dict):
                    continue
                out["turns"] += 1
                out["loop"] += 1
                content = msg.get("content")
                if isinstance(content, list):
                    out["tools"] += sum(
                        1 for c in content if isinstance(c, dict) and c.get("type") == "tool_use"
                    )
                out["ctx"] = (
                    (usage.get("input_tokens") or 0)
                    + (usage.get("cache_read_input_tokens") or 0)
                    + (usage.get("cache_creation_input_tokens") or 0)
                )
    except OSError:
        pass
    return out


def context_warnings(st: dict) -> tuple[str, list[str]]:
    """(画面に出す1行, handoff.md に書く行) を返す。問題なければ ("", [])。"""
    ctx, turns, loop, tools = st["ctx"], st["turns"], st["loop"], st["tools"]
    if not ctx:
        return "", []
    man = f"{ctx/10000:.0f}万"
    pct = round(ctx * 100 / CTX_WINDOW)
    notes: list[str] = []

    if ctx >= CTX_ALERT:
        head = f"🔴 文脈 {man}／{CTX_WINDOW//10000}万（{pct}%）・{turns}往復 — まもなく自動圧縮。区切りをつけて /clear を"
    elif ctx >= CTX_WARN:
        head = f"⚠ 文脈 {man}／{CTX_WINDOW//10000}万（{pct}%）・{turns}往復 — そろそろ /clear の頃合い"
    else:
        head = ""

    if loop >= LOOP_WARN:
        notes.append(f"ツール呼び出しループが長い（指示1件に対し {loop}ターン・ツール{tools}回）— まとめ方を変える")
        if not head:
            head = f"⚠ 連続 {loop}ターン（文脈 {man}）— ループが長い"

    if not head:
        return "", []

    lines = [f"- {head}"]
    lines += [f"- {n}" for n in notes]
    if ctx >= CTX_ALERT:
        lines.append("- 続けるなら「次の一手」を1行で書いてから /clear すること（この行は解消すると自動で消える）")
    return head, lines


def build_auto_block(warn_lines: list[str]) -> str:
    runs = running_runs()
    files = recent_files()
    stamp = time.strftime("%Y-%m-%d %H:%M")

    lines = [BEGIN, ""]
    if warn_lines:
        lines += ["## ⚠ 会話が重くなっている（自動）"] + warn_lines + [""]
    lines += ["## 走行中の run（自動・完了通知が来ていないもの）"]
    lines += [f"- {r}" for r in runs] if runs else ["- なし"]
    lines += ["", f"## 直近{RECENT_HOURS}時間の変更ファイル（自動）"]
    lines += [f"- {f}" for f in files] if files else ["- なし"]
    lines += ["", f"_自動更新: {stamp}_", END]
    return "\n".join(lines)


def update_handoff(warn_lines: list[str]) -> None:
    HANDOFF.parent.mkdir(parents=True, exist_ok=True)
    if HANDOFF.exists():
        text = HANDOFF.read_text(encoding="utf-8")
    else:
        text = TEMPLATE

    auto = build_auto_block(warn_lines)
    if BEGIN in text and END in text:
        head, _, rest = text.partition(BEGIN)
        _, _, tail = rest.partition(END)
        text = head + auto + tail
    else:
        # マーカーが消えていたら末尾に付け直す（人が書いた部分は消さない）
        text = text.rstrip() + "\n\n" + auto + "\n"

    HANDOFF.write_text(text, encoding="utf-8")


def extract_handoff_next_steps() -> str:
    """handoff.md の「## 次の一手」セクションを抽出。"""
    if not HANDOFF.exists():
        return ""
    try:
        text = HANDOFF.read_text(encoding="utf-8")
        if "## 次の一手" not in text:
            return ""
        lines = text.split("\n")
        start_idx = None
        for i, line in enumerate(lines):
            if "## 次の一手" in line:
                start_idx = i + 1
                break
        if start_idx is None:
            return ""
        result = []
        for i in range(start_idx, len(lines)):
            line = lines[i]
            if line.startswith("## "):
                break
            if line.strip():
                result.append(line)
        return "\n".join(result)
    except Exception:
        return ""


def save_session_summary(transcript_path: str, warn_lines: list[str]) -> None:
    """セッション圧縮情報を memory/session-summary-LATEST.md に保存。"""
    try:
        summary_file = ROOT / "memory" / "session-summary-LATEST.md"
        summary_file.parent.mkdir(parents=True, exist_ok=True)

        lines = ["# 前セッション圧縮情報\n"]

        # セクション1：何をしたか
        lines.append("## 何をしたか")
        st = scan_transcript(transcript_path)
        if st["tools"] > 0:
            lines.append(f"- ツール呼び出し {st['tools']} 回・{st['loop']} ターン")
        if st["turns"] > 0:
            lines.append(f"- 往復 {st['turns']} 回")
        lines.append("")

        # セクション2：何が変わったか
        lines.append("## 何が変わったか")
        files = recent_files()
        if files:
            for f in files[:5]:
                lines.append(f"- {f}")
        else:
            lines.append("- なし")
        lines.append("")

        # セクション3：重要な学習（赤ペンがあればそれを記載）
        if warn_lines:
            lines.append("## ⚠️ 注意")
            for note in warn_lines:
                lines.append(f"- {note}")
            lines.append("")

        # セクション4：次の一手
        lines.append("## 次の一手")
        next_steps = extract_handoff_next_steps()
        if next_steps:
            lines.append(next_steps)
        else:
            lines.append("- （handoff で未設定）")
        lines.append("")

        summary_file.write_text("\n".join(lines), encoding="utf-8")
    except Exception:
        pass


def main() -> int:
    payload = hook_input()

    banner, warn_lines = "", []
    try:
        st = scan_transcript(payload.get("transcript_path") or "")
        banner, warn_lines = context_warnings(st)
        # 赤ペン（handoff.md）は ALERT 以上だけ。WARN は画面の1行で足りる
        if st["ctx"] < CTX_ALERT and st["loop"] < LOOP_WARN:
            warn_lines = []
    except Exception:
        pass

    try:
        run_stock_report()
    except Exception:
        pass
    try:
        update_handoff(warn_lines)
    except Exception:
        pass
    # 圧縮ファイル作成（新規）
    try:
        save_session_summary(payload.get("transcript_path") or "", warn_lines)
    except Exception:
        pass

    if banner:
        # コンソールが cp932 でも落とさないよう utf-8 で直接書く
        try:
            data = json.dumps({"systemMessage": banner}, ensure_ascii=False)
            sys.stdout.buffer.write(data.encode("utf-8"))
            sys.stdout.buffer.flush()
        except Exception:
            pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
