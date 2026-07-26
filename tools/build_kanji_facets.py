# -*- coding: utf-8 -*-
"""漢字カード612字の「面判定」データを決定論生成 → app/src/data/kanjiFacets.json。
   meaningClear = 意味面を出す字か(明快な意味を持つ)。判定:
     hasKun(訓読みあり) OR hasStandaloneWord(その単字がvocabに語として存在) なら明快。
     → 校(コウ・訓なし・単独語なし)=bound=意味面なし。百/肉/茶(音のみでも単独語あり)=明快。
   bound = not meaningClear（聞き取りは音読み読み上げ=案b で全字出す）。
"""
import os, json
ROOT = r'C:\Users\jwpsa\Documents\desktop\claude\JLPTアプリ'
D = os.path.join(ROOT, 'app', 'src', 'data')
K = json.load(open(os.path.join(D, 'kanjiCards.json'), encoding='utf-8'))
V = json.load(open(os.path.join(D, 'vocab.json'), encoding='utf-8'))

standalone = set(v['word'] for v in V if len(v.get('word', '')) == 1)

out = {}
nc_clear = nc_bound = nc_kun = nc_word = 0
for ch, card in K.items():
    has_kun = any(r.get('type') == 'kun' for r in card.get('readings', []))
    has_word = ch in standalone
    clear = has_kun or has_word
    out[ch] = {'meaningClear': clear, 'hasKun': has_kun, 'hasStandaloneWord': has_word}
    nc_clear += clear; nc_bound += (not clear); nc_kun += has_kun; nc_word += has_word

json.dump(out, open(os.path.join(D, 'kanjiFacets.json'), 'w', encoding='utf-8'), ensure_ascii=False, sort_keys=True)
print(f'書込: kanjiFacets.json  総{len(out)}字')
print(f'  明快字(意味面あり): {nc_clear} / bound(意味面なし): {nc_bound}')
print(f'  内訳: 訓あり{nc_kun} / 単独語あり{nc_word}')
print('  検算:', {c: out[c] for c in ['校', '山', '生', '百', '肉', '茶', '的'] if c in out})
