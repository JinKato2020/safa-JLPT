# -*- coding: utf-8 -*-
"""聴解の台本フォーマットを整える／点検する（2026-08-13 追加）。

音声化(gen_choukai_json.py→split_intro)は「導入行＋空行＋本文」を前提にする。
サブエージェント生成はこの空行/導入を落としがち。これを機械修正/検出する。

- 空行なし（導入直後に空行が無い）→ 最初の話者行(^[男女]…：)の前に空行1つを自動挿入（べき等）。
- 導入なし（1行目がいきなり話者行）→ 自動では直せない（場面文が要る）ので **ID を警告表示**
  （作問エージェントへ差し戻して導入「場所で話者が話しています。設問。」を先頭に足させる）。

使い方: python tools/choukai/fix_blank.py <new_kadai_N5.json> [<...N4.json> ...]
  各ファイル＝簡易レコードの配列（{script,...}）。上書き保存。
"""
import json, sys, os, re
LAB = re.compile(r'^\s*[男女]\d?.*?[：:]')   # 行頭が男/女で始まる話者ラベル行

def fix_one(script):
    """(new_script, changed, no_intro)"""
    lines = script.split('\n')
    first = next((l for l in lines if l.strip()), '')
    no_intro = bool(LAB.match(first.strip()))     # 1行目がいきなり話者行＝導入欠落
    if re.search(r'\n\s*\n', script):             # すでに空行あり
        return script, False, no_intro
    i = next((k for k, l in enumerate(lines) if LAB.match(l.strip())), None)
    if i is None or i == 0:                        # 話者行が無い/先頭＝空行挿入できない
        return script, False, no_intro
    intro = '\n'.join(lines[:i]).rstrip()
    body = '\n'.join(lines[i:]).strip()
    return intro + '\n\n' + body, True, no_intro

def main():
    files = sys.argv[1:]
    if not files:
        print('usage: python fix_blank.py <new_*.json> ...'); return
    total_fixed = 0; warn = []
    for f in files:
        if not os.path.exists(f):
            print('skip(missing):', f); continue
        recs = json.load(open(f, encoding='utf-8'))
        n = 0
        for r in recs:
            s2, ch, no_intro = fix_one(r.get('script', ''))
            if ch: r['script'] = s2; n += 1
            if no_intro: warn.append(r.get('id'))
        json.dump(recs, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print(f'{os.path.basename(f)}: 空行挿入 {n}/{len(recs)}')
        total_fixed += n
    print(f'--- 計 空行挿入 {total_fixed} ---')
    if warn:
        print(f'⚠導入欠落(自動修正不可・エージェントへ差し戻し) {len(warn)}件: ' + ' '.join(str(w) for w in warn))
    else:
        print('導入欠落: なし')

if __name__ == '__main__':
    main()
