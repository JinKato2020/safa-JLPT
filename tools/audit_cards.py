# -*- coding: utf-8 -*-
"""決定論的カード/例文/バンク整合性監査 v2。表示ソース=vocabFurigana(ルビ)+vocabExamplesAi(平文)。¥0・幻覚なし。"""
import json, re, os, collections, io
D = r'C:\Users\jwpsa\Documents\desktop\claude\JLPTアプリ\app\src\data'
J = lambda f: json.load(open(os.path.join(D, f), encoding='utf-8'))

vocab = J('vocab.json')
exAI  = J('vocabExamplesAi.json')
vFuri = J('vocabFurigana.json')
kcr   = J('kanjiCardReadings.json')
ctx   = {x['id']: x for x in J('contextBank.json')}
orth  = {x['id']: x for x in J('orthographyBank.json')}
syn   = {x['id']: x for x in J('synonymBank.json')}

KANJI = r'[一-鿿㐀-䶿々〆〇ヶ]'
PARENS = re.compile(r'[（(][^）)]*[）)]')
RUBY = re.compile(r'(' + KANJI + r'+)[（(]([^）)]*)[）)]')
NEST = re.compile(r'[（(][^）)]*[（(]')  # 括弧ネスト(二重付与崩れ)
def strip_ruby(s): return PARENS.sub('', s) if s else s
def nospace(s): return re.sub(r'\s', '', s or '')
def kanji_runs(s): return re.findall(KANJI + r'+', s or '')

flags = collections.defaultdict(list)
def add(chk, vid, detail): flags[chk].append((vid, detail))

for v in vocab:
    vid, word, reading = v['id'], v['word'], v['reading']
    bound = bool(re.search(r'[〜～]', word))
    ex = exAI.get(vid, {}).get('ja') if isinstance(exAI.get(vid), dict) else None
    vf = vFuri.get(vid)
    plain_ex = strip_ruby(ex) if ex else None

    # C6 ローカル例文なし(→リモート辞書フォールバック)
    if not ex and not vf and not bound:
        add('C6_no_local_example', vid, f'{word}({reading})')

    # C1 見出し語が例文平文に無い
    if plain_ex:
        stem = word[:-1] if len(word) > 1 else word
        if word not in plain_ex and reading not in plain_ex and stem not in plain_ex:
            add('C1_headword_absent', vid, f'{word} :: {plain_ex}')

    # C4a 平文exAIに括弧(読み)混入
    if ex and PARENS.search(ex):
        add('C4_ruby_leaked_plain', vid, f'{word} :: exAI={ex}')
    # C4b vocabFuriganaに括弧ネスト(二重付与崩れ)
    if vf and NEST.search(vf):
        add('C4_nested_furigana', vid, f'{word} :: vf={vf}')

    # C3 見出し語(単一セル一致)のルビ読みがカード読みと不一致
    if vf:
        for base, rd in RUBY.findall(vf):
            if base == word and rd != reading:
                add('C3_reading_mismatch', vid, f'{word} card読={reading} 例文読={rd} :: {vf}')
                break

    # C5 下線オーバースパン: 多字漢字1ルビセルが見出し漢字を真部分に含む
    if vf and re.fullmatch(KANJI + r'+', word):
        for base, rd in RUBY.findall(vf):
            if word in base and base != word:
                add('C5_underline_overspan', vid, f'{word} ⊂ 「{base}（{rd}）」 :: {vf}')
                break

    # C8 exAI平文 と vocabFurigana平文 が不一致(furigana処理でテキスト変化)
    if ex and vf:
        if nospace(plain_ex) != nospace(strip_ruby(vf)):
            add('C8_exAI_vf_diverge', vid, f'{word} | exAI={nospace(plain_ex)} | vfPlain={nospace(strip_ruby(vf))}')

# 漢字カード読み重複(on/kun両方に同一)
for ch, d in kcr.items():
    seen = {}
    for grp in ('on', 'kun'):
        for e in d.get(grp, []):
            key = (e.get('word'), e.get('wordReading'))
            if key in seen and seen[key] != grp:
                add('KC_dup_on_kun', ch, f'{ch}: {key} が {seen[key]}と{grp}に重複')
            seen[key] = grp

# バンク整合性(修正済カードとの食い違い候補)
vmap = {v['id']: v for v in vocab}
for bid, b in ctx.items():
    vid = bid.split(':', 1)[1]; v = vmap.get(vid)
    if v and b.get('answer'):
        a = b['answer']
        if a != v['word'] and a != v['reading'] and a not in v['word'] and v['word'] not in a:
            add('B_ctx_answer_vs_card', vid, f"card={v['word']}({v['reading']}) ctxAns={a}")
for bid, b in syn.items():
    vid = bid.split(':', 1)[1]; v = vmap.get(vid)
    if v and b.get('word') and b['word'] != v['word'] and b['word'] not in v['word'] and v['word'] not in b['word']:
        add('B_syn_word_vs_card', vid, f"card={v['word']} synWord={b['word']}")

# ==== レポート ====
order = ['C6_no_local_example','C1_headword_absent','C4_ruby_leaked_plain','C4_nested_furigana',
         'C3_reading_mismatch','C5_underline_overspan','C8_exAI_vf_diverge',
         'KC_dup_on_kun','B_ctx_answer_vs_card','B_syn_word_vs_card']
print('==== 決定論監査 v2 サマリ ====')
total = 0
for k in order:
    n = len(flags[k]); total += n
    print(f'{k:26} : {n}')
print(f'{"TOTAL flags":26} : {total}')

print('\n==== 7例の検出照合 ====')
seven = {'n5-v-26':'あっち','n5-v-51':'いくら(辞書=リモート)','n5-v-57':'一','n5-v-216':'九(く)',
         'n5-v-243':'五','n5-v-254':'九日','n5-v-259':'こっち'}
byid = collections.defaultdict(list)
for k, lst in flags.items():
    for vid, _ in lst: byid[vid].append(k)
for vid, nm in seven.items():
    print(f'  {nm}({vid}): {byid.get(vid) or "※ローカル正常(辞書タブのリモート例文issue)"}')

out = os.path.join(os.path.dirname(__file__), 'audit_report.txt')
with io.open(out, 'w', encoding='utf-8') as f:
    for k in order:
        f.write(f'\n===== {k} ({len(flags[k])}) =====\n')
        for vid, det in flags[k]:
            f.write(f'{vid}\t{det}\n')
print(f'\n詳細レポート: {out}')
