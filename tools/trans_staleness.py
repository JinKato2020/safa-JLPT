# -*- coding: utf-8 -*-
"""
翻訳ズレ検知 (en/ne)。日本語(正本)を改定したのに en/ne 訳が古いままの item を洗い出す。

方式:
  A) Git履歴照合 … 各翻訳フィールドが「最後に編集されたコミット時点の日本語ソース」を
     復元し、現在の日本語ソースと比べる。意味が変わっていれば stale。
     ※ ふりがな（かなだけの丸カッコ）は除いて比較する。再ルビだけの差分は stale にしない。
  B) 機械チェック … 選択肢/本文の個数不一致・数字の出入りなど、意味を読まずに拾えるズレ。

出力:
  - 会話には数行サマリだけ。
  - 明細は tools/out/trans_staleness.csv (id, level, daimon, unit, lang, method, reason)
  - レビュー対訳は tools/out/trans_stale_review.txt (現在の日本語 vs 古い訳)
  - 恒久対策②の種は src/data/exam/transSrcHash.json (番人 transStaleness.test.ts が読む)
    baseline=現在の正規化日本語hash / knownStale=既知の古い訳unit。

usage: python tools/trans_staleness.py
"""
import json, os, re, subprocess, sys, io, glob, hashlib, collections

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "tools", "out")
os.makedirs(OUT, exist_ok=True)

# かなだけの丸カッコ = ふりがな。除去して意味比較する。
_KANA = r"぀-ゟ゠-ヿー"
_RUBY = re.compile(r"[（(]\s*[" + _KANA + r"]+\s*[）)]")
SEP = "\n"  # 配列(本文段落・選択肢)を連結する区切り。TS番人と一致させること。

def _canon_num(s):
    """数字の表記ゆれを吸収: 全角→半角, 3桁カンマ除去, 「3千/6万」等を実数へ。
    これで「3,000円」と「3千円」を同一視し、書き方だけの改定を stale 扱いしない。"""
    s = s.translate(str.maketrans("０１２３４５６７８９", "0123456789"))
    s = re.sub(r"(?<=\d),(?=\d{3}(?!\d))", "", s)
    unit = {"千": 1000, "万": 10000, "億": 100000000}
    s = re.sub(r"(\d+)([千万億])", lambda m: str(int(m.group(1)) * unit[m.group(2)]), s)
    return s

def norm(s):
    """日本語ソースの正規化: ふりがな除去 + 空白畳み。意味差だけを残す。"""
    if s is None:
        return ""
    if isinstance(s, list):
        s = SEP.join("" if x is None else str(x) for x in s)
    s = str(s)
    s = _RUBY.sub("", s)
    s = _canon_num(s)
    s = re.sub(r"\s+", "", s)
    return s

def h(s):
    return hashlib.sha1(s.encode("utf-8")).hexdigest()[:12]

def digits(s):
    # 全角→半角そろえて数字列を集合で
    if isinstance(s, list):
        s = " ".join("" if x is None else str(x) for x in s)
    s = (s or "").translate(str.maketrans("０１２３４５６７８９", "0123456789"))
    return set(re.findall(r"\d+", s))

def item_source(it):
    """item.body 訳(en/ne.body)の日本語ソース。聴解(課題理解)は本文が script なので body 無ければ script。"""
    return it.get("body") if it.get("body") is not None else it.get("script")

def explain_source(it):
    """i18n.*.explain 訳の日本語ソース = i18n.ja.explain（無ければ stem/answer/choices）。"""
    ja = (it.get("i18n") or {}).get("ja") or {}
    if ja.get("explain"):
        return ja["explain"]
    fb = [it.get("stem") or "", it.get("question") or "", it.get("answer") or ""]
    fb += it.get("choices") or []
    return SEP.join(str(x) for x in fb)

def units_for_item(it):
    """1 item から (unit_key, ja_source, {lang: trans_text}) を列挙する。"""
    i18n = it.get("i18n") or {}
    out = []
    # item.body 訳
    if any((i18n.get(l) or {}).get("body") is not None for l in ("en", "ne")):
        tr = {l: (i18n.get(l) or {}).get("body") for l in ("en", "ne")
              if (i18n.get(l) or {}).get("body") is not None}
        out.append(("body", item_source(it), tr))
    # item.explain 訳
    if any((i18n.get(l) or {}).get("explain") is not None for l in ("en", "ne")):
        tr = {l: (i18n.get(l) or {}).get("explain") for l in ("en", "ne")
              if (i18n.get(l) or {}).get("explain") is not None}
        out.append(("explain", explain_source(it), tr))
    # question 単位
    for q in it.get("questions") or []:
        qi = q.get("i18n") or {}
        if any((qi.get(l) or {}).get("q") is not None for l in ("en", "ne")):
            tr = {l: (qi.get(l) or {}).get("q") for l in ("en", "ne")
                  if (qi.get(l) or {}).get("q") is not None}
            out.append(("q:%s:q" % q.get("id"), q.get("question"), tr))
        if any((qi.get(l) or {}).get("choices") is not None for l in ("en", "ne")):
            tr = {l: (qi.get(l) or {}).get("choices") for l in ("en", "ne")
                  if (qi.get(l) or {}).get("choices") is not None}
            out.append(("q:%s:choices" % q.get("id"), q.get("choices"), tr))
    return out

def load_blob(commit, relpath):
    try:
        raw = subprocess.run(["git", "show", "%s:%s" % (commit, relpath)],
                             cwd=ROOT, capture_output=True)
        if raw.returncode != 0:
            return None
        return json.loads(raw.stdout.decode("utf-8"))
    except Exception:
        return None

def commits_for(relpath):
    r = subprocess.run(["git", "log", "--reverse", "--format=%H", "--", relpath],
                       cwd=ROOT, capture_output=True, text=True)
    return [c for c in r.stdout.split() if c]

def index_units(doc):
    """doc(1ファイルJSON) -> {(item_id, unit_key): (src_norm_hash, {lang: trans_hash})}"""
    idx = {}
    for it in doc.get("items", []):
        iid = it.get("id")
        for uk, src, tr in units_for_item(it):
            th = {l: h(norm(v)) for l, v in tr.items()}
            idx[(iid, uk)] = (h(norm(src)), th)
    return idx

def main():
    files = sorted(glob.glob(os.path.join(ROOT, "content/problems/**/*.json"), recursive=True))
    rows = []            # 明細行
    baseline = {}        # 恒久対策②の種: {relpath: {"item|unit|lang": src_norm_hash_at_last_trans}}
    summ = collections.Counter()
    per_daimon = collections.Counter()

    for f in files:
        rel = os.path.relpath(f, ROOT).replace("\\", "/")
        cur = json.load(open(f, encoding="utf-8"))
        cur_idx = index_units(cur)
        # 翻訳を1つも持たないファイルはskip
        if not any(th for (_s, th) in cur_idx.values()):
            continue
        daimon = rel.split("problems/")[1].rsplit("/", 1)[0]

        commits = commits_for(rel)
        # 各 (item,unit,lang) について「訳が最後に変わった時点の src_norm_hash」を追跡
        last_trans_hash = {}   # key -> 直近の訳hash
        src_at_last = {}       # key -> その時点の src_norm_hash
        # コミット履歴 → さらに作業ツリー(cur_idx)を「最新状態」として最後に取り込む。
        # これで未コミットの訳修正も反映され、「訳を直した=もう stale でない」を正しく判定できる。
        blobs = [d for d in (load_blob(c, rel) for c in commits) if d is not None]
        for idx in [index_units(d) for d in blobs] + [cur_idx]:
            for (iid, uk), (srch, th) in idx.items():
                for lang, thash in th.items():
                    key = (iid, uk, lang)
                    if last_trans_hash.get(key) != thash:
                        last_trans_hash[key] = thash
                        src_at_last[key] = srch  # この訳が書かれた時の日本語

        base_file = {}
        # 現在と比較
        for (iid, uk), (cur_src, cur_th) in cur_idx.items():
            for lang, cur_thash in cur_th.items():
                key = (iid, uk, lang)
                seed = src_at_last.get(key)
                # baseline には「現在の日本語hash」を入れる(番人が現在と突き合わせる基準)。
                # 古い訳(stale)の unit だけは後で番兵値 STALE に置換し、常に不一致=既知の借金にする。
                base_file["%s|%s|%s" % (iid, uk, lang)] = cur_src
                if seed is not None and seed != cur_src:
                    rows.append([iid, cur.get("level", ""), daimon, uk, lang, "git",
                                 "日本語ソースが訳の後に改定された"])
                    summ["git_%s" % lang] += 1
                    per_daimon["%s/%s" % (daimon, lang)] += 1
        if base_file:
            baseline[rel] = base_file

        # --- 方式B: 機械チェック(現在ファイルのみ) ---
        for it in cur.get("items", []):
            iid = it.get("id")
            i18n = it.get("i18n") or {}
            # body 個数
            jb = it.get("body")
            if isinstance(jb, list):
                for lang in ("en", "ne"):
                    tb = (i18n.get(lang) or {}).get("body")
                    if isinstance(tb, list) and len(tb) != len(jb):
                        rows.append([iid, it.get("level", ""), daimon, "body", lang, "B-count",
                                     "本文 段落数 %d != 訳 %d" % (len(jb), len(tb))])
                        summ["B_%s" % lang] += 1
            for q in it.get("questions") or []:
                jc = q.get("choices")
                qi = q.get("i18n") or {}
                if isinstance(jc, list):
                    for lang in ("en", "ne"):
                        tc = (qi.get(lang) or {}).get("choices")
                        if isinstance(tc, list) and len(tc) != len(jc):
                            rows.append([q.get("id"), it.get("level", ""), daimon,
                                         "q:choices", lang, "B-count",
                                         "選択肢 %d != 訳 %d" % (len(jc), len(tc))])
                            summ["B_%s" % lang] += 1
                # 数字の出入り(設問文)
                jq = q.get("question")
                for lang in ("en", "ne"):
                    tq = (qi.get(lang) or {}).get("q")
                    if jq and tq:
                        dj, dt = digits(jq), digits(tq)
                        if dj and dj != dt:
                            rows.append([q.get("id"), it.get("level", ""), daimon,
                                         "q:q", lang, "B-digit",
                                         "数字 日本%s 訳%s" % (sorted(dj), sorted(dt))])
                            summ["Bd_%s" % lang] += 1

    # 書き出し
    csvp = os.path.join(OUT, "trans_staleness.csv")
    with open(csvp, "w", encoding="utf-8", newline="") as fo:
        fo.write("id,level,daimon,unit,lang,method,reason\n")
        for r in rows:
            fo.write(",".join('"%s"' % str(x).replace('"', "'") for x in r) + "\n")

    # --- 恒久対策②: 番人が読むベースライン ---
    # baseline[unitKey] = その訳が書かれた時点の 正規化日本語hash。
    #   unitKey = "itemid|unit|lang"。stale = 現在の日本語hash != baseline。
    # knownStale = 現時点で stale な unitKey(=既知の借金)。番人はこれが増えないか見張る。
    flat = {}
    for rel, m in baseline.items():
        for k, v in m.items():
            flat[k] = v
    known_stale = sorted("%s|%s|%s" % (r[0], r[3], r[4])
                         for r in rows if r[5] == "git")
    # --bless: 現在の作業ツリーを「全訳クリーン」として確定(baseline=現在の日本語hash・借金ゼロ)。
    #   再翻訳し終えて中身を確認した後に使う。git検知が拾う偽陽性(訳が旧と同一で更新されない等)も含めて一掃する。
    if "--bless" in sys.argv:
        known_stale = []
    # 古い訳の unit は番兵値に置換(現在の日本語と必ず不一致=既知の借金として番人が把握)。
    for k in known_stale:
        flat[k] = "STALE"
    guardp = os.path.join(ROOT, "src", "data", "exam", "transSrcHash.json")
    with open(guardp, "w", encoding="utf-8") as fo:
        json.dump({"_note": "翻訳ズレ番人の種。tools/trans_staleness.py が生成。"
                            "baseline=訳作成時の正規化日本語hash / knownStale=既知の古い訳。",
                   "baseline": flat, "knownStale": known_stale},
                  fo, ensure_ascii=False, indent=0)

    # --- レビュー用 対訳(現在の日本語 vs 古い訳) ---
    review = os.path.join(OUT, "trans_stale_review.txt")
    stale_keys = set(known_stale)
    with open(review, "w", encoding="utf-8") as fo:
        for f in files:
            rel = os.path.relpath(f, ROOT).replace("\\", "/")
            if not any(k.split("|") for k in stale_keys):
                break
            doc = json.load(open(f, encoding="utf-8"))
            for it in doc.get("items", []):
                for uk, src, tr in units_for_item(it):
                    for lang, tv in tr.items():
                        key = "%s|%s|%s" % (it.get("id"), uk, lang)
                        if key in stale_keys:
                            fo.write("● %s\n" % key)
                            fo.write("  日本語(現在): %s\n" % json.dumps(src, ensure_ascii=False))
                            fo.write("  訳(古い %s): %s\n\n" % (lang, json.dumps(tv, ensure_ascii=False)))

    print("=== 翻訳ズレ検知 サマリ ===")
    print("Git履歴で stale:   en=%d  ne=%d" % (summ["git_en"], summ["git_ne"]))
    print("B 個数不一致:      en=%d  ne=%d" % (summ["B_en"], summ["B_ne"]))
    print("B 数字の出入り:    en=%d  ne=%d" % (summ["Bd_en"], summ["Bd_ne"]))
    print("明細:", csvp)
    print("レビュー対訳:", review)
    print("番人ベースライン:", guardp)
    if per_daimon:
        print("--- Git stale 大問別 ---")
        for k, v in per_daimon.most_common():
            print("  %-28s %d" % (k, v))

if __name__ == "__main__":
    main()
