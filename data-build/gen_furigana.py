# 語彙例文(vocabExamples.json)にふりがなを付与。MeCab(fugashi+unidic-lite)で語ごとに読みを取り、
# 漢字部だけを 漢字(よみ) 形式に整形(送り仮名は括弧外)。出力: app/src/data/vocabFurigana.json {id: ふりがな文}
# 使い方: python gen_furigana.py test   (サンプル検証)  /  python gen_furigana.py  (全件生成)
import json
import os
import sys
import fugashi

ROOT = os.path.dirname(os.path.abspath(__file__))
VJSON = os.path.join(ROOT, "..", "app", "src", "data", "vocabExamples.json")
OUT = os.path.join(ROOT, "..", "app", "src", "data", "vocabFurigana.json")

tagger = fugashi.Tagger()


def kata2hira(s: str) -> str:
    return "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in s)


def has_kanji(s: str) -> bool:
    return any(("㐀" <= c <= "鿿") or ("豈" <= c <= "﫿") for c in s)


def is_kana(c: str) -> bool:
    return ("ぁ" <= c <= "ゟ") or ("ァ" <= c <= "ヿ")


def annotate(surface: str, reading: str) -> str:
    """surface(表記) と reading(ひらがな読み) から 漢字(よみ) 形式。送り仮名は括弧外。"""
    if not has_kanji(surface) or not reading:
        return surface
    # 末尾の共通かな(送り仮名)を外す
    suf = 0
    while (suf < len(surface) and suf < len(reading)
           and surface[-1 - suf] == reading[-1 - suf] and is_kana(surface[-1 - suf])):
        suf += 1
    # 先頭の共通かな(接頭)を外す
    pre = 0
    while (pre < len(surface) - suf and pre < len(reading) - suf
           and surface[pre] == reading[pre] and is_kana(surface[pre])):
        pre += 1
    core_s = surface[pre:len(surface) - suf]
    core_r = reading[pre:len(reading) - suf]
    if not has_kanji(core_s) or not core_r:
        return surface
    tail = surface[len(surface) - suf:] if suf else ""
    return f"{surface[:pre]}{core_s}（{core_r}）{tail}"


def furigana(text: str) -> str:
    out = []
    for w in tagger(text):
        surface = w.surface
        if not has_kanji(surface):
            out.append(surface)
            continue
        kana = getattr(w.feature, "kana", None) or ""
        reading = kata2hira(kana) if kana and kana != "*" else ""
        out.append(annotate(surface, reading))
    return "".join(out)


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "test":
        samples = [
            "彼はああやれば良かったのに。", "よく彼に会う。", "信号は青だ。",
            "顔が赤いよ。", "毎日学校に行きます。", "今日は雨が降っています。",
            "写真を撮ってはいけない。", "新しい車を買いました。",
        ]
        for s in samples:
            print(s, "→", furigana(s))
        return
    data = json.load(open(VJSON, encoding="utf-8"))
    out = {}
    for vid, ex in data.items():
        ja = (ex or {}).get("ja") or ""
        if ja and has_kanji(ja):
            out[vid] = furigana(ja)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False)
    print(f"wrote {len(out)} furigana entries -> {os.path.abspath(OUT)}")


if __name__ == "__main__":
    main()
