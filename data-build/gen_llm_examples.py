# 例文が無い語(無料コーパスに文が無いN1専門語/挨拶等)に、LLMで短い例文を生成。
#   出力: app/src/data/vocabLlmExamples.json  { "<vocabId>": {"ja","en"} }
#   gen_vocab_examples.py がこれをオーバーレイ(コーパス例の隙間を埋める・コーパス再生成でも保持)。
#   ★コスト管理: サブエージェントを使わず単一プロセスで逐次バッチ。OpenAI gpt-4o。
#   実行: python data-build/gen_llm_examples.py   (環境変数 OPENAI_API_KEY)
import os, re, json, time, urllib.request, urllib.error

KEY = os.environ.get("OPENAI_API_KEY")
URL = "https://api.openai.com/v1/chat/completions"
MODEL = "gpt-4o"
BATCH = 40
MAX_REQ = 12  # 安全弁(暴走防止)

ROOT = os.path.dirname(os.path.abspath(__file__))
D = os.path.join(ROOT, "..", "app", "src", "data")
rd = lambda f: json.load(open(os.path.join(D, f), encoding="utf-8"))

app = rd("vocab.json")
ext = rd("dictExt.json")["vocab"]
aex = rd("vocabExamples.json")
eex = rd("vocabExtExamples.json")
prev = {}
prev_path = os.path.join(D, "vocabLlmExamples.json")
if os.path.exists(prev_path):
    prev = json.load(open(prev_path, encoding="utf-8"))

# 欠け語(既存LLM分は除く)
missing = []
for v in app:
    if v["id"] not in aex and v["id"] not in prev:
        missing.append(v)
for v in ext:
    if v["id"] not in eex and v["id"] not in prev:
        missing.append(v)
print(f"欠け語 {len(missing)} 語 / 既存LLM {len(prev)} 語")
if not KEY:
    raise SystemExit("OPENAI_API_KEY 未設定")
if not missing:
    print("生成対象なし")
    raise SystemExit(0)

SYS = (
    "あなたは日本語教師です。各語について、その語を含む自然で短い例文と英訳を作ります。"
    "条件: ①例文は12〜30字程度で自然。②その語(word)を文中にそのままの形で1回以上含める"
    "(動詞・形容詞は基本形のまま使う)。③JLPTのレベル(level)に合った平易さ。④固有名詞や不自然な文は避ける。"
    '出力はJSONのみ: {"items":[{"id":"..","ja":"..","en":".."}]} で、入力の全idを返す。'
)

def call(items):
    body = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYS},
            {"role": "user", "content": json.dumps(
                [{"id": v["id"], "word": v["word"], "reading": v.get("reading"), "meaning": v.get("meaning"), "level": v["level"]} for v in items],
                ensure_ascii=False)},
        ],
        "temperature": 0.6,
        "response_format": {"type": "json_object"},
    }
    req = urllib.request.Request(URL, data=json.dumps(body).encode("utf-8"),
                                 headers={"Authorization": "Bearer " + KEY, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        d = json.loads(r.read())
    usage = d.get("usage", {})
    content = d["choices"][0]["message"]["content"]
    return json.loads(content).get("items", []), usage

out = dict(prev)
tin = tout = 0
nreq = 0
nok = nbad = 0
for i in range(0, len(missing), BATCH):
    if nreq >= MAX_REQ:
        print(f"⚠ MAX_REQ({MAX_REQ})到達で打ち切り。残り {len(missing)-i} 語は未生成。")
        break
    chunk = missing[i:i + BATCH]
    try:
        items, usage = call(chunk)
    except urllib.error.HTTPError as e:
        print("HTTPError:", e.read().decode()[:200]); break
    nreq += 1
    tin += usage.get("prompt_tokens", 0); tout += usage.get("completion_tokens", 0)
    by_id = {v["id"]: v for v in chunk}
    for it in items:
        vid = it.get("id"); ja = (it.get("ja") or "").strip(); en = (it.get("en") or "").strip()
        if vid not in by_id or not ja:
            continue
        w = by_id[vid]["word"]
        # 検証: 語(または漢字部分)が文に含まれるか
        kanji = "".join(ch for ch in w if "一" <= ch <= "鿿")
        contains = (w in ja) or (kanji and kanji in ja)
        if contains:
            out[vid] = {"ja": ja, "en": en, "llm": True}
            nok += 1
        else:
            nbad += 1
    print(f"  batch {nreq}: {i+len(chunk)}/{len(missing)}  ok累計{nok} 不一致{nbad}")
    time.sleep(0.4)

json.dump(out, open(prev_path, "w", encoding="utf-8"), ensure_ascii=False)
usd = tin / 1e6 * 2.5 + tout / 1e6 * 10
print(f"\n生成 {nok} 語(語不一致で除外 {nbad})。LLM例文 計 {len(out)} 語。")
print(f"トークン: 入力{tin} / 出力{tout}  概算 ${usd:.3f} = JPY {usd*150:.0f}")
print(f"出力 -> {prev_path}")
