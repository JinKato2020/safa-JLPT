# -*- coding: utf-8 -*-
"""gen_vocab_examples_workflow の生成結果(journal)を回収する（0トークン）。

やること:
  - workflow journal から {id, vocabId, ja} を回収 → scratchpad/{DIR}/filled_{LV}.json
  - ふりがな用に scratchpad/context_regen/baked_{LV}.json を書く（prompt=ja・漢字を含む文だけ）
    → この後 `python tools/gen_polish_workflow.py {LV} --ruby-only` がこれを読む
使い方: python tools/harvest_vocab_examples.py N3 wf_xxxxxxxx vocab_swap3
"""
import io, json, os, re, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
sys.path.insert(0, os.path.join(ROOT, 'data-build'))
from harvest_workflow import find_journal, harvest  # noqa: E402

LV = (sys.argv[1] if len(sys.argv) > 1 else 'N3').upper()
RUN = sys.argv[2]
DIR = sys.argv[3] if len(sys.argv) > 3 else 'vocab_swap3'
KANJI = re.compile(r'[㐀-鿿]')

res, _, _ = harvest(find_journal(RUN))
items = {}
for r in res.values():
    if isinstance(r, dict):
        for it in r.get('items') or []:
            if it.get('id') and it.get('vocabId') and it.get('ja'):
                items[it['id']] = {'id': it['id'], 'vocabId': it['vocabId'], 'ja': it['ja']}
filled = list(items.values())

os.makedirs(os.path.join(ROOT, 'scratchpad', DIR), exist_ok=True)
with io.open(os.path.join(ROOT, 'scratchpad', DIR, f'filled_{LV}.json'), 'w', encoding='utf-8', newline='\n') as f:
    json.dump(filled, f, ensure_ascii=False, indent=1)

good = [{'id': x['id'], 'prompt': x['ja'], 'answer': '', 'choices': []} for x in filled if KANJI.search(x['ja'])]
os.makedirs(os.path.join(ROOT, 'scratchpad', 'context_regen'), exist_ok=True)
with io.open(os.path.join(ROOT, 'scratchpad', 'context_regen', f'baked_{LV}.json'), 'w', encoding='utf-8', newline='\n') as f:
    json.dump({'good': good, 'flagged': []}, f, ensure_ascii=False, indent=1)

print(f'{LV}: 回収={len(filled)}文  漢字あり(ルビ要)={len(good)}')
print(f'  → scratchpad/{DIR}/filled_{LV}.json / scratchpad/context_regen/baked_{LV}.json')
print(f'  次: python tools/gen_polish_workflow.py {LV} --ruby-only  → Workflow起動')
