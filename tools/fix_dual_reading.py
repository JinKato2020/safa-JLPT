# -*- coding: utf-8 -*-
"""複数読みの熟語(漢字読み問題)の読みを src/data/dualReadingWords.json のルールに統一する。

A群(answer!=null): その問題の answer をルールの読みに統一。他の登録読みは答え・誤答から排除。
B群(answer=null) : 各問の answer は維持。ただし answer と別の「もう一方の正しい読み」が誤答に
                   混ざっていれば、それを非読みの誤答に差し替える(片方が答えの時もう片方を混ぜない)。

誤答の差し替えは、答えを 1 拍だけ濁点/清音・長音・促音で崩した「もっともらしい誤読」を作り、
どの登録読みとも一致しないものを採る(既存の誤答の作り方と同じ流儀)。

使い方:  python tools/fix_dual_reading.py            # 適用
         python tools/fix_dual_reading.py --dry     # 変更内容だけ表示(書き込まない)
"""
import io, json, os, sys, argparse

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CFG = os.path.join(ROOT, "src", "data", "dualReadingWords.json")
DIR = os.path.join(ROOT, "content", "problems", "moji_goi")
LEVELS = ("N5", "N4", "N3")

VOICE = {"か": "が", "き": "ぎ", "く": "ぐ", "け": "げ", "こ": "ご", "さ": "ざ", "し": "じ",
         "す": "ず", "せ": "ぜ", "そ": "ぞ", "た": "だ", "ち": "ぢ", "つ": "づ", "て": "で",
         "と": "ど", "は": "ば", "ひ": "び", "ふ": "ぶ", "へ": "べ", "ほ": "ぼ"}
UNVOICE = {v: k for k, v in VOICE.items()}
VOWEL = {"あ": "あ", "か": "あ", "さ": "あ", "た": "あ", "な": "あ", "は": "あ", "ま": "あ",
         "ら": "あ", "が": "あ", "ざ": "あ", "だ": "あ", "ば": "あ",
         "い": "い", "き": "い", "し": "い", "ち": "い", "に": "い", "ひ": "い", "み": "い",
         "り": "い", "ぎ": "い", "じ": "い", "び": "い",
         "う": "う", "く": "う", "す": "う", "つ": "う", "ぬ": "う", "ふ": "う", "む": "う",
         "る": "う", "ぐ": "う", "ず": "う", "ぶ": "う",
         "え": "え", "け": "え", "せ": "え", "て": "え", "ね": "え", "へ": "え", "め": "え",
         "げ": "え", "ぜ": "え", "で": "え", "べ": "え",
         "お": "お", "こ": "お", "そ": "お", "と": "お", "の": "お", "ほ": "お", "も": "お",
         "ろ": "お", "ご": "お", "ぞ": "お", "ど": "お", "ぼ": "お", "ん": "う"}


OROW = set("おこそとのほもよろごぞどぼぽ")   # お段(=長音がおう/おおで揺れる)

def fake_readings(answer):
    """answer を 1 拍だけ崩した『もっともらしい誤読』候補(=どれも実際の読みではない前提)。
    学習者が実際にやりがちな誤りに近い順: ①おう→おお 表記ゆれ ②濁点/清音 ③末尾長音 ④促音挿入。
    (中間に母音を差し込む だあいぶ/ほおんとう のような不自然形は作らない)"""
    out = []
    # ① お段+う で終わる語の おう→おお 表記ゆれ(最も自然な誤答)
    if len(answer) >= 2 and answer[-1] == "う" and answer[-2] in OROW:
        out.append(answer[:-1] + "お")
    # ② 1 拍だけ濁点/清音(ぢ/づ は不自然なので出さない)
    for i, c in enumerate(answer):
        for tbl in (VOICE, UNVOICE):
            if c in tbl and tbl[c] not in ("ぢ", "づ"):
                out.append(answer[:i] + tbl[c] + answer[i + 1:])
    # ③ 末尾の母音を伸ばす(だいぶ→だいぶう)
    if answer and answer[-1] in VOWEL:
        out.append(answer + VOWEL[answer[-1]])
    # ④ 促音を差し込む(いちにち→いちにっち)
    for i in range(1, len(answer)):
        if answer[i - 1] not in "っん" and answer[i] not in "っんぁぃぅぇぉあいうえお":
            out.append(answer[:i] + "っ" + answer[i:])
    seen, uniq = set(), []
    for t in out:
        if t and t not in seen:
            seen.add(t); uniq.append(t)
    return uniq


def pick_replacement(answer, valid, taken):
    for cand in fake_readings(answer):
        if cand and cand != answer and cand not in valid and cand not in taken:
            return cand
    # 最後の砦: 末尾に母音を足し続ける
    base = answer
    for v in "うおいあえ":
        cand = base + v
        if cand not in valid and cand not in taken:
            return cand
    raise RuntimeError("誤答候補を作れませんでした: " + answer)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true")
    a = ap.parse_args()

    cfg = json.load(io.open(CFG, encoding="utf-8"))["words"]
    total_ans, total_distr = 0, 0
    log = []

    for lv in LEVELS:
        path = os.path.join(DIR, f"kanji_read_{lv}.json")
        raw = io.open(path, encoding="utf-8", newline="").read()  # 改行を翻訳せず保持
        crlf = "\r\n" in raw                     # N4/N3 は CRLF、N5 は改行なし
        minified = "\n" not in raw.strip()       # N5 はミニファイ1行、N4/N3 は indent=2
        d = json.loads(raw)
        changed = False
        for it in d["items"]:
            w = it.get("underline")
            if w not in cfg:
                continue
            rule = cfg[w]
            valid = set(rule["readings"])

            # 1) A群: 答えを統一
            if rule["answer"] and it["answer"] != rule["answer"]:
                log.append(f"{it['id']} {w} 答え {it['answer']} → {rule['answer']}")
                it["answer"] = rule["answer"]
                total_ans += 1
                changed = True
            ans = it["answer"]

            # 2) 誤答から『別の正しい読み』を排除
            taken = set(c for c in it["choices"]) | {ans}
            for idx, c in enumerate(it["choices"]):
                if c in valid and c != ans:
                    rep = pick_replacement(ans, valid, taken)
                    taken.add(rep)
                    log.append(f"{it['id']} {w} 誤答 {c} → {rep}")
                    it["choices"][idx] = rep
                    total_distr += 1
                    changed = True
        if changed and not a.dry:
            if minified:
                text = json.dumps(d, ensure_ascii=False, separators=(",", ":"))
            else:
                text = json.dumps(d, ensure_ascii=False, indent=2)
            if crlf:
                text = text.replace("\n", "\r\n")  # 元の CRLF を維持
            io.open(path, "w", encoding="utf-8", newline="").write(text)  # 末尾改行なしを維持

    print("\n".join(log) if log else "(変更なし)")
    print(f"\n=== 答え統一 {total_ans} 件 / 誤答差し替え {total_distr} 件 "
          f"{'[DRY-RUN 未書き込み]' if a.dry else '[書き込み済み]'} ===")


if __name__ == "__main__":
    main()
