# 語彙の短い例文を無料コーパス(田中コーパス / EDRDG examples.utf.gz・CC-BY)から付与。
#   ①見出し語(B行・漢字形)で索引 ②読み(かな)索引=異体字対策(曲る→まがる→曲がる文)
#   ③短文(A行)の部分一致フォールバック。複数形「いい; よい」や括弧注記「(ございます)」も分割試行。
#   出力: app/src/data/vocabExamples.json  { "<vocabId>": { "ja": "...", "en": "..." } }
#   実行: python data-build/gen_vocab_examples.py
import os, re, json, gzip, urllib.request

URL = "http://ftp.edrdg.org/pub/Nihongo/examples.utf.gz"
ROOT = os.path.dirname(os.path.abspath(__file__))
VOCAB = os.path.join(ROOT, "..", "app", "src", "data", "vocab.json")
DICTEXT = os.path.join(ROOT, "..", "app", "src", "data", "dictExt.json")
JMDICT = os.path.join(ROOT, "dict", "JMdict_e.gz")
OUT = os.path.join(ROOT, "..", "app", "src", "data", "vocabExamples.json")
OUT_EXT = os.path.join(ROOT, "..", "app", "src", "data", "vocabExtExamples.json")
TMP = os.path.join(ROOT, "_examples.utf")
HEAD_MIN, HEAD_MAX = 6, 38
SUB_MIN, SUB_MAX = 5, 50


def download():
    if os.path.exists(TMP) and os.path.getsize(TMP) > 1_000_000:
        print("cache hit:", TMP)
        return
    print("downloading", URL)
    req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0 safa-jlpt-build"})
    raw = gzip.decompress(urllib.request.urlopen(req, timeout=180).read())
    with open(TMP, "wb") as f:
        f.write(raw)
    print("downloaded bytes:", len(raw))


def build_index():
    idx, ridx, sents = {}, {}, []
    ja = en = None
    tokre = re.compile(r"([^(（\[{~]+)(?:[(（]([^)）]+)[)）])?")
    for line in open(TMP, encoding="utf-8", errors="ignore"):
        if line.startswith("A: "):
            rest = line[3:].rstrip("\n").split("\t")
            ja = rest[0].strip()
            en = rest[1].split("#")[0].strip() if len(rest) > 1 else ""
            if SUB_MIN <= len(ja) <= SUB_MAX:
                sents.append((ja, en))
        elif line.startswith("B: ") and ja is not None:
            for tok in line[3:].split():
                m = tokre.match(tok)
                if not m:
                    continue
                head, reading = m.group(1), m.group(2)
                if head:
                    idx.setdefault(head, []).append((ja, en))
                if reading:
                    ridx.setdefault(reading, []).append((ja, en))
            ja = en = None
    return idx, ridx, sents


def parse_jmdict():
    """JMdict から 読み→その語の全表記(漢字異体＋仮名) のマップを作る。
    例: まがる → {曲がる, 曲る, まがる}。異体表記の語(曲る)を、コーパスにある常用形(曲がる)で引くため。"""
    if not os.path.exists(JMDICT):
        print("JMdict無し→異体表記展開スキップ:", JMDICT)
        return {}
    raw = gzip.decompress(open(JMDICT, "rb").read()).decode("utf-8", "ignore")
    altmap = {}
    for ent in raw.split("<entry>")[1:]:
        kebs = re.findall(r"<keb>([^<]+)</keb>", ent)
        rebs = re.findall(r"<reb>([^<]+)</reb>", ent)
        forms = kebs + rebs
        for r in rebs:
            s = altmap.setdefault(r, set())
            s.update(forms)
    print(f"JMdict 異体表記マップ: 読み {len(altmap)} 種")
    return altmap


def variants(s):
    """『いい; よい』『ありがとう (ございます)』『～(を) きまる』等を各形に分割。括弧注記除去＋空白/区切り分割。"""
    s = re.sub(r"[(（][^)）]*[)）]", " ", s or "")
    out = []
    for part in re.split(r"[;；/／、\s]+", s):
        t = part.strip().replace("～", "").replace("~", "")
        if t and t not in out:
            out.append(t)
    return out


def pick(cands, key):
    good = [c for c in cands if HEAD_MIN <= len(c[0]) <= HEAD_MAX and key in c[0]]
    pool = good or [c for c in cands if HEAD_MIN <= len(c[0]) <= HEAD_MAX] or cands
    return min(pool, key=lambda c: len(c[0]))


def build_for(vocab, idx, ridx, sents, label, altmap=None):
    altmap = altmap or {}
    out = {}
    n_head = n_read = n_alt = n_sub = 0
    missing = []
    for v in vocab:
        wforms = variants(v.get("word"))
        rforms = variants(v.get("reading"))
        forms = wforms + [r for r in rforms if r not in wforms]
        if not forms:
            continue
        chosen = None
        for f in forms:                         # ① 見出し語一致(漢字/かな見出し)
            if f in idx:
                chosen = pick(idx[f], f); n_head += 1; break
        if not chosen:                          # ② 読み索引(異体字: 曲る→まがる→曲がる文)
            for rf in rforms:
                if rf in ridx:
                    chosen = pick(ridx[rf], rf); n_read += 1; break
        if not chosen:                          # ②.5 JMdict異体表記: 同じ読みの常用形をコーパスで引く(曲る→曲がる/打合せ→打ち合わせ)
            alts = set()
            for rf in rforms:
                alts.update(altmap.get(rf, ()))
            alts -= set(forms)
            for a in sorted(alts, key=len):
                if a in idx:
                    chosen = pick(idx[a], a); n_alt += 1; break
        if not chosen:                          # ③ 部分一致(最短)
            for f in forms:
                hits = [p for p in sents if f in p[0]]
                if hits:
                    chosen = min(hits, key=lambda p: len(p[0])); n_sub += 1; break
        if chosen:
            out[v["id"]] = {"ja": chosen[0], "en": chosen[1]}
        else:
            missing.append(v.get("word"))
    total = len(vocab)
    print(f"[{label}] vocab {total} / 例文 {len(out)} ({round(100*len(out)/total) if total else 0}%) = 見出し{n_head}+読み{n_read}+異体{n_alt}+部分一致{n_sub}")
    print(f"  例文なし {len(missing)} 語: {missing[:25]}")
    return out


def main():
    download()
    idx, ridx, sents = build_index()
    print(f"索引 見出し {len(idx)} / 読み {len(ridx)} / 検索用文 {len(sents)}")
    altmap = parse_jmdict()
    # LLM補完例文(コーパスに無い語・gen_llm_examples.py 生成)をオーバーレイで隙間埋め(再生成でも保持)。
    llm = {}
    llm_path = os.path.join(os.path.dirname(OUT), "vocabLlmExamples.json")
    if os.path.exists(llm_path):
        llm = json.load(open(llm_path, encoding="utf-8"))
        print(f"LLM補完例文 {len(llm)} 語をオーバーレイ")

    def overlay(out_map, vocab_list):
        n = 0
        for v in vocab_list:
            if v["id"] not in out_map and v["id"] in llm:
                e = llm[v["id"]]
                out_map[v["id"]] = {"ja": e["ja"], "en": e.get("en", "")}
                n += 1
        return n

    # 手動オーバーライド(最優先): コーパス例文がことわざ/慣用句など「平凡でない」語を平易な日常文へ差し替え。
    # 例=血(血は争えない)→指を切って血が出た。再生成でも保持(build_forの後に強制上書き)。
    overrides = {}
    ov_path = os.path.join(os.path.dirname(__file__), "vocabExampleOverrides.json")
    if os.path.exists(ov_path):
        overrides = json.load(open(ov_path, encoding="utf-8"))
        print(f"手動オーバーライド例文 {len(overrides)} 語を最優先適用")

    # ① N5-N3 コア → vocabExamples.json (従来どおり)
    vocab = json.load(open(VOCAB, encoding="utf-8"))
    out = build_for(vocab, idx, ridx, sents, "N5-N3 core", altmap)
    nfill = overlay(out, vocab)
    vids = {v["id"] for v in vocab}
    for k, e in overrides.items():
        if k in vids:
            out[k] = {"ja": e["ja"], "en": e.get("en", "")}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False)
    print(f"出力 {round(os.path.getsize(OUT)/1024)} KB (+LLM{nfill}) -> {OUT}")
    # ② N2/N1 拡張辞書(dictExt.vocab) → vocabExtExamples.json (辞書表示用・無料コーパス)
    if os.path.exists(DICTEXT):
        ext_vocab = json.load(open(DICTEXT, encoding="utf-8")).get("vocab", [])
        ext = build_for(ext_vocab, idx, ridx, sents, "N2/N1 ext", altmap)
        nfille = overlay(ext, ext_vocab)
        with open(OUT_EXT, "w", encoding="utf-8") as f:
            json.dump(ext, f, ensure_ascii=False)
        print(f"出力 {round(os.path.getsize(OUT_EXT)/1024)} KB (+LLM{nfille}) -> {OUT_EXT}")


if __name__ == "__main__":
    main()
