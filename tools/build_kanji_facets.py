# -*- coding: utf-8 -*-
"""漢字カード612字の「面判定」データを決定論生成 → src/data/words/kanjiFacets.json。
   meaningClear = 意味面(単独提示で意味を4択)を出す字か。
   【方針A・2026-08-28 ユーザー決定】辞書に意味(gloss)がある字は全て意味面を出す。
     → 音読みだけの熟語専用字(以/発/演 等)も、辞書の意味があるので4択にできる=meaningClear=true。
     ※稀な文語訓(以=もっ.て 等・級外)は読みに一切使わない=永久追放。意味面は gloss だけで判定し kun に依存しない。
   参考フィールド hasKun / hasStandaloneWord は残す(情報用・判定には使わない)。
"""
import os, json
ROOT = r'C:\Users\jwpsa\Documents\desktop\claude\JLPTアプリ'
KC = json.load(open(os.path.join(ROOT, 'src', 'data', 'words', 'kanjiCards.json'), encoding='utf-8'))
KJ = json.load(open(os.path.join(ROOT, 'src', 'data', 'dict', 'kanji.json'), encoding='utf-8'))
V = json.load(open(os.path.join(ROOT, 'src', 'data', 'shared', 'vocab.json'), encoding='utf-8'))

dict_meaning = {k['char']: (k.get('meaning') or '').strip() for k in KJ}
standalone = set(v['word'] for v in V if len(v.get('word', '')) == 1)

def card_gloss(card):
    for r in card.get('readings', []):
        if (r.get('gloss') or '').strip():
            return True
    return bool((card.get('gloss') or '').strip())

out = {}
nc_clear = nc_bound = nc_kun = nc_word = nc_nogloss = 0
for ch, card in KC.items():
    has_kun = any(r.get('type') == 'kun' for r in card.get('readings', []))
    has_word = ch in standalone
    has_gloss = card_gloss(card) or bool(dict_meaning.get(ch))
    clear = has_gloss  # 方針A: 辞書の意味があれば意味面を出す
    out[ch] = {'meaningClear': clear, 'hasKun': has_kun, 'hasStandaloneWord': has_word}
    nc_clear += clear; nc_bound += (not clear); nc_kun += has_kun; nc_word += has_word
    nc_nogloss += (not has_gloss)

json.dump(out, open(os.path.join(ROOT, 'src', 'data', 'words', 'kanjiFacets.json'), 'w', encoding='utf-8'), ensure_ascii=False, sort_keys=True)
print(f'書込: src/data/words/kanjiFacets.json  総{len(out)}字')
print(f'  意味面あり(gloss有): {nc_clear} / 意味面なし(gloss無): {nc_bound}')
print(f'  参考: 訓あり{nc_kun} / 単独語あり{nc_word} / gloss完全に無い字{nc_nogloss}')
print('  検算:', {c: out[c] for c in ['校', '以', '発', '演', '警', '処'] if c in out})
