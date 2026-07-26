# 読解/聴解の全設問を「正答=選択肢1(index0)」に正規化(再実行安全)。表示はアプリ側でシャッフル。
import json, os
ROOT = os.path.dirname(os.path.abspath(__file__))
for name in ["reading.json", "listening.json"]:
    path = os.path.join(ROOT, "..", "app", "src", "data", name)
    data = json.load(open(path, encoding="utf-8"))
    changed = 0
    for c in data:
        for q in c["questions"]:
            ai = q.get("answerIndex", 0)
            if ai != 0:
                correct = q["choices"][ai]
                rest = [ch for i, ch in enumerate(q["choices"]) if i != ai]
                q["choices"] = [correct] + rest
                q["answerIndex"] = 0
                changed += 1
    json.dump(data, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"{name}: 正規化 {changed}問 (正答を先頭へ)")
