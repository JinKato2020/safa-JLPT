# 承認済みN3用法200問を content/problems/moji_goi/usage_N3.json へ適用し、
# 誤答多様性タグ(usageDistractorTags.json)も同時更新する。
#   - 本文=all200.json(内容+repl+type) / ふりがな=furout_*.json(全ルビ) を vocabId で突き合わせ。
#   - answer=choices[0](既存99問と同じ・アプリが実行時シャッフル)。誤答3はタグと同順。
#   - type は TYPEVOCAB {自他,別義,近接,選択,コロケ,対義,呼応,授受} へ正規化。3誤答が単一型なら monoTypeAllow に登録。
import json, os, re, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OD = r'C:\Users\jwpsa\AppData\Local\Temp\claude\c--Users-jwpsa-Documents-desktop-claude-JLPT---\dff2926b-efae-47c7-a4fd-57447b7e8983\scratchpad\usage_n3'
strip = lambda s: re.sub(r'（[^）]*）', '', s or '')

allq = json.load(open(os.path.join(OD, 'all200.json'), encoding='utf-8'))          # 順序=採番順
fur = {}
for f in sorted(glob.glob(os.path.join(OD, 'furout_*.json'))):
    for e in json.load(open(f, encoding='utf-8')): fur[e['vocabId']] = e

# --- 手修正: n3-v-121 の誤答0 は furigana時に対象語(種類)を種へ改変されていた ---
fur['n3-v-121']['distractors_ruby'][0] = '春（はる）になると畑（はたけ）に野菜（やさい）の種類（しゅるい）をまいて育（そだ）てる。'

def map_type(t):
    if '近接' in t: return '近接'
    if '選択' in t: return '選択'
    if 'コロケ' in t: return 'コロケ'
    if '自他' in t: return '自他'
    if '呼応' in t: return '呼応'
    if '授受' in t: return '授受'
    if '対義' in t: return '対義'
    if any(k in t for k in ('多義', '同音', '別義', '多読', '統語', '格')): return '別義'
    return '近接'

QTAIL = 'の使（つか）い方（かた）として最（もっと）もよいものはどれですか。'
d = json.load(open(os.path.join(ROOT, 'content/problems/moji_goi/usage_N3.json'), encoding='utf-8'))
existing_ids = {it['id'] for it in d['items']}
nums = [int(re.search(r'(\d+)$', i).group(1)) for i in existing_ids if i.startswith('N3-V-Y')]
nxt = (max(nums) + 1) if nums else 1

tagfile = os.path.join(ROOT, 'src/data/shared/usageDistractorTags.json')
TAG = json.load(open(tagfile, encoding='utf-8'))
mono = set(TAG.get('monoTypeAllow', []))

new_items = []
report = {'p1_dup': [], 'mono': [], 'made': 0, 'content_mismatch': []}
for q in allq:
    vid = q['vocabId']; e = fur[vid]
    ans = e['answer_ruby']; drs = e['distractors_ruby']
    # 内容不変チェック(ルビ除去で一致)
    if strip(ans) != q['correct']:
        report['content_mismatch'].append((vid, 'answer'))
    for i in range(3):
        if strip(drs[i]) != q['distractors'][i]['sentence']:
            report['content_mismatch'].append((vid, f'd{i}'))
    iid = f'N3-V-Y-{nxt:04d}'; nxt += 1
    item = {
        'id': iid,
        'stem': q['word'],
        'question': f'「{e["word_ruby"]}」{QTAIL}',
        'answer': ans,
        'choices': [ans, drs[0], drs[1], drs[2]],
        'i18n': {},
        'verified': True,
        'vocabId': vid,
    }
    new_items.append(item)
    # タグ(誤答3=choices[1..]と同順)
    types = [map_type(dd['type']) for dd in q['distractors']]
    repls = [dd['repl'] for dd in q['distractors']]
    TAG['tags'][iid] = [{'repl': repls[i], 'type': types[i]} for i in range(3)]
    if len(set(repls)) < 3:
        report['p1_dup'].append((iid, vid, repls))
    if len(set(types)) < 2:
        mono.add(iid); report['mono'].append((iid, q['word'], types[0]))
    report['made'] += 1

d['items'].extend(new_items)
json.dump(d, open(os.path.join(ROOT, 'content/problems/moji_goi/usage_N3.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

TAG['monoTypeAllow'] = sorted(mono)
json.dump(TAG, open(tagfile, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

print('applied items', report['made'], 'new id range', f'N3-V-Y-0151..N3-V-Y-{nxt-1:04d}')
print('usage_N3 total now', len(d['items']))
print('P1 dup (must be 0):', report['p1_dup'])
print('mono-type -> monoTypeAllow added:', len(report['mono']))
for m in report['mono']: print('   ', m)
print('content mismatch (must be empty):', report['content_mismatch'])
