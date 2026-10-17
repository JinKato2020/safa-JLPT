# -*- coding: utf-8 -*-
"""言い換え(synonym) 大問の「正解と誤答の 品詞＋形 一致」チェッカ。
ルール: 正解と全誤答は「品詞＋形(語尾の見た目)」で揃っていること。
        揃っていないと正解だけ浮いてバレる。目標の形＝正解の形。
形式差: N3=語選択(answer/choices が単語)→このチェックがそのまま効く。
        N4/N5=文選択(answer/choices が文)→文中の入替語を抽出して比較する必要(未対応)。
下ふるい用: fugashi の署名で非一様なものを候補として出す(名詞↔ナ形容詞は
        学習者に見分け不能ゆえ BARE に統合)。最終判断はLLM/人。
使い方: python tools/synonym_form_check.py [N3|N4|N5] [--list]
"""
import json, sys, collections, fugashi
_t = fugashi.Tagger()

def sig(w: str) -> str:
    """語の『学習者に見える形(語尾)』署名。粗い下ふるい用（最終判断はLLM/人）。
    設計方針: 自動品詞は当てにならない(答側の mis-tag が偽陽性の主因)ので、
      ・する動詞は「する」の有無でなく実際の活用形で分類(帰宅した=出かけた=Vた)
      ・接尾辞・記号・代名詞は名詞相当=BAREへ統合
      ・た→Vた/だ→NAだ・ます/ございます/あいさつ→POLITE
    2026-09-01改良(旧sigはVする/接尾辞で N3 460問誤検出→改良で277問)。"""
    w = w.strip(); suf = ''
    for s in ('ところ', 'こと'):
        if w.endswith(s) and len(w) > len(s):
            suf = '+' + s; w = w[:-len(s)]; break
    # 丁寧・定型句(語尾で判定・品詞に依存しない)
    if w.endswith(('ます', 'ました', 'ません', 'ましょう', 'ください', 'です', 'ございます')):
        return 'POLITE' + suf
    toks = list(_t(w))
    if not toks:
        return 'EMPTY' + suf
    last = toks[-1]; p = last.feature.pos1; ls = last.surface
    # て形(する動詞含む・語尾優先)
    if w.endswith(('て', 'で')):
        return 'Vて' + suf
    # 過去 た/だ: 直前が名詞/形状詞なら な形+だ、動詞なら過去
    if p == '助動詞' and ls in ('た', 'だ'):
        prev = toks[-2].feature.pos1 if len(toks) >= 2 else ''
        return 'NAだ' + suf if prev in ('名詞', '形状詞') else 'Vた' + suf
    if p == '助動詞' and ls == 'な':
        return 'NAな' + suf      # 〜な 連体形
    if p == '形容詞':
        return 'IADJ' + suf
    if p == '動詞':
        return 'V' + suf         # 辞書/ふつう形(する動詞も同じV)
    if p == '助詞' and ls == 'に':
        return 'ADVに' + suf
    if p == '助詞' and ls == 'と':
        return 'ADVと' + suf
    if p == '副詞':
        return 'ADV' + suf
    if p == '接続詞':
        return 'CONJ' + suf
    if p == '連体詞':
        return 'RENTAI' + suf
    if p in ('名詞', '形状詞', '接尾辞', '接頭辞', '代名詞', '記号', '補助記号'):
        return 'BARE' + suf      # 名詞相当はすべて裸形へ
    if p == '感動詞':
        return 'POLITE' + suf    # あいさつ定型句
    return p + suf

def check(level: str, show_list: bool = False):
    path = f'content/problems/moji_goi/synonym_{level}.json'
    d = json.load(open(path, encoding='utf-8'))
    items = d['items']
    # N4/N5 は文選択形式(answer が文)なので語レベルのこのチェックは無効
    is_sentence = sum(1 for it in items if it['answer'].endswith('。') or len(it['answer']) > 8) > len(items) * 0.5
    bad = []; types = collections.Counter()
    for it in items:
        words = [it['answer']] + list(it['choices'])
        sigs = [sig(w) for w in words]
        if len(set(sigs)) > 1:
            asig = sig(it['answer'])
            types[asig] += 1
            bad.append((it['id'], asig, list(zip(words, sigs))))
    print(f'{level}: {len(items)}問  形式={"文選択(このチェック無効)" if is_sentence else "語選択"}  形不一致候補={len(bad)}問')
    if not is_sentence:
        for k, v in types.most_common():
            print(f'    正解={k}: {v}問')
    if show_list:
        for bid, asig, ws in bad:
            print(bid, asig, '=>', ' '.join(f'{w}:{s}' for w, s in ws))
    return bad

if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    show = '--list' in sys.argv
    levels = args or ['N5', 'N4', 'N3']
    for lv in levels:
        check(lv, show)
