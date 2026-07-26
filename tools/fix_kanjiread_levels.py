# -*- coding: utf-8 -*-
"""漢字読み・表記のファイル級を【語彙の級】に揃え、孤児38問を解消する。

ユーザー確定 2026-07-17:
  ① カタカナ孤児36問のうち【20問は既存問題との重複】なので削除する。
     og:n5-katax-01(じゅーす→ジュース) と og:n3-v-96(じゅーす→ジュース) が二重に存在していた。
     問いは同一で例文が違うだけ。既に出題されている正規id側を残す。
     ※当初「N5でカタカナが1問も出ない」と報告したが誤り。20語は既に出題されていた。
  ② 残り16語(コーラ等・語彙に無い本物の孤児)は語彙を追加して救う。級は私の見立て。
     ※辞書(ja-vocab.json)の級は外来語に対して当てにならないため不採用(実測:
       レッスン=N1 / メニュー=N2 / モデル=N2 / ハンガー=N1、半数は辞書に無し)
  ③ 円(まる) 2問は削除(語彙 n3-v-1005 が欠番)
  ④ 漢字読み・表記のファイルを語彙の級で分け直す

背景(実測):
- アプリは daimonUnitIds で【語彙(VOCAB)の級】を見る。ファイルの級は漢字読み/表記では未使用。
  そのためファイル級と実態が 漢字読み44% / 表記40% でズレていた。
  出題は正しく動くが、級ごとのOTA配信を始めると N5ユーザーに N3の問題が配られ、
  N5の問題が届かなくなる(kanji_read_N5.json 303問のうち N5語彙は151問だけ)。
- 文脈規定・言い換えはズレ0%。壊れているのは漢字読みと表記だけ。
"""
import argparse
import collections
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
BACKUP = os.path.join(ROOT, "バックアップ", "語彙級整理_2026-07-17")
LEVELS = ("N5", "N4", "N3")

# ② 新規16語: (級, 意味, 小テーマ)。
#   級   = 私の見立て(日常頻度と教科書での登場時期)。辞書の級は外来語に使えないため。
#   小テーマ = 既存のカタカナ語に合わせる(ケーキ/ジュース=food・ネクタイ=clothes・タクシー=transport)。
#              vocabCategory.json に登録しないと「全語がちょうど1小テーマに属す」テストが落ちる。
NEW_WORDS = {
    "サッカー": ("N5", "soccer", "hobby"), "バナナ": ("N5", "banana", "food"),
    "レモン": ("N5", "lemon", "food"), "チョコ": ("N5", "chocolate (abbr.)", "food"),
    "ラーメン": ("N5", "ramen", "food"),
    "コーラ": ("N4", "cola", "food"), "ソファ": ("N4", "sofa", "home"),
    "オレンジ": ("N4", "orange", "food"), "メニュー": ("N4", "menu", "food"),
    "モデル": ("N4", "model", "work"),
    "レッスン": ("N3", "lesson", "school"), "ミシン": ("N3", "sewing machine", "home"),
    "ヒーター": ("N3", "heater", "home"), "マフラー": ("N3", "muffler, scarf", "clothes"),
    "ハンガー": ("N3", "hanger", "home"), "メロン": ("N3", "melon", "food"),
}
DROP = {"kr:n3-v-1005", "og:n3-v-1005"}   # ③ 円(まる)。語彙 n3-v-1005 が欠番
VCAT_P = os.path.join(ROOT, "app", "src", "data", "dict", "vocabCategory.json")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true")
    a = ap.parse_args()

    if not a.dry:
        os.makedirs(BACKUP, exist_ok=True)
        for f in [f"{d}_{lv}.json" for d in ("kanji_read", "orthography") for lv in LEVELS]:
            shutil.copy2(os.path.join(C, f), os.path.join(BACKUP, f))
        shutil.copy2(VOCAB_P, os.path.join(BACKUP, "vocab.json"))
        shutil.copy2(VCAT_P, os.path.join(BACKUP, "vocabCategory.json"))
        print(f"バックアップ: {BACKUP}\n")

    vocab = json.load(io.open(VOCAB_P, encoding="utf-8"))
    by_word = {}
    for v in vocab:
        by_word.setdefault(v["word"], []).append(v)
    by_id = {v["id"]: v for v in vocab}

    # --- ② 新規語彙を追加(級ごとに連番の続きを採る) ---
    nxt = {}
    for lv in LEVELS:
        pre = lv.lower()
        ns = [int(m.group(1)) for v in vocab if (m := re.match(rf"^{pre}-v-(\d+)$", v["id"]))
              and v["level"] == lv]
        nxt[lv] = max(ns) + 1
    vcat = json.load(io.open(VCAT_P, encoding="utf-8"))
    cats = set(vcat.values())
    added = {}
    for w, (lv, mean, cat) in NEW_WORDS.items():
        assert w not in by_word, f"{w} は既に語彙にある(追加不要)"
        assert cat in cats, f"{w}: 小テーマ '{cat}' が存在しない"
        vid = f"{lv.lower()}-v-{nxt[lv]}"
        nxt[lv] += 1
        item = {"id": vid, "level": lv, "category": "moji_goi", "type": "vocab",
                "word": w, "reading": w, "meaning": mean, "tags": [f"JLPT_{lv}", "katakana"]}
        vocab.append(item)
        vcat[vid] = cat          # 小テーマに割り当てる(未割当だとテストが落ちる)
        by_word[w] = [item]
        by_id[vid] = item
        added[w] = (vid, lv, cat)
    print(f"② 新規語彙 {len(added)}語を追加:")
    for lv in LEVELS:
        ws = [f"{w}({vid}/{c})" for w, (vid, l, c) in added.items() if l == lv]
        print(f"   {lv}: {', '.join(ws)}")

    # --- ①②③ 問題を集めて、語彙idを解決し、語彙の級で振り直す ---
    stats = collections.Counter()
    for daimon, pre in (("kanji_read", "kr"), ("orthography", "og")):
        rows = []
        for lv in LEVELS:
            d = json.load(io.open(os.path.join(C, f"{daimon}_{lv}.json"), encoding="utf-8"))
            rows += d["items"]
        existing = {x["id"] for x in rows}
        out = collections.defaultdict(list)
        for x in rows:
            if x["id"] in DROP:
                stats[f"{daimon}:③円を削除"] += 1
                continue
            vid = x["id"].split(":")[1]
            v = by_id.get(vid)
            if v is None:
                # 語彙idで解決できない = カタカナ問題(og:n5-katax-NN)。正解の語から引き直す。
                hit = by_word.get(x["answer"])
                assert hit, f"{x['id']}: 語彙が見つからない({x['answer']})"
                v = hit[0]
                newid = f"{pre}:{v['id']}"
                if newid in existing:
                    # ① 同じ語の問題が既に正規idで存在する＝重複。既存を残してこちらを捨てる。
                    stats[f"{daimon}:①重複を削除"] += 1
                    continue
                x["id"] = newid
                stats[f"{daimon}:②孤児を救済"] += 1
            out[v["level"]].append(x)

        for lv in LEVELS:
            p = os.path.join(C, f"{daimon}_{lv}.json")
            d = json.load(io.open(p, encoding="utf-8"))
            before = len(d["items"])
            d["items"] = out[lv]
            # 語彙の級と一致していることを保証してから書く
            for x in d["items"]:
                assert by_id[x["id"].split(":")[1]]["level"] == lv, f"{x['id']}: 級が不一致"
            ids = [x["id"] for x in d["items"]]
            assert len(set(ids)) == len(ids), f"{daimon}_{lv}: idが重複"
            print(f"   {daimon}_{lv}.json: {before} → {len(d['items'])}問")
            if not a.dry:
                with io.open(p, "w", encoding="utf-8", newline="\n") as f:
                    json.dump(d, f, ensure_ascii=False, indent=1)
                    f.write("\n")

    if not a.dry:
        with io.open(VOCAB_P, "w", encoding="utf-8", newline="\n") as f:
            json.dump(vocab, f, ensure_ascii=False, indent=1)
            f.write("\n")
        with io.open(VCAT_P, "w", encoding="utf-8", newline="\n") as f:
            json.dump(vcat, f, ensure_ascii=False, indent=1)
            f.write("\n")
    print(f"\n{dict(stats)}")
    print(f"語彙: {len(vocab) - len(added)} → {len(vocab)}語")
    if a.dry:
        print("--dry のため書き込みなし")
    else:
        print("→ 次: node --import tsx tools/content/rebuild.ts → テスト → 実行時検証")


if __name__ == "__main__":
    main()
