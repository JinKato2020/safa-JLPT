# -*- coding: utf-8 -*-
"""文脈規定の問題文と類似する語彙例文（作り直し対象）を選ぶ（機械処理・0トークン）。

文脈規定 prompt と、同じ vocabId の語彙例文 vocabExamplesAi.ja を、
表面bigram と 読み正規化bigram の max で比較し、THRESH 以上を対象にする。
（既に別文へ差し替え済みの語は sim が下がるので自然に除外される）

出力: scratchpad/{DIR}/target_{LV}.json
  各要素 = {id, vocabId, word(=文脈規定answer), contextPrompt, oldExample, sim}
使い方: python tools/select_vocab_example_targets.py N3 0.3 vocab_swap3
"""
import io, json, os, re, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'data-build'))
from gen_furigana import furigana  # noqa: E402

LV = (sys.argv[1] if len(sys.argv) > 1 else 'N3').upper()
THRESH = float(sys.argv[2]) if len(sys.argv) > 2 else 0.3
DIR = sys.argv[3] if len(sys.argv) > 3 else 'vocab_swap3'


def load(p):
    return json.load(io.open(os.path.join(ROOT, p), encoding='utf-8'))


def norm(s):
    s = re.sub(r'[（(][^）)]*[）)]', '', s)
    return re.sub(r'[　\s【】〔〕\[\]_＿…、。･・,\.！？!?「」『』]+', '', s)


def bg(s):
    return set(s[i:i + 2] for i in range(len(s) - 1))


def sim(a, b):
    A, B = bg(a), bg(b)
    return len(A & B) / len(A | B) if A and B else 0.0


def kana(s):
    f = furigana(s)
    return re.sub(r'([㐀-鿿々]+)（([^）]*)）', r'\2', f)


ex = load('src/data/dict/vocabExamplesAi.json')
sel = []
for x in load(f'content/problems/moji_goi/context_{LV}.json')['items']:
    vid = x.get('vocabId')
    p = x.get('prompt')
    if not p or vid not in ex:
        continue
    ja = ex[vid].get('ja')
    if not ja:
        continue
    s = max(sim(norm(p), norm(ja)), sim(norm(kana(p)), norm(kana(ja))))
    if s >= THRESH:
        sel.append({'id': x['id'], 'vocabId': vid, 'word': x.get('answer', ''),
                    'contextPrompt': p, 'oldExample': ja, 'sim': round(s, 3)})

os.makedirs(os.path.join(ROOT, 'scratchpad', DIR), exist_ok=True)
out = os.path.join(ROOT, 'scratchpad', DIR, f'target_{LV}.json')
with io.open(out, 'w', encoding='utf-8', newline='\n') as f:
    json.dump(sel, f, ensure_ascii=False, indent=1)
print(f'{LV}: 類似>={THRESH} の作り直し対象 = {len(sel)}語 → {out}')
