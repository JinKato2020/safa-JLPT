# -*- coding: utf-8 -*-
"""漢字読みの誤答を【公式の型】で辞書から機械生成する(LLM不要=実費0・クォータ消費0)。

公式の手口(N4・N3の問題1を実読して抽出・2026-07-17):
  A3 音訓の組み合わせ違い … 今月(今=いま/こん × 月=げつ/つき)→いまげつ/いまつき/こんつき
                          小型(小=こ/しょう × 型=がた/けい)→しょうがた/こけい/しょうけい
  A1 濁音の違い          … 研究→けんぎゅう / 方角→ほうかく / 新しい→あだらしい
  A2 長音・促音の違い      … 台風→たいふ / 手術→しゅうじゅう / 学校→がっこ
  B  実在語で揃える       … 済んだ→つんだ/やんだ/よんだ / 根→は/えだ/たね
★「存在しない文字列だから無効」は【誤り】。公式の主力は非実在語(=正確に覚えていないと消せない)。

辞書: app/dict/ja-kanji.json(1,974字の音訓) / ja-vocab.json(8,033語)
"""
import argparse
import io
import itertools
import json
import os
import re
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "app", "content", "problems", "moji_goi")
DICT = os.path.join(ROOT, "app", "dict")

kata2hira = lambda s: "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in s)
IS_KANJI = lambda c: "㐀" <= c <= "鿿"

VOICE = {"か": "が", "き": "ぎ", "く": "ぐ", "け": "げ", "こ": "ご", "さ": "ざ", "し": "じ", "す": "ず",
         "せ": "ぜ", "そ": "ぞ", "た": "だ", "ち": "ぢ", "つ": "づ", "て": "で", "と": "ど",
         "は": "ば", "ひ": "び", "ふ": "ぶ", "へ": "べ", "ほ": "ぼ"}
UNVOICE = {v: k for k, v in VOICE.items()}

# --- 辞書 ---
KANJI = {}
for k in json.load(io.open(os.path.join(DICT, "ja-kanji.json"), encoding="utf-8")):
    stems, fulls = set(), set()
    for o in k.get("on") or []:
        stems.add(kata2hira(o))
    for u in k.get("kun") or []:
        u = u.replace("-", "")
        stems.add(u.split(".")[0])
        fulls.add(u.replace(".", ""))
    KANJI[k["char"]] = {"stem": {s for s in stems if s}, "full": {s for s in fulls if s}}

VOCAB = json.load(io.open(os.path.join(DICT, "ja-vocab.json"), encoding="utf-8"))
REAL = {v["reading"] for v in VOCAB if v.get("reading")}
# 語→その語の正しい読み(複数あり得る)。第2の正解を避けるために使う。
WORD_READ = {}
for v in VOCAB:
    if v.get("word") and v.get("reading"):
        WORD_READ.setdefault(v["word"], set()).add(v["reading"])


def readings_of(word):
    """その語として正しい読み(=誤答にしてはいけないもの)。"""
    return WORD_READ.get(word, set())


def onkun_variants(word, answer):
    """A3: 各漢字の実在する読みを継ぎ合わせる。かな(送り仮名)はそのまま残す。

    ★stem(送り仮名を除いた部分)だけを使う。full を混ぜると
      会う→「あう」+送り仮名「う」=あうう / 学生→学+いきる=がくいきる のような
      日本語にならない文字列が出る(第1版で実際に出した)。
    """
    parts = []
    for ch in word:
        if IS_KANJI(ch) and ch in KANJI:
            parts.append(sorted(KANJI[ch]["stem"]))
        elif IS_KANJI(ch):
            return []          # 辞書に無い漢字は諦める
        else:
            parts.append([ch])  # 送り仮名等はそのまま
    if sum(len(p) for p in parts) > 60:
        return []
    return [("".join(c), "A3 音訓の組み合わせ違い") for c in itertools.product(*parts)]


def voiced_variants(answer):
    """A1: 1拍だけ濁音/清音を入れ替える。"""
    out = []
    for i, c in enumerate(answer):
        for tbl in (VOICE, UNVOICE):
            if c in tbl:
                out.append((answer[:i] + tbl[c] + answer[i + 1:], "A1 濁音の違い"))
    return out


def length_variants(answer):
    """A2: 長音・促音を足す/落とす。"""
    out = []
    if "っ" in answer:
        out.append((answer.replace("っ", "", 1), "A2 促音を落とす"))
    for i, c in enumerate(answer):
        if c == "う" and i and answer[i - 1] in "おこそとのほもよろごぞどぼぽょゅ":
            out.append((answer[:i] + answer[i + 1:], "A2 長音を落とす"))
    # 長音を足す(お段の後にう)
    for i, c in enumerate(answer):
        if c in "おこそとのほもよろごぞどぼぽ" and (i + 1 >= len(answer) or answer[i + 1] != "う"):
            out.append((answer[:i + 1] + "う" + answer[i + 1:], "A2 長音を足す"))
    # 促音を足す。★「っ」は無声破裂・摩擦音(か/さ/た/ぱ行)の前にしか立てない。
    #   これを見ないと なっまえ / かっみ のような日本語に無い音を作る(第1版で実際に出した)。
    SOKUON_OK = "かきくけこさしすせそたちつてとぱぴぷぺぽ"
    for i in range(1, len(answer)):
        if answer[i] in SOKUON_OK:
            out.append((answer[:i] + "っ" + answer[i:], "A2 促音を足す"))
    return out


OKURI = re.compile(r"[ぁ-ゟ]+$")


def real_words(word, answer):
    """B: 実在語。公式は【活用形】または【意味分野】で揃える。

    送り仮名つき(=動詞/形容詞)なら「同じ送り仮名で終わる同じ長さの実在語」を採る。
      公式: 結んで→つかんで/ならんで/はさんで ・ 済んだ→つんだ/やんだ/よんだ
    送り仮名が無い(=名詞)場合は意味分野で揃える必要があるが、意味は辞書から機械的に
    引けない。無関係な語(紙→ごみ)を出すだけなので【採らない】。
    """
    m = OKURI.search(word)
    if not m:
        return []
    tail = m.group(0)                       # 送り仮名(う / んで / しい ...)
    if not answer.endswith(tail):
        return []
    out = []
    for r in REAL:
        if len(r) != len(answer) or r == answer or not r.endswith(tail):
            continue
        if sum(1 for a, b in zip(r, answer) if a != b) <= 2:
            out.append((r, "B  実在語(同じ活用形)"))
    return out


def build(word, answer, want=6):
    ng = readings_of(word) | {answer}        # その語の正しい読みは誤答にできない
    seen, out = set(ng), []
    # 語形に応じて公式の型の優先順を変える(公式はここを使い分けている):
    #   送り仮名つき動詞 → B(同じ活用形の実在語) が主力  例 結んで→つかんで/ならんで
    #   熟語・単漢字     → A3(音訓の組み合わせ違い) が主力 例 小型→しょうがた/こけい
    has_okuri = bool(OKURI.search(word))
    gens = ([real_words(word, answer), voiced_variants(answer),
             onkun_variants(word, answer), length_variants(answer)]
            if has_okuri else
            [onkun_variants(word, answer), voiced_variants(answer),
             length_variants(answer), real_words(word, answer)])
    for gen in gens:
        for t, kind in gen:
            if t in seen or not t or t == answer:
                continue
            seen.add(t)
            out.append((t, kind))
            if len(out) >= want:
                return out
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("-n", type=int, default=30, help="試作する問題数")
    ap.add_argument("--want", type=int, default=6, help="目標の誤答数")
    a = ap.parse_args()

    items = []
    for lv in ("N5", "N4", "N3"):
        d = json.load(io.open(os.path.join(D, f"kanji_read_{lv}.json"), encoding="utf-8"))
        for x in d["items"]:
            items.append((lv, x))
    # 多様な30問を採る(級・語形をばらす): 単漢字/送り仮名/熟語 を混ぜる
    def shape(u):
        k = sum(1 for c in u if IS_KANJI(c))
        if k >= 2:
            return "熟語"
        return "送り仮名" if len(u) > k else "単漢字"
    picked, seen_shape = [], {}
    step = max(1, len(items) // (a.n * 6))
    for lv, x in items[::step]:
        s = f"{lv}/{shape(x['underline'])}"
        if seen_shape.get(s, 0) >= a.n // 6:
            continue
        seen_shape[s] = seen_shape.get(s, 0) + 1
        picked.append((lv, x))
        if len(picked) >= a.n:
            break

    short = 0
    for lv, x in picked:
        got = build(x["underline"], x["answer"], a.want)
        cur = [c for c in x["choices"] if c != x["answer"]]
        print(f"■ {lv}  {x['sentence']}")
        print(f"   下線={x['underline']}  ★正解={x['answer']}")
        print(f"   現行の誤答3個 : {' / '.join(cur)}")
        if len(got) < a.want:
            short += 1
            print(f"   ⚠ 生成できたのは{len(got)}個(目標{a.want})")
        for t, kind in got:
            print(f"      + {t:<12} [{kind}]")
        print()
    print(f"=== {len(picked)}問中 {a.want}個そろわなかった: {short}問 ===")


if __name__ == "__main__":
    main()
