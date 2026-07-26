# -*- coding: utf-8 -*-
"""今日追加したカタカナ16語に、文脈規定の問題を作る。

経緯: 表記の孤児16問(コーラ/サッカー等)を救うため語彙16語を追加したが、文脈規定を
作っていなかったため私がカバー率を 96.4%→96.0% に下げた。その穴を塞ぐ。

★サブエージェントは使わない。16問は直接書く方が25倍安い(CLAUDE.md #9「agent総数は最小か」)。
★解説(i18n.explain)は書かない。実測でどの画面もレンダリングしていない=死にデータ。
  (ユーザー確定「解説文は不要。作らなくてよい」とも一致)

設計方針(今日の教訓): 誤答が【第2の正解】にならないよう、文脈で正解を一つに絞り込む。
  悪い例: 「〔　〕を して います」→ サッカー/テニス/やきゅう が全部成立してしまう
  良い例: 「ボールを 足で けって…」→ 足で蹴る が サッカー を一意に決める
誤答は既存に倣い【その文脈では明確に成立しない語】を3個。分野は近づけつつ、必ず外す。
"""
import argparse
import io
import json
import os
import re
import shutil
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
C = os.path.join(ROOT, "app", "content", "problems", "moji_goi")
VOCAB_P = os.path.join(ROOT, "app", "src", "data", "shared", "vocab.json")
FURI_P = os.path.join(ROOT, "app", "src", "data", "dict", "sentenceFuri.json")
BACKUP = os.path.join(ROOT, "バックアップ", "カタカナ文脈規定_2026-07-17")
Q = "〔　〕に入る言葉は？"

# word: (prompt, choices=誤答3個, furi付きprompt)
# ★promptの〔　〕は全角スペース1個。既存データに合わせる。
NEW = {
    # --- N5(ひらがな中心・漢字にはふりがな) ---
    "サッカー": ("ボールを あしで けって、ゴールに 入れる スポーツは〔　〕です。",
                ["すいえい", "スキー", "つり"],
                "ボールを あしで けって、ゴールに 入（い）れる スポーツは〔　〕です。"),
    "バナナ": ("きいろくて、かわを むいて たべる くだものは〔　〕です。",
              ["パン", "たまご", "やさい"], None),
    "レモン": ("こうちゃに〔　〕を 入れると、すっぱく なります。",
              ["さとう", "しお", "こおり"], "こうちゃに〔　〕を 入（い）れると、すっぱく なります。"),
    "チョコ": ("バレンタインに、すきな 人に〔　〕を あげました。",
              ["くつ", "かさ", "ノート"], "バレンタインに、すきな 人（ひと）に〔　〕を あげました。"),
    "ラーメン": ("はしで めんを たべる りょうりは〔　〕です。",
                ["サラダ", "ジュース", "パン"], None),
    # --- N4 ---
    "コーラ": ("くろい いろの、あまくて つめたい のみものは〔　〕です。",
              ["ぎゅうにゅう", "おちゃ", "みず"], None),
    "ソファ": ("リビングに おく、ゆったり すわれる ながい いすを〔　〕と いいます。",
              ["つくえ", "ベッド", "たな"], None),
    "オレンジ": ("あさ、〔　〕を しぼって ジュースを 作ります。",
                ["パン", "たまご", "にく"], "あさ、〔　〕を しぼって ジュースを 作（つく）ります。"),
    "メニュー": ("レストランで〔　〕を 見て、りょうりを えらびました。",
                ["きっぷ", "ちず", "しんぶん"], "レストランで〔　〕を 見（み）て、りょうりを えらびました。"),
    "モデル": ("ざっしの しゃしんで ふくを 見せる しごとの 人を〔　〕と いいます。",
              ["いしゃ", "きょうし", "てんいん"], "ざっしの しゃしんで ふくを 見（み）せる しごとの 人（ひと）を〔　〕と いいます。"),
    # --- N3(漢字を使う。ふりがな必須) ---
    "レッスン": ("毎週 日よう日に、ピアノの〔　〕を 受けて います。",
                ["しあい", "かいぎ", "りょこう"],
                "毎週（まいしゅう） 日（にち）よう日（び）に、ピアノの〔　〕を 受（う）けて います。"),
    "ミシン": ("〔　〕を 使って、ぬのを ぬいます。",
              ["パソコン", "カメラ", "れいぞうこ"], "〔　〕を 使（つか）って、ぬのを ぬいます。"),
    "ヒーター": ("部屋が 寒いので、〔　〕を つけて あたためました。",
                ["れいぼう", "そうじき", "せんたくき"],
                "部屋（へや）が 寒（さむ）いので、〔　〕を つけて あたためました。"),
    "マフラー": ("寒い 日は、首に〔　〕を まいて 出かけます。",
                ["くつした", "てぶくろ", "ぼうし"],
                "寒（さむ）い 日（ひ）は、首（くび）に〔　〕を まいて 出（で）かけます。"),
    "ハンガー": ("せんたくした シャツを〔　〕に かけて ほします。",
                ["かばん", "つくえ", "コップ"], None),
    "メロン": ("あみめの もようが ある、あまくて 高い くだものは〔　〕です。",
              ["りんご", "みかん", "バナナ"],
              "あみめの もようが ある、あまくて 高（たか）い くだものは〔　〕です。"),
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true")
    a = ap.parse_args()

    vocab = json.load(io.open(VOCAB_P, encoding="utf-8"))
    by_word = {v["word"]: v for v in vocab}
    furi = json.load(io.open(FURI_P, encoding="utf-8"))

    if not a.dry:
        os.makedirs(BACKUP, exist_ok=True)
        for lv in ("N5", "N4", "N3"):
            shutil.copy2(os.path.join(C, f"context_{lv}.json"), os.path.join(BACKUP, f"context_{lv}.json"))
        shutil.copy2(FURI_P, os.path.join(BACKUP, "sentenceFuri.json"))
        print(f"バックアップ: {BACKUP}\n")

    add = {}
    for w, (prompt, ch, fp) in NEW.items():
        v = by_word.get(w)
        assert v, f"{w}: 語彙が無い"
        assert "〔　〕" in prompt, f"{w}: 空欄〔　〕が無い"
        assert len(ch) == 3 and len(set(ch)) == 3, f"{w}: 誤答が3個でない"
        assert w not in ch, f"{w}: 正解が誤答に混入"
        if fp:
            assert re.sub(r"[（(][^）)]*[）)]", "", fp) == prompt, f"{w}: ふりがな版と本文が不一致"
        else:
            assert not re.search(r"[㐀-鿿]", prompt), f"{w}: 漢字があるのにふりがな版が無い"
        add.setdefault(v["level"], []).append({
            "id": f"cx:{v['id']}", "i18n": {}, "prompt": prompt, "question": Q,
            "answer": w, "choices": ch, "_furi": fp, "_vid": v["id"],
        })

    for lv in ("N5", "N4", "N3"):
        rows = add.get(lv, [])
        if not rows:
            continue
        p = os.path.join(C, f"context_{lv}.json")
        d = json.load(io.open(p, encoding="utf-8"))
        have = {x["id"] for x in d["items"]}
        for r in rows:
            assert r["id"] not in have, f"{r['id']}: 既に存在する"
            if r.pop("_furi"):
                pass
            r.pop("_vid")
        before = len(d["items"])
        # ふりがなは別ファイル
        for w, (prompt, ch, fp) in NEW.items():
            v = by_word[w]
            if v["level"] != lv or not fp:
                continue
            furi[f"cx:{v['id']}"] = fp
        d["items"] += rows
        print(f"  context_{lv}.json: {before} → {len(d['items'])}問  (+{len(rows)})")
        for r in rows:
            print(f"     {r['id']:14} ★{r['answer']:7} {r['prompt']}")
            print(f"     {'':14}  誤答: {' / '.join(r['choices'])}")
        if not a.dry:
            with io.open(p, "w", encoding="utf-8", newline="\n") as f:
                json.dump(d, f, ensure_ascii=False, indent=1)
                f.write("\n")

    if not a.dry:
        with io.open(FURI_P, "w", encoding="utf-8", newline="\n") as f:
            json.dump(furi, f, ensure_ascii=False, indent=1)
            f.write("\n")
    nf = sum(1 for w, (p_, c_, fp) in NEW.items() if fp)
    print(f"\n計 {len(NEW)}問を追加 / ふりがな {nf}件を sentenceFuri.json へ")
    if a.dry:
        print("--dry のため書き込みなし")


if __name__ == "__main__":
    main()
