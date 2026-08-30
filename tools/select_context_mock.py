# -*- coding: utf-8 -*-
"""文脈規定「模試専用プール」の対象語を機械選定する（0トークン）。

ルール（ユーザー指示 2026-08-30）:
  - 目標 N5:100 / N4:100 / N3:110（公式 10/10/11 × 10回）。1語=1問。
  - 頻出語彙を優先（頻度上位＝vocabFreq昇順。1=最頻）。
  - 「優良」= 文脈規定として良い問題になる多様性。カテゴリ上限で品詞/分野を散らす。
  - 除外: ～/〜/御 接辞・単漢字(接尾語用法)・裸の数字・指標対象外(感動詞等)・あいさつ/感動詞/接続詞カテゴリ。
  - 他大問の模試プール語(kanji_read=274・orthography=200)とは「なるべく重ならない」＝ソフト回避
    （足りなければ重複可。ハード制約は模試組み立て時＝別ルール）。
出力: scratchpad/context_mock/select_{level}.json
"""
import io, json, os, re, glob
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def L(p): return json.load(io.open(os.path.join(ROOT, p), encoding='utf-8'))

freq = L('src/data/dict/vocabFreq.json')          # vid -> rank(1..50, 低いほど頻出)
cat  = L('src/data/dict/vocabCategory.json')      # vid -> semantic category
vocab = {v['id']: v for v in L('src/data/shared/vocab.json')}
mex_raw = L('src/data/shared/vocabMetricExcluded.json')
mex = set(mex_raw if isinstance(mex_raw, list) else mex_raw.keys())

# 他大問の模試プール語（ソフト回避）
avoid = set()
for d in ['kanji_read', 'orthography']:
    for p in glob.glob(os.path.join(ROOT, f'content/problems/moji_goi/mock/{d}_*.json')):
        for it in L(f'content/problems/moji_goi/mock/{os.path.basename(p)}').get('items', []):
            if it.get('vocabId'): avoid.add(it['vocabId'])

TARGET = {'N5': 100, 'N4': 100, 'N3': 110}
CAT_SHARE_CAP = 0.20   # 1カテゴリが目標の20%を超えない（多様化＝優良の担保）
BAD_CAT = {'あいさつ', '感動詞', '接続詞', '指示詞', 'あいづち'}
AFFIX = re.compile(r'[～〜]|^御')
KANA = re.compile(r'^[ぁ-んァ-ヴー]$')
NUM = re.compile(r'^[0-9０-９〇一二三四五六七八九十百千万億]+$')

def eligible(v):
    w = v['word']
    if v['id'] in mex: return '指標除外'
    if AFFIX.search(w): return '接辞'
    if len(w) == 1 and not KANA.match(w): return '単漢字'
    if NUM.match(w): return '数字'
    if cat.get(v['id'], '') in BAD_CAT: return 'あいさつ等'
    return None

summary = {}
os.makedirs(os.path.join(ROOT, 'scratchpad/context_mock'), exist_ok=True)
for lv, target in TARGET.items():
    drop = Counter()
    cands = []
    for v in vocab.values():
        if v['level'] != lv: continue
        why = eligible(v)
        if why: drop[why] += 1; continue
        cands.append(v)
    for v in cands: v['_f'] = freq.get(v['id'], 50)
    cands.sort(key=lambda v: (v['_f'], v['id']))          # 頻出順
    nonavoid = [v for v in cands if v['id'] not in avoid]  # 他大問プールと重ならない語を優先

    # 頻出50% = 最頻ティア／優良50% = 中頻度帯を等間隔で拾い breadth（ユーザー指示 2026-08-30「半分を中頻度語に」）
    half = target // 2
    cap = max(3, int(target * CAT_SHARE_CAP))
    catcnt = Counter()
    picked, have = [], set()
    # 前半 = 最頻ティア（カテゴリ上限で多様化）
    for v in nonavoid:
        if len(picked) >= half: break
        c = cat.get(v['id'], 'other')
        if catcnt[c] >= cap: continue
        picked.append(v); have.add(v['id']); catcnt[c] += 1
    # 後半 = 中頻度帯(rank MID_MIN..MID_MAX)を stride 等間隔サンプルで breadth（最稀 41-50 は除外）
    MID_MIN, MID_MAX = 6, 40
    mid = sorted((v for v in nonavoid if v['id'] not in have and MID_MIN <= v['_f'] <= MID_MAX),
                 key=lambda v: (v['_f'], v['id']))
    need = target - len(picked)
    if mid and need > 0:
        stride = max(1, len(mid) // need)
        for i in range(0, len(mid), stride):
            if len(picked) >= target: break
            v = mid[i]; c = cat.get(v['id'], 'other')
            if v['id'] in have or catcnt[c] >= cap: continue
            picked.append(v); have.add(v['id']); catcnt[c] += 1
    # 不足なら 中頻度→最頻 の順で補充（nonavoid内・カテゴリ上限は解除）
    for v in mid + nonavoid:
        if len(picked) >= target: break
        if v['id'] not in have: picked.append(v); have.add(v['id'])
    used_avoid = 0
    # それでも足りなければ他大問プール語も許可（重複可）
    for v in cands:
        if len(picked) >= target: break
        if v['id'] not in have: picked.append(v); have.add(v['id']); used_avoid += 1
    picked.sort(key=lambda v: (v['_f'], v['id']))  # 出力は頻出順で見やすく

    out = [{'vocabId': v['id'], 'word': v['word'], 'reading': v['reading'],
            'meaning': v['meaning'], 'freq': v['_f'], 'cat': cat.get(v['id'], 'other'),
            'fromAvoid': v['id'] in avoid} for v in picked]
    with io.open(os.path.join(ROOT, f'scratchpad/context_mock/select_{lv}.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    summary[lv] = (len(cands), len(nonavoid), len(picked), used_avoid, drop, Counter(e['cat'] for e in out))

for lv in TARGET:
    nc, na, np_, ua, drop, catc = summary[lv]
    print(f'=== {lv} === eligible {nc}(他大問回避可 {na}) → 選定 {np_} / うち他大問プール重複 {ua}')
    print(f'  除外: {dict(drop)}')
    print(f'  freq帯: ' + ' '.join(f'{lo}-{lo+9}:{sum(1 for e in json.load(io.open(os.path.join(ROOT,f"scratchpad/context_mock/select_{lv}.json"),encoding="utf-8")) if lo<=e["freq"]<lo+10)}' for lo in range(1,51,10)))
    print(f'  カテゴリ上位: {catc.most_common(8)}')
    words = [e['word'] for e in json.load(io.open(os.path.join(ROOT, f'scratchpad/context_mock/select_{lv}.json'), encoding='utf-8'))]
    print(f'  語(先頭20): {words[:20]}')
