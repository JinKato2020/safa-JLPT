#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""過去の会話ログ（*.jsonl 約1.2GB）をピンポイント検索する。

狙い（CLAUDE.md A1/A6）: /clear 後でも run ID や過去の決定を掘り起こせるが、
出力量はスクリプト側で機械的に頭打ちにして、コンテキスト爆発を構造的に防ぐ。

使い方:
  python tools/find_history.py "検索語"                     # 前後200字・最大10件
  python tools/find_history.py "文章の文法" "承認"          # AND検索（同じ往復に全語）
  python tools/find_history.py "在庫" --since 2026-07-17    # その日以降だけ
  python tools/find_history.py "方針" --role user           # 私の発言だけ
  python tools/find_history.py "wf_" --count                # 件数だけ
  python tools/find_history.py "語" --session 0bc3da        # そのセッションだけ
  python tools/find_history.py "語" --newest 3              # 新しいログ3本だけ

既定で外しているもの（ノイズ源・明示すれば戻せる）:
  * 実行中セッション自身のログ … 検索コマンド自体がログに載り自分でヒットするため
    （--include-self で対象に戻す）
  * ツール呼び出しの入力・ツールの実行結果 … grep したコマンド文字列がヒットするため
  * 自動で差し込まれる文（system-reminder / CLAUDE.md / スキル一覧）… 毎ターン再掲され
    同じ文が何百件も出るため
    （どちらも --include-tools で対象に戻す）

安全装置:
  * 総出力 8,000 字で強制打ち切り
  * ヒットが --max を超えたら「セッション別の件数＋日付レンジ」だけ出して中身は出さない
  * 同じ内容のスニペットは1件に畳む
  * 巨大行でメモリが飛ばないようブロック読み（行単位で読まない）
"""
from __future__ import annotations

import argparse
import bisect
import re
import sys
import time
from pathlib import Path

LOG_DIR = Path.home() / ".claude" / "projects" / "c--Users-jwpsa-Documents-desktop-claude-JLPT---"

BLOCK = 4 * 1024 * 1024      # 1回に読むバイト数
OUTPUT_BUDGET = 8000         # 総出力の上限（文字）
AND_WINDOW = 3000            # AND検索で「同じ往復」とみなす前後の文字数
SELF_SEC = 300               # 直近この秒数に更新されたログ＝実行中セッションとみなす
NESTED_TEXT = 300            # tool_result 直下の text ブロックとみなす距離

TS_RE = re.compile(r'"timestamp":"([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:\.]+Z?)"')

MARK_RE = re.compile(
    r'"type":"(?P<blk>tool_use|tool_result|text|thinking)"'
    r'|(?P<inject>"toolUseResult":|"attachment":|"isMeta":true'
    r'|<command-name>|<command-message>|<local-command-stdout>)'
    r'|"role":"(?P<role>user|assistant)"'
    r'|<(?P<srclose>/?)system-reminder>'
)


def iter_blocks(path: Path, overlap: int):
    """ファイルを重なり付きブロックで読む。(文字列, ブロック先頭の概算バイト位置)"""
    pos = 0
    tail = ""
    with path.open("rb") as fh:
        while True:
            raw = fh.read(BLOCK)
            if not raw:
                break
            text = tail + raw.decode("utf-8", errors="replace")
            yield text, pos - len(tail)
            pos += len(raw)
            tail = text[-overlap:] if overlap else ""


def tidy(s: str) -> str:
    """スニペットを1行に畳んで読めるようにする。"""
    s = s.replace("\\n", " ").replace("\\t", " ").replace("\\\"", '"')
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def ts_index(text: str):
    """ブロック内の timestamp をまとめて拾う。(位置リスト, 値リスト)"""
    pos, val = [], []
    for m in TS_RE.finditer(text):
        pos.append(m.start())
        val.append(m.group(1)[:19].replace("T", " "))
    return pos, val


def ts_at(pos_list, val_list, i: int) -> str:
    """位置 i に一番近い timestamp（手前優先・無ければ後ろ）。"""
    if not pos_list:
        return ""
    k = bisect.bisect_right(pos_list, i)
    if k > 0:
        return val_list[k - 1]
    return val_list[0]


def build_index(text: str):
    """ブロックを1回なめて、目印の出現位置をまとめて拾う。

    ヒットごとに後ろ向き検索すると、CLAUDE.md やスキル一覧のような
    数万字の塊で目印を見失う（＝人の発言と誤判定する）。先に全部拾っておく。
    """
    idx = {"blk": ([], []), "role": ([], []), "sr": ([], [])}
    for m in MARK_RE.finditer(text):
        if m.group("blk"):
            cat, val = "blk", m.group("blk")
        elif m.group("inject"):
            cat, val = "blk", "inject"
        elif m.group("role"):
            cat, val = "role", m.group("role")
        else:
            cat, val = "sr", ("close" if m.group("srclose") else "open")
        idx[cat][0].append(m.start())
        idx[cat][1].append(val)
    return idx


def last_before(entry, i: int):
    """位置 i より手前で最後に出た目印。(位置, 値)。無ければ (-1, None)。"""
    pos_list, val_list = entry
    k = bisect.bisect_left(pos_list, i)
    if k == 0:
        return -1, None
    return pos_list[k - 1], val_list[k - 1]


def classify(idx, i: int):
    """位置 i が「どの種類のブロック」「誰の発言」かを推定する。

    戻り値 (kind, role):
      kind = 'tool'（ツール入力/実行結果）/ 'inject'（system-reminder等の自動挿入）
             / 'text'（人の発言・AIの返答）/ '?'
      role = 'user' / 'assistant' / '?'
    """
    # CLAUDE.md やスキル一覧は毎ターン自動で差し込まれる＝人が書いた文ではない
    _, sr = last_before(idx["sr"], i)
    if sr == "open":
        return "inject", "?"

    b_pos, blk = last_before(idx["blk"], i)
    if blk is None:
        kind = "?"
    elif blk == "inject":
        # ツール実行結果の記録・添付・スラッシュコマンドの本文＝人が書いた文ではない
        kind = "inject"
    elif blk in ("tool_use", "tool_result"):
        kind = "tool"
    else:
        kind = "text"
        # tool_result の中に入れ子で置かれた text ブロック＝実質ツールの実行結果
        p2, b2 = last_before(idx["blk"], b_pos)
        if b2 == "tool_result" and b_pos - p2 < NESTED_TEXT:
            kind = "tool"

    _, role = last_before(idx["role"], i)
    return kind, role or "?"


def scan(path: Path, primary: str, others: list[str], ctx: int, max_hits: int,
         ignore_case: bool, since: str, until: str, role_want: str, include_tools: bool,
         peek: int = 3):
    """1ファイルを走査。(ヒット総数, スニペット, 最古日時, 最新日時, 畳んだ数, 直近数件)"""
    hay_needle = primary.lower() if ignore_case else primary
    other_needles = [(w.lower() if ignore_case else w) for w in others]
    overlap = max(ctx, AND_WINDOW) + len(primary) + 2

    total = 0
    snippets: list[str] = []
    seen_spans: set[int] = set()
    seen_text: set[str] = set()
    dup = 0
    recent: list[str] = []
    ts_lo = ts_hi = ""

    for text, base in iter_blocks(path, overlap):
        hay = text.lower() if ignore_case else text
        pos_list, val_list = ts_index(text)
        idx = build_index(text)
        start = 0
        while True:
            i = hay.find(hay_needle, start)
            if i < 0:
                break
            start = i + 1

            # 重なり部分での二重カウントを防ぐ
            bucket = (base + i) // 16
            if bucket in seen_spans:
                continue
            seen_spans.add(bucket)

            # --- AND検索: 他の語も同じ往復の中にあるか ---
            if other_needles:
                w_lo = max(0, i - AND_WINDOW)
                w_hi = min(len(hay), i + AND_WINDOW)
                window = hay[w_lo:w_hi]
                if not all(w in window for w in other_needles):
                    continue

            # --- 日付で絞る ---
            ts = ts_at(pos_list, val_list, i)
            day = ts[:10]
            if since and day and day < since:
                continue
            if until and day and day > until:
                continue

            # --- ツール入力/実行結果・発言者で絞る ---
            kind, role = classify(idx, i)
            if not include_tools and kind in ("tool", "inject"):
                continue
            if role_want and role != role_want:
                continue
            if role_want == "user" and kind != "text":
                continue

            # --- 同じ文の再掲（要約の作り直し・貼り直し）は1件に畳む ---
            key = re.sub(r"\s", "", text[max(0, i - 120):i + 120])[:160]
            if key in seen_text:
                dup += 1
                continue
            seen_text.add(key)

            total += 1
            if ts:
                ts_lo = ts if not ts_lo or ts < ts_lo else ts_lo
                ts_hi = ts if not ts_hi or ts > ts_hi else ts_hi

            s_lo = max(0, i - ctx)
            s_hi = min(len(text), i + len(primary) + ctx)
            line = f"    [{ts or '時刻不明'}] …{tidy(text[s_lo:s_hi])}…"
            if len(snippets) < max_hits:
                snippets.append(line)
            if peek:
                recent.append(line)
                if len(recent) > peek:
                    recent.pop(0)

    return total, snippets, ts_lo, ts_hi, dup, recent


def main() -> int:
    ap = argparse.ArgumentParser(description="過去の会話ログをピンポイント検索")
    ap.add_argument("word", nargs="+", help="検索語（2つ以上ならAND検索）")
    ap.add_argument("--ctx", type=int, default=200, help="前後に出す文字数（既定200）")
    ap.add_argument("--max", type=int, default=10, help="表示する最大ヒット数（既定10）")
    ap.add_argument("--count", action="store_true", help="件数だけ出す（中身を出さない）")
    ap.add_argument("--session", default="", help="セッションIDの先頭数文字で絞る")
    ap.add_argument("--newest", type=int, default=0, help="新しいログ N 本だけ見る")
    ap.add_argument("--since", default="", help="この日以降だけ（YYYY-MM-DD）")
    ap.add_argument("--until", default="", help="この日以前だけ（YYYY-MM-DD）")
    ap.add_argument("--role", default="", choices=["", "user", "assistant"],
                    help="user=私の発言だけ / assistant=AIの返答だけ")
    ap.add_argument("--include-tools", action="store_true",
                    help="ツール入力/実行結果・自動挿入(CLAUDE.md等)も検索対象にする")
    ap.add_argument("--include-self", action="store_true",
                    help="実行中セッション自身のログも検索対象にする")
    ap.add_argument("--peek", type=int, default=3,
                    help="上限超過時に各セッションの直近何件を覗くか（0で無し・既定3）")
    ap.add_argument("--case", action="store_true", help="大文字小文字を区別する")
    ap.add_argument("--dir", default=str(LOG_DIR), help="ログ置き場")
    args = ap.parse_args()

    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    log_dir = Path(args.dir)
    if not log_dir.is_dir():
        print(f"ログ置き場が見つかりません: {log_dir}")
        return 1

    files = sorted(log_dir.glob("*.jsonl"), key=lambda p: p.stat().st_mtime, reverse=True)
    if args.session:
        files = [f for f in files if f.stem.startswith(args.session)]
    if args.newest:
        files = files[: args.newest]

    dropped_self = []
    if not args.include_self and not args.session:
        now = time.time()
        keep = []
        for f in files:
            if now - f.stat().st_mtime < SELF_SEC:
                dropped_self.append(f.stem[:8])
            else:
                keep.append(f)
        files = keep

    if not files:
        print("対象ログがありません")
        return 1

    primary, others = args.word[0], list(args.word[1:])
    # 走査は一番長い語で行うとヒットが少なく速い
    if others:
        allw = [primary] + others
        allw.sort(key=len, reverse=True)
        primary, others = allw[0], allw[1:]

    ignore_case = not args.case
    grand_total = 0
    grand_dup = 0
    results = []

    for f in files:
        total, snips, lo, hi, dup, recent = scan(
            f, primary, others, args.ctx, args.max, ignore_case,
            args.since, args.until, args.role, args.include_tools, args.peek)
        grand_dup += dup
        if total:
            grand_total += total
            results.append((f.stem[:8], total, snips, lo, hi, recent))

    cond = []
    if others:
        cond.append("AND")
    if args.since or args.until:
        cond.append(f"{args.since or '…'}〜{args.until or '…'}")
    if args.role:
        cond.append(args.role)
    if args.include_tools:
        cond.append("ツール込み")
    tag = f"（{' / '.join(cond)}）" if cond else ""

    shown = "「" + "」+「".join(args.word) + "」"
    dup_note = f"（同じ文の再掲 {grand_dup}件は除外）" if grand_dup else ""
    print(f"検索語{shown}{tag}: 全{grand_total}件{dup_note} / ログ{len(files)}本中{len(results)}本にヒット")
    if dropped_self:
        print(f"  ※実行中セッション {', '.join(dropped_self)} は除外（戻すなら --include-self）")

    if grand_total == 0:
        return 0

    def digest():
        for stem, total, _s, lo, hi, _r in results:
            span = f"{lo[:16]} 〜 {hi[:16]}" if lo else "日時不明"
            print(f"  {stem}  {total:>5}件  {span}")

    if args.count:
        digest()
        print("（--count のため中身は出していません）")
        return 0

    if grand_total > args.max:
        digest()
        if args.peek:
            print(f"上限{args.max}件超のため中身は出しません。"
                  f"手がかりに各セッションの直近{args.peek}件だけ載せます"
                  f"（全部見るなら語を足してAND検索・--since / --role / --session で絞る）:")
            used = 0
            for stem, _t, _s, _lo, _hi, recent in results:
                for line in recent:
                    if used + len(line) > OUTPUT_BUDGET:
                        print("    …出力上限に達したため打ち切り")
                        return 0
                    print(f"  {stem}{line}")
                    used += len(line)
        else:
            print(f"上限{args.max}件を超えました。中身は出しません。"
                  f"語を足してAND検索にするか、--since / --role / --session で絞ってください。")
        return 0

    used = 0
    for stem, total, snips, _lo, _hi, _r in results:
        head = f"  {stem}  {total}件"
        print(head)
        used += len(head)
        for s in snips:
            if used + len(s) > OUTPUT_BUDGET:
                print("    …出力上限に達したため打ち切り")
                return 0
            print(s)
            used += len(s)
    return 0


if __name__ == "__main__":
    sys.exit(main())
