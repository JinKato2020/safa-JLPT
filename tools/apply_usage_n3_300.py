# -*- coding: utf-8 -*-
"""新規N3用法300問を content/problems/moji_goi/usage_N3.json へ適用し、
誤答多様性タグ(usageDistractorTags.json)も同時更新する（gen-only版）。
  - 本文= scratchpad/usage_n3_300/all300.json ({vocabId,word,correct,distractors[{sentence,repl,type}]})
  - ふりがな= scratchpad/usage_n3_300/furout_300.json ({vocabId,word_ruby,answer_ruby,distractors_ruby})
  - answer=choices[0](既存と同じ・アプリが実行時シャッフル)。誤答3はタグと同順。
  - 3誤答が単一型なら monoTypeAllow に登録。P1(repl全別)違反があれば中止(番人ハード失敗のため)。
"""
import json, os, re, sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OD = os.path.join(ROOT, 'scratchpad', 'usage_n3_300')
strip = lambda s: re.sub(r'（[^）]*）', '', s or '')
DRY = '--write' not in sys.argv

allq = json.load(open(os.path.join(OD, 'all300.json'), encoding='utf-8'))
fur = {e['vocabId']: e for e in json.load(open(os.path.join(OD, 'furout_300.json'), encoding='utf-8'))}

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
existing_vids = {it.get('vocabId') for it in d['items']}
nums = [int(re.search(r'(\d+)$', i).group(1)) for i in existing_ids if i.startswith('N3-V-Y')]
nxt = (max(nums) + 1) if nums else 1

tagfile = os.path.join(ROOT, 'src/data/shared/usageDistractorTags.json')
TAG = json.load(open(tagfile, encoding='utf-8'))
mono = set(TAG.get('monoTypeAllow', []))

new_items = []
report = {'p1_dup': [], 'mono': [], 'made': 0, 'content_mismatch': [], 'vid_dup': [], 'nofuri': []}
tags_add = {}
for q in allq:
    vid = q['vocabId']
    if vid in existing_vids:
        report['vid_dup'].append(vid); continue
    e = fur.get(vid)
    if not e:
        report['nofuri'].append(vid); continue
    ans = e['answer_ruby']; drs = e['distractors_ruby']
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
    types = [map_type(dd['type']) for dd in q['distractors']]
    repls = [dd['repl'] for dd in q['distractors']]
    tags_add[iid] = [{'repl': repls[i], 'type': types[i]} for i in range(3)]
    if len(set(repls)) < 3:
        report['p1_dup'].append((iid, vid, repls))
    if len(set(types)) < 2:
        mono.add(iid); report['mono'].append((iid, q['word'], types[0]))
    report['made'] += 1

print('made', report['made'], '/ vid_dup', len(report['vid_dup']), '/ nofuri', len(report['nofuri']))
print('P1 dup (must be 0):', report['p1_dup'])
print('mono-type -> monoTypeAllow:', len(report['mono']))
print('content mismatch (must be empty):', report['content_mismatch'][:10])
if report['p1_dup']:
    print('!! P1違反があるため中止（番人が落ちる）'); sys.exit(1)
if report['content_mismatch']:
    print('!! 内容不一致があるため中止'); sys.exit(1)
if DRY:
    print(f'\n[DRY] usage_N3 {len(d["items"])} -> {len(d["items"]) + len(new_items)}  (--write で書込)')
    print('  新id範囲', f'N3-V-Y-{nums and max(nums)+1:04d}..N3-V-Y-{nxt-1:04d}')
    sys.exit(0)

d['items'].extend(new_items)
json.dump(d, open(os.path.join(ROOT, 'content/problems/moji_goi/usage_N3.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
TAG['tags'].update(tags_add)
TAG['monoTypeAllow'] = sorted(mono)
json.dump(TAG, open(tagfile, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'\n書込完了: usage_N3 total now {len(d["items"])}  新id N3-V-Y-{nxt-len(new_items):04d}..N3-V-Y-{nxt-1:04d}')
