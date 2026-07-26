# -*- coding: utf-8 -*-
"""聴解の正本JSON(content/problems/choukai/*.json)から大問別バッチを切り出す。
用途: (a)新規作成の参照/重複回避 (b)意味監査(judge)の入力 (c)既存の再点検。

使い方:
  python tools/choukai/build_batches.py --scope existing --out <DIR>   # 既存(連番<=10)
  python tools/choukai/build_batches.py --scope new      --out <DIR>   # 新規(連番>=11)
  python tools/choukai/build_batches.py --scope all      --out <DIR>
出力: <DIR>/batch_{kadai,point,gaiyou,hatsuwa,sokuji}.json
各レコード: id, level, daimon, daimon_jp, audioChoices, script, question, choices, correct_text, distractors, explain
"""
import json, os, re, glob, argparse
DLBL = {'kadai':'課題理解','point':'ポイント理解','gaiyou':'概要理解','hatsuwa':'発話表現','sokuji':'即時応答'}
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
CDIR = os.path.join(REPO, 'content', 'problems', 'choukai')

def num_of(item_id):
    return int(item_id.split('-')[-1])

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--scope', choices=['all','existing','new'], default='all')
    ap.add_argument('--threshold', type=int, default=11, help='new = 連番>=threshold')
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    byd = {}
    for f in glob.glob(os.path.join(CDIR, '*.json')):
        cat = re.match(r'([a-z]+)_', os.path.basename(f)).group(1)
        for it in json.load(open(f, encoding='utf-8'))['items']:
            n = num_of(it['id'])
            if a.scope == 'existing' and n >= a.threshold: continue
            if a.scope == 'new' and n < a.threshold: continue
            q = (it.get('questions') or [{}])[0]
            ch = q.get('choices') or []; ai = q.get('answerIndex', 0)
            byd.setdefault(cat, []).append({
                'id': it['id'], 'level': it['level'], 'daimon': cat, 'daimon_jp': DLBL[cat],
                'audioChoices': bool(it.get('audioChoices')), 'script': it.get('script') or '',
                'question': q.get('q') or '', 'choices': ch,
                'correct_text': ch[ai] if ai < len(ch) else '',
                'distractors': [c for i, c in enumerate(ch) if i != ai], 'explain': q.get('explain') or ''})
    for cat, recs in byd.items():
        json.dump(recs, open(os.path.join(a.out, f'batch_{cat}.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print(f'{cat}: {len(recs)} -> {a.out}/batch_{cat}.json')

if __name__ == '__main__':
    main()
