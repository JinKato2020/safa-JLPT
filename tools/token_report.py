#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""token_report.py — トークン消費の恒久レポート。

データ源 = ~/.claude/projects/**/*.jsonl の message.usage。
文脈 = input_tokens + cache_read_input_tokens + cache_creation_input_tokens

使い方は tools/token_report_README.md を参照。
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import unicodedata
from collections import defaultdict
from datetime import datetime, timedelta, timezone

# ---- 出力は常に UTF-8 (cp932 コンソールでも落ちない) --------------------
for _s in ("stdout", "stderr"):
    try:
        getattr(sys, _s).reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

CLAUDE_DIR = os.path.join(os.path.expanduser("~"), ".claude")
PROJECTS_DIR = os.path.join(CLAUDE_DIR, "projects")
DEFAULT_COMPACT_WINDOW = 200_000
MAX_CONSOLE_LINES = 30

MAIN, WORKFLOW, SUBAGENT = "main", "workflow", "subagent"
BACKSTAGE = (WORKFLOW, SUBAGENT)


# ---- 数値の見せ方 -------------------------------------------------------
def human(n: int) -> str:
    """3桁区切り + 億/万 の併記。"""
    n = int(n)
    if abs(n) >= 100_000_000:
        return f"{n:,} ({n / 100_000_000:.2f}億)"
    if abs(n) >= 10_000:
        return f"{n:,} ({n / 10_000:,.0f}万)"
    return f"{n:,}"


def compact(n: int) -> str:
    """表のセル用の短い表記。"""
    n = int(n)
    if abs(n) >= 100_000_000:
        return f"{n / 100_000_000:.2f}億"
    if abs(n) >= 10_000:
        return f"{n / 10_000:,.1f}万"
    return f"{n:,}"


def pct(part: int, whole: int) -> str:
    return f"{(100.0 * part / whole):.1f}%" if whole else "-"


def width(s: str) -> int:
    """全角を2桁として数えた表示幅。"""
    return sum(2 if unicodedata.east_asian_width(c) in "WF" else 1 for c in s)


def pad(s, w: int, right: bool = True) -> str:
    """表示幅ベースの桁揃え (全角混在でも崩れない)。"""
    s = str(s)
    fill = " " * max(0, w - width(s))
    return fill + s if right else s + fill


# ---- 走査 ---------------------------------------------------------------
def classify(rel_parts) -> str:
    """wf_ を subagents より先に判定する (workflow は subagents/workflows/wf_*/ の下)。"""
    for p in rel_parts:
        if p.startswith("wf_"):
            return WORKFLOW
    if "subagents" in rel_parts:
        return SUBAGENT
    return MAIN


def session_key(rel_parts) -> str:
    """セッション UUID = プロジェクト直下の <uuid>.jsonl か <uuid>/ ディレクトリ。"""
    if len(rel_parts) >= 2:
        return rel_parts[1][:-6] if rel_parts[1].endswith(".jsonl") else rel_parts[1]
    return rel_parts[0]


def iter_transcripts(since: datetime | None):
    """(path, category, session, project) を返す。mtime で窓外のファイルを足切り。"""
    if not os.path.isdir(PROJECTS_DIR):
        return
    cutoff = since.timestamp() if since else None
    for root, _dirs, files in os.walk(PROJECTS_DIR):
        for fn in files:
            if not fn.endswith(".jsonl"):
                continue
            path = os.path.join(root, fn)
            try:
                if cutoff is not None and os.path.getmtime(path) < cutoff:
                    continue  # 追記式なので mtime が窓より古ければ窓内の行は無い
            except OSError:
                continue
            rel = os.path.relpath(path, PROJECTS_DIR).replace("\\", "/").split("/")
            yield path, classify(rel), session_key(rel), rel[0]


def parse_ts(raw):
    if not raw:
        return None
    try:
        return datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except ValueError:
        return None


def iter_usage(path):
    """usage を含む行だけ JSON 解析して (ts, ctx, out) を返す。"""
    try:
        fh = open(path, "r", encoding="utf-8", errors="replace")
    except OSError:
        return
    with fh:
        for line in fh:
            if '"usage"' not in line:
                continue  # 巨大ファイル対策: 該当行だけ解析
            try:
                rec = json.loads(line)
            except (ValueError, TypeError):
                continue
            msg = rec.get("message")
            if not isinstance(msg, dict):
                continue
            usage = msg.get("usage")
            if not isinstance(usage, dict):
                continue
            ts = parse_ts(rec.get("timestamp"))
            if ts is None:
                continue
            ctx = sum(
                int(usage.get(k) or 0)
                for k in ("input_tokens", "cache_read_input_tokens",
                          "cache_creation_input_tokens")
            )
            yield ts, ctx, int(usage.get("output_tokens") or 0)


class Stats:
    """バケット/セッション共通の集計器。"""

    def __init__(self):
        self.calls = defaultdict(int)
        self.ctx = defaultdict(int)
        self.out = defaultdict(int)
        self.max_main_ctx = 0
        self.first = None
        self.last = None

    def add(self, cat, ts, ctx, out):
        self.calls[cat] += 1
        self.ctx[cat] += ctx
        self.out[cat] += out
        if cat == MAIN and ctx > self.max_main_ctx:
            self.max_main_ctx = ctx
        if self.first is None or ts < self.first:
            self.first = ts
        if self.last is None or ts > self.last:
            self.last = ts

    @property
    def total_calls(self):
        return sum(self.calls.values())

    def total(self, cats=None):
        cats = cats or (MAIN, WORKFLOW, SUBAGENT)
        return sum(self.ctx[c] + self.out[c] for c in cats)

    @property
    def main_total(self):
        return self.total([MAIN])

    @property
    def back_total(self):
        return self.total(BACKSTAGE)


def collect(since, bucket_fn):
    """1回の走査でバケット別とセッション別を同時に集計。"""
    buckets = defaultdict(Stats)
    sessions = defaultdict(Stats)
    proj_of = {}
    overall = Stats()
    for path, cat, sess, proj in iter_transcripts(since):
        for ts, ctx, out in iter_usage(path):
            local = ts.astimezone()
            if since and local < since:
                continue
            buckets[bucket_fn(local)].add(cat, local, ctx, out)
            sessions[sess].add(cat, local, ctx, out)
            proj_of.setdefault(sess, proj)
            overall.add(cat, local, ctx, out)
    return buckets, sessions, proj_of, overall


# ---- --now --------------------------------------------------------------
def compact_window() -> int:
    try:
        with open(os.path.join(CLAUDE_DIR, "settings.json"), encoding="utf-8") as fh:
            v = json.load(fh).get("autoCompactWindow")
        return int(v) if v else DEFAULT_COMPACT_WINDOW
    except Exception:
        return DEFAULT_COMPACT_WINDOW


def encode_cwd(path: str) -> str:
    """cwd -> projects/ 配下のディレクトリ名 (英数字以外は '-')。"""
    return re.sub(r"[^a-zA-Z0-9]", "-", os.path.abspath(path))


def now_line() -> str:
    """今のセッション = 直近に書かれた MAIN。まず現在の cwd のプロジェクトから探す。"""
    here = encode_cwd(os.getcwd()).lower()
    best = {}  # scope -> (mtime, path, session)
    for path, cat, s, proj in iter_transcripts(None):
        if cat != MAIN:
            continue
        try:
            m = os.path.getmtime(path)
        except OSError:
            continue
        for scope in ("here", "any") if proj.lower() == here else ("any",):
            if m > best.get(scope, (-1.0,))[0]:
                best[scope] = (m, path, s)
    picked = best.get("here") or best.get("any")
    newest, sess = (picked[1], picked[2]) if picked else (None, None)
    if not newest:
        return "現在の文脈: 対象セッションが見つかりません"

    last_ctx, calls, last_ts = 0, 0, None
    for ts, ctx, _out in iter_usage(newest):
        last_ctx, last_ts = ctx, ts
        calls += 1
    if not calls:
        return f"現在の文脈: 使用記録なし (session {sess[:8]})"

    win = compact_window()
    ratio = 100.0 * last_ctx / win
    mark = " ★圧縮間近" if ratio >= 80 else (" 注意" if ratio >= 60 else "")
    when = last_ts.astimezone().strftime("%m/%d %H:%M") if last_ts else "-"
    return (f"現在の文脈: {human(last_ctx)} / {win:,} = {ratio:.1f}%{mark}"
            f"  [session {sess[:8]} / 往復 {calls} / 最終 {when}]")


# ---- レポート組み立て ---------------------------------------------------
def build_report(mode, since, label):
    if mode == "hours":
        bucket_fn = lambda d: d.strftime("%m/%d %H時")
    else:
        bucket_fn = lambda d: d.strftime("%Y-%m-%d")

    buckets, sessions, proj_of, overall = collect(since, bucket_fn)
    lines = [f"# トークン消費レポート — {label}",
             f"集計時刻 {datetime.now().astimezone().strftime('%Y-%m-%d %H:%M')}"]

    if overall.total_calls == 0:
        lines.append("(対象期間に記録がありません)")
        return lines

    if mode == "sessions":
        lines.append("")
        lines.append(pad("セッション", 10, False) + pad("往復", 7) + pad("最大文脈", 10)
                     + pad("平均文脈", 10) + pad("合計", 10) + pad("寿命", 8))
        ranked = sorted(sessions.items(), key=lambda kv: kv[1].total(), reverse=True)[:15]
        for sess, st in ranked:
            main_calls = st.calls[MAIN]
            avg = st.ctx[MAIN] / main_calls if main_calls else 0
            life = ((st.last - st.first).total_seconds() / 3600.0
                    if st.first and st.last else 0)
            lines.append(pad(sess[:8], 10, False) + pad(f"{st.total_calls:,}", 7)
                         + pad(compact(st.max_main_ctx), 10) + pad(compact(avg), 10)
                         + pad(compact(st.total()), 10) + pad(f"{life:.1f}h", 8))
        lines.append("※最大/平均文脈=MAIN(対話)のみ。合計=MAIN+裏方の文脈+出力")
    else:
        lines.append("")
        lines.append(pad("期間", 12, False) + pad("往復", 7) + pad("MAIN", 10)
                     + pad("裏方", 10) + pad("合計", 10))
        for key in sorted(buckets):
            st = buckets[key]
            if st.total() == 0:
                continue  # 無活動のバケットは省く
            lines.append(pad(key, 12, False) + pad(f"{st.total_calls:,}", 7)
                         + pad(compact(st.main_total), 10)
                         + pad(compact(st.back_total), 10)
                         + pad(compact(st.total()), 10))

    total = overall.total()
    lines.append("")
    lines.append(f"合計 {human(total)} / 往復 {overall.total_calls:,}")
    lines.append(f"  MAIN(対話) {human(overall.main_total)} = {pct(overall.main_total, total)}"
                 f"   裏方(wf+sub) {human(overall.back_total)} = {pct(overall.back_total, total)}")
    ctx_all = sum(overall.ctx.values())
    out_all = sum(overall.out.values())
    lines.append(f"  内訳: 文脈読込 {human(ctx_all)} = {pct(ctx_all, total)}"
                 f"   出力 {human(out_all)} = {pct(out_all, total)}")
    if overall.max_main_ctx:
        win = compact_window()
        lines.append(f"  MAIN 最大文脈 {human(overall.max_main_ctx)}"
                     f" / autoCompact {win:,} = {pct(overall.max_main_ctx, win)}")
    return lines


def clamp(lines, limit=MAX_CONSOLE_LINES):
    """画面出力を limit 行以内に必ず収める (中間を省略)。"""
    if len(lines) <= limit:
        return lines
    head, tail = 4, limit - 4 - 1
    hidden = len(lines) - head - tail
    return lines[:head] + [f"  … 中間 {hidden} 行省略 (全文は --out を使用)"] + lines[-tail:]


def to_markdown(lines, label):
    body = ["# トークン消費レポート", "", f"- 対象: {label}",
            f"- 生成: {datetime.now().astimezone().strftime('%Y-%m-%d %H:%M:%S')}",
            "", "```", *lines, "```", ""]
    return "\n".join(body)


def main():
    ap = argparse.ArgumentParser(
        description="Claude Code のトークン消費レポート (既定=直近24時間・1時間刻み)")
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--days", type=int, metavar="N", help="直近N日を日別に")
    g.add_argument("--hours", type=int, metavar="N", help="直近N時間を1時間刻みで")
    g.add_argument("--now", action="store_true",
                   help="今のセッションの文脈サイズと autoCompact 比を1行で")
    ap.add_argument("--sessions", action="store_true",
                    help="セッション別 上位15 (既定の窓=直近7日)")
    ap.add_argument("--out", metavar="PATH", help="結果を Markdown ファイルにも書く")
    args = ap.parse_args()

    if args.now:
        line = now_line()
        print(line)
        if args.out:
            os.makedirs(os.path.dirname(os.path.abspath(args.out)) or ".", exist_ok=True)
            with open(args.out, "w", encoding="utf-8") as fh:
                fh.write(to_markdown([line], "現在の文脈"))
            print(f"→ {os.path.abspath(args.out)}")
        return 0

    now = datetime.now().astimezone()
    if args.days:
        mode, since, span = "days", now - timedelta(days=args.days), f"直近{args.days}日"
    elif args.hours:
        mode, since, span = "hours", now - timedelta(hours=args.hours), f"直近{args.hours}時間"
    elif args.sessions:
        mode, since, span = "sessions", now - timedelta(days=7), "直近7日"
    else:
        mode, since, span = "hours", now - timedelta(hours=24), "直近24時間"

    if args.sessions:
        mode, label = "sessions", f"{span} セッション別 上位15"
    else:
        label = f"{span} ({'日別' if mode == 'days' else '1時間刻み'})"

    lines = build_report(mode, since, label)
    print("\n".join(clamp(lines)))

    if args.out:
        dest = os.path.abspath(args.out)
        os.makedirs(os.path.dirname(dest) or ".", exist_ok=True)
        with open(dest, "w", encoding="utf-8") as fh:
            fh.write(to_markdown(lines, label))
        print(f"→ {dest}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
