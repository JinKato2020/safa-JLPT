# -*- coding: utf-8 -*-
"""Workflow の journal.jsonl から用法N3生成エージェントの戻り値({items:[...]})を機械抽出し、
scratchpad/usage_n3_300/all300.json を作る（A1: 300問の本体を会話に流さない）。

使い方: python tools/extract_usage_journal.py <journal.jsonl のパス> [--write]
  - 既定は dry-run(集計だけ表示)。--write で all300.json を書く。
  - journal のレコード形式は環境依存なので、どのキー配下でも {items:[{vocabId,word,correct,distractors}]} を
    再帰的に探す(寛容パーサ)。同じ vocabId が複数回出たら最後のものを採用(resume/再実行を想定)。
出力(会話には数行だけ): レコード種別・抽出件数・重複/欠落・uniqRisk集計・targetsとの突合。
"""
import io, json, os, sys, collections

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIRP = os.path.join(ROOT, 'scratchpad', 'usage_n3_300')
OUT = os.path.join(DIRP, 'all300.json')

if len(sys.argv) < 2:
    print('usage: extract_usage_journal.py <journal.jsonl> [--write]'); sys.exit(2)
JP = sys.argv[1]
WRITE = '--write' in sys.argv

REQ = ('vocabId', 'word', 'correct', 'distractors')

def is_item(o):
    return isinstance(o, dict) and all(k in o for k in REQ) and isinstance(o['distractors'], list)

def find_items(o, acc):
    """任意の入れ子から items 配列(用法問題の形)を再帰的に集める。文字列化JSONも一段だけ解く。"""
    if isinstance(o, dict):
        it = o.get('items')
        if isinstance(it, list) and it and all(is_item(x) for x in it):
            acc.extend(it); return
        for v in o.values(): find_items(v, acc)
    elif isinstance(o, list):
        for v in o: find_items(v, acc)
    elif isinstance(o, str) and o.lstrip().startswith(('{', '[')) and '"items"' in o:
        try: find_items(json.loads(o), acc)
        except Exception: pass

kinds = collections.Counter(); items = []; bad = 0
with io.open(JP, encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if not line: continue
        try: o = json.loads(line)
        except Exception: bad += 1; continue
        kinds[str(o.get('type') or o.get('kind') or o.get('event') or 'nokey')] += 1
        find_items(o, items)

tgt = json.load(io.open(os.path.join(DIRP, 'targets.json'), encoding='utf-8'))
tvid = {t['vocabId']: t for t in tgt}

# vocabId 重複は最後を採用
by = collections.OrderedDict()
dup = 0
for q in items:
    if q['vocabId'] in by: dup += 1
    by[q['vocabId']] = q
final = list(by.values())

# 突合・品質の機械チェック(意味判断はしない)
missing = [v for v in tvid if v not in by]
extra = [v for v in by if v not in tvid]
word_mismatch = [v for v, q in by.items() if v in tvid and q['word'] != tvid[v]['word']]
bad_d = [v for v, q in by.items() if len(q['distractors']) != 3]
p1 = [v for v, q in by.items() if len({d.get('repl') for d in q['distractors']}) < 3]
p2 = [v for v, q in by.items() if len({d.get('type') for d in q['distractors']}) < 2]
risk = collections.Counter(q.get('uniqRisk', '') or 'none' for q in final)
emo_risk = collections.Counter((q.get('uniqRisk') or 'none') for q in final if tvid.get(q['vocabId'], {}).get('risk') == 'RED')

print('journal records=', dict(kinds), 'unparsable=', bad)
print('items found=', len(items), 'distinct vocabId=', len(final), 'dup(last wins)=', dup)
print('targets=', len(tvid), 'missing=', len(missing), missing[:10])
print('extra(not in targets)=', len(extra), extra[:5], '| word mismatch=', len(word_mismatch), word_mismatch[:5])
print('distractors!=3:', len(bad_d), bad_d[:5], '| P1 repl dup:', len(p1), p1[:8], '| P2 type<2:', len(p2), p2[:8])
print('uniqRisk=', dict(risk), '| emotion13 uniqRisk=', dict(emo_risk))
if WRITE:
    json.dump(final, io.open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('WROTE', OUT, len(final))
else:
    print('(dry-run: --write で', OUT, 'に書く)')
