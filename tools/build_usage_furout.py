# -*- coding: utf-8 -*-
"""ふりがなWFの journal.jsonl(平坦な {id:"vocabId|slot", furi}) を all300.json と突き合わせて
scratchpad/usage_n3_300/furout_300.json ({vocabId, word_ruby, answer_ruby, distractors_ruby[3]}) に再組立てる。

- slot∈{w(word), a(correct), 0/1/2(distractor)}。無漢字文はふりがなWFの対象外なので元テキストをそのまま使う。
- 検算: furi から全角括弧とその中身を除いた文字列が元テキストと1文字も違わないこと(不一致は中止)。
使い方: python tools/build_usage_furout.py <furi_journal.jsonl> [--write]
出力(会話には数行): 抽出文数・欠落slot・検算不一致・書き出し件数。
"""
import io, json, os, re, sys, collections

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIRP = os.path.join(ROOT, 'scratchpad', 'usage_n3_300')
OUT = os.path.join(DIRP, 'furout_300.json')
strip = lambda s: re.sub(r'（[^）]*）', '', s or '')
has_kanji = lambda s: any('一' <= c <= '鿿' for c in (s or ''))

if len(sys.argv) < 2:
    print('usage: build_usage_furout.py <furi_journal.jsonl> [--write]'); sys.exit(2)
JP = sys.argv[1]; WRITE = '--write' in sys.argv

allq = json.load(io.open(os.path.join(DIRP, 'all300.json'), encoding='utf-8'))

# journal から {id, furi} を寛容に収集(最後を採用)
def collect(o, acc):
    if isinstance(o, dict):
        it = o.get('items')
        if isinstance(it, list) and it and all(isinstance(x, dict) and 'id' in x and 'furi' in x for x in it):
            acc.extend(it); return
        for v in o.values(): collect(v, acc)
    elif isinstance(o, list):
        for v in o: collect(v, acc)
    elif isinstance(o, str) and o.lstrip().startswith(('{', '[')) and '"furi"' in o:
        try: collect(json.loads(o), acc)
        except Exception: pass

flat = []
for line in io.open(JP, encoding='utf-8'):
    line = line.strip()
    if not line: continue
    try: collect(json.loads(line), flat)
    except Exception: pass
furi = {}
for e in flat:
    furi[e['id']] = e['furi']

out, missing, mismatch = [], [], []
for q in allq:
    vid = q['vocabId']
    texts = {'w': q['word'], 'a': q['correct'], '0': q['distractors'][0]['sentence'],
             '1': q['distractors'][1]['sentence'], '2': q['distractors'][2]['sentence']}
    ruby = {}
    for slot, orig in texts.items():
        if not has_kanji(orig):
            ruby[slot] = orig; continue          # 無漢字はWF対象外→元テキスト
        key = f'{vid}|{slot}'
        if key not in furi:
            missing.append(key); ruby[slot] = orig; continue
        f = furi[key]
        if strip(f) != orig:
            mismatch.append((key, orig, strip(f)))
        ruby[slot] = f
    out.append({'vocabId': vid, 'word_ruby': ruby['w'], 'answer_ruby': ruby['a'],
                'distractors_ruby': [ruby['0'], ruby['1'], ruby['2']]})

print('flat furi collected=', len(furi), '| problems=', len(out))
print('missing slots=', len(missing), missing[:8])
print('checksum mismatch(furi≠orig)=', len(mismatch))
for k, o1, o2 in mismatch[:8]:
    print('   ', k, '| orig=', o1, '| stripped=', o2)
if WRITE and not mismatch:
    json.dump(out, io.open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('WROTE', OUT, len(out))
elif WRITE and mismatch:
    print('検算不一致があるため書き出し中止(先に該当slotを修正)')
else:
    print('(dry-run: --write で', OUT, 'に書く)')
