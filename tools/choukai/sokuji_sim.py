# -*- coding: utf-8 -*-
"""即時応答(sokuji)の近似重複ディテクタ＝層2。
場面を廃した後、「言葉違いの実質コピー」を機械で弾くための表面類似度。

方式（依存ライブラリ無し）：
- norm: ふりがな（…）と記号・空白を除去した素の本文。
- 文字bigram Jaccard: 2文字ずつの集合の重なり率（語順に頑健・日本語に有効）。
- 漢字熟語(2連漢字) Jaccard: 内容語の近似（名詞・動詞の核）。
- sim(a,b) = max(文字bigram, 0.9*漢字熟語)  ※漢字は少し割引（短文で過敏になりやすい）
近い値ほど「似すぎ」。しきい値は calibrate() で現行データを見て決める。
"""
import re

FURI = re.compile(r'（[^）]*）')
NONWORD = re.compile(r'[\s、。！？…「」『』（）()\.,!?~ー－・:：;；]')

def norm(s: str) -> str:
    s = FURI.sub('', s or '')
    return NONWORD.sub('', s)

def _bigrams(s: str):
    return {s[i:i+2] for i in range(len(s) - 1)} if len(s) >= 2 else ({s} if s else set())

def _kanji_bigrams(s: str):
    out = set()
    run = ''
    for ch in s:
        if '一' <= ch <= '鿿':
            run += ch
        else:
            for i in range(len(run) - 1):
                out.add(run[i:i+2])
            run = ''
    for i in range(len(run) - 1):
        out.add(run[i:i+2])
    return out

def _jac(a, b):
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)

def sim(a: str, b: str) -> float:
    na, nb = norm(a), norm(b)
    cj = _jac(_bigrams(na), _bigrams(nb))            # 主信号＝文字bigram（語順に頑健）
    ka, kb = _kanji_bigrams(na), _kanji_bigrams(nb)
    # 漢字熟語の一致は「共有が3個以上」の時だけ効かせる（1語だけ共有＝誤検出を防ぐ）
    kj = _jac(ka, kb) if len(ka & kb) >= 3 else 0.0
    return max(cj, 0.9 * kj)

def max_sim(script: str, corpus) -> float:
    """script に最も似た corpus 要素との類似度（0..1）。"""
    m = 0.0
    for other in corpus:
        v = sim(script, other)
        if v > m:
            m = v
    return m

def nearest(script: str, corpus):
    """(最大類似度, 最も似た文) を返す。"""
    best, bs = 0.0, None
    for other in corpus:
        v = sim(script, other)
        if v > best:
            best, bs = v, other
    return best, bs
