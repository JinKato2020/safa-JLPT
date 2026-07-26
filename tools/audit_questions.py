#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""N4 問題 整合性監査ツール(用法/並べ替え/文章の文法)。
設計: app/docs/superpowers/specs/2026-07-15-n4-question-integrity-audit-design.md
サブコマンド:
  machine           : C機械監査(C1..C6)全数 → scratchpad/audit/structural_report.json + サマリ
  batches           : LLM監査用バッチ分割 → scratchpad/audit/batch_<daimon>_<NN>.json
  validate-verdicts : verdict群を機械再チェック → repairs_clean.json / repairs_reverify.json
  apply             : 確定修復を3JSONへ反映(backup退避つき) + retranslate_ne.json
"""
import sys, os, io, json, re, glob
from collections import Counter, defaultdict

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # JLPTアプリ/
def P(*a): return os.path.join(ROOT, *a)
AUDIT = P('scratchpad', 'audit')

FILES = {
    'usage':           P('app', 'content', 'problems', 'moji_goi', 'usage_N4.json'),
    'order':           P('app', 'content', 'problems', 'bunpou', 'order_N4.json'),
    'passage_grammar': P('app', 'content', 'problems', 'bunpou', 'passage_grammar_N4.json'),
}

# 役割ベースのみ許可。個人名(姓)を検出。role語は許可。
SURNAMES = ['田中','佐藤','鈴木','高橋','渡辺','伊藤','山本','中村','小林','加藤','吉田','山田',
            '佐々木','山口','松本','井上','木村','清水','池田','橋本','阿部','石川','山下',
            '中島','石井','小川','前田','岡田','長谷川','藤田','後藤','近藤','村上','遠藤',
            '青木','坂本','斉藤','斎藤','田村','福田','太田','上田','森田','原田']
NAME_RE = re.compile('|'.join(SURNAMES))

RUBY_RE = re.compile(r'（([^（）]*)）')          # 全角括弧のルビ
HALF_PAREN_RE = re.compile(r'\([^)]*\)')         # 半角括弧(混入検出)
KANA_RE = re.compile(r'^[぀-ゟ゠-ヿー・、,\s]*$')  # かな/長音のみ

def load(daimon):
    with io.open(FILES[daimon], encoding='utf-8') as f:
        return json.load(f)

def norm(s):
    return re.sub(r'\s+', '', str(s or ''))

def strip_ruby(s):
    """ルビ（かな）を除いた素の表層(重複・長さ比較用)。"""
    return RUBY_RE.sub('', str(s or ''))

def text_fields_flat(it):
    """flat item(usage/order)のテキスト全部。"""
    return [it.get('stem',''), it.get('question',''), it.get('answer','')] + list(it.get('choices',[]))

# ---------- 各問(unit)をC検査 ----------
def check_choices(choices, answer_index=None, answer_str=None):
    out = {}
    ch = list(choices or [])
    # C2 選択肢重複(ルビ除去して比較)
    keys = [norm(strip_ruby(c)) for c in ch]
    dup = [c for c,n in Counter(keys).items() if n > 1 and c]
    out['C2_dup'] = bool(dup)
    # C4 長さtell: 正解が厳密に最長/最短か(素の表層長)
    lens = [len(strip_ruby(c)) for c in ch]
    ai = answer_index
    if ai is None and answer_str is not None:
        try: ai = [norm(strip_ruby(c)) for c in ch].index(norm(strip_ruby(answer_str)))
        except ValueError: ai = None
    out['C4_len_extreme'] = None
    if ai is not None and len(lens) >= 2:
        if lens[ai] == max(lens) and lens.count(max(lens)) == 1: out['C4_len_extreme'] = 'longest'
        elif lens[ai] == min(lens) and lens.count(min(lens)) == 1: out['C4_len_extreme'] = 'shortest'
    # C6 答え整合
    out['C6_bad'] = False
    if answer_index is not None:
        out['C6_bad'] = not (isinstance(answer_index,int) and 0 <= answer_index < len(ch) and len(ch)==4)
    elif answer_str is not None:
        out['C6_bad'] = norm(strip_ruby(answer_str)) not in [norm(strip_ruby(c)) for c in ch]
    return out, ai

def check_ruby(texts):
    """C3: ルビ形式一貫性。半角括弧の混入 / ルビ中身がかな以外 / 空ルビ を検出。"""
    problems = []
    for t in texts:
        t = str(t or '')
        if HALF_PAREN_RE.search(t): problems.append('halfwidth_paren')
        for m in RUBY_RE.findall(t):
            if m == '': problems.append('empty_ruby')
            elif not KANA_RE.match(m): problems.append('nonkana_ruby')
    return sorted(set(problems))

def check_names(texts):
    hits = set()
    for t in texts:
        for m in NAME_RE.findall(str(t or '')):
            hits.add(m)
    return sorted(hits)

# ---------- machine ----------
def cmd_machine():
    os.makedirs(AUDIT, exist_ok=True)
    report = {}
    print('=== C機械監査 (N4・3大問) ===\n')
    for daimon in ['usage','order','passage_grammar']:
        data = load(daimon)
        items = data['items']
        pos = Counter()       # C1 正解位置分布
        c2=c3=c4long=c4short=c6=0
        c3set=set(); nameflags=[]; c2ids=[]; c6ids=[]
        nunits = 0
        if daimon == 'passage_grammar':
            for grp in items:
                gtexts = [p.get('body','') for p in grp.get('passages',[])]
                nm = check_names(gtexts)
                for q in grp.get('questions',[]):
                    nunits += 1
                    res,ai = check_choices(q.get('choices',[]), answer_index=q.get('answerIndex'))
                    if ai is not None: pos[ai]+=1
                    if res['C2_dup']: c2+=1; c2ids.append(q.get('id'))
                    if res['C4_len_extreme']=='longest': c4long+=1
                    elif res['C4_len_extreme']=='shortest': c4short+=1
                    if res['C6_bad']: c6+=1; c6ids.append(q.get('id'))
                    rb = check_ruby(list(q.get('choices',[])))
                    if rb: c3+=1; c3set.update(rb)
                    qnm = check_names(list(q.get('choices',[])))
                    if nm or qnm: nameflags.append({'id':q.get('id'),'names':sorted(set(nm)|set(qnm))})
                rb2 = check_ruby(gtexts)
                if rb2: c3+=1; c3set.update(rb2)
        else:
            for it in items:
                nunits += 1
                res,ai = check_choices(it.get('choices',[]), answer_str=it.get('answer'))
                if ai is not None: pos[ai]+=1
                if res['C2_dup']: c2+=1; c2ids.append(it.get('id'))
                if res['C4_len_extreme']=='longest': c4long+=1
                elif res['C4_len_extreme']=='shortest': c4short+=1
                if res['C6_bad']: c6+=1; c6ids.append(it.get('id'))
                texts = text_fields_flat(it)
                rb = check_ruby(texts)
                if rb: c3+=1; c3set.update(rb)
                nm = check_names(texts)
                if nm: nameflags.append({'id':it.get('id'),'names':nm})
        total_pos = sum(pos.values()) or 1
        posdist = {str(k): pos.get(k,0) for k in range(4)}
        # 期待25%からの最大乖離
        skew = max(abs(pos.get(k,0)/total_pos - 0.25) for k in range(4))
        report[daimon] = {
            'units': nunits,
            'C1_position_dist': posdist, 'C1_max_skew_pct': round(skew*100,1),
            'C2_dup_count': c2, 'C2_ids': c2ids[:50],
            'C3_ruby_issue_count': c3, 'C3_kinds': sorted(c3set),
            'C4_answer_longest': c4long, 'C4_answer_shortest': c4short,
            'C4_longest_pct': round(c4long/nunits*100,1), 'C4_shortest_pct': round(c4short/nunits*100,1),
            'C5_name_flag_count': len(nameflags), 'C5_flags': nameflags[:100],
            'C6_bad_count': c6, 'C6_ids': c6ids[:50],
        }
        r=report[daimon]
        print(f'[{daimon}] units={nunits}')
        print(f'  C1 位置分布 {posdist}  最大偏り {r["C1_max_skew_pct"]}%')
        print(f'  C2 選択肢重複 {c2}件')
        print(f'  C3 ルビ形式問題 {c3}件 {sorted(c3set)}')
        print(f'  C4 正解が最長 {c4long}件({r["C4_longest_pct"]}%) / 最短 {c4short}件({r["C4_shortest_pct"]}%)  (期待各25%)')
        print(f'  C5 個人名混入 {len(nameflags)}件' + (f'  例:{[f["names"] for f in nameflags[:8]]}' if nameflags else ''))
        print(f'  C6 答え不整合 {c6}件')
        print()
    with io.open(P('scratchpad','audit','structural_report.json'),'w',encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=1)
    print('→ scratchpad/audit/structural_report.json 保存')

# ---------- batches ----------
BATCH_SIZES = {'usage':28, 'order':27, 'passage_grammar':7}
def cmd_batches():
    os.makedirs(AUDIT, exist_ok=True)
    for fn in glob.glob(P('scratchpad','audit','batch_*.json')): os.remove(fn)
    manifest = []
    for daimon in ['usage','order','passage_grammar']:
        data = load(daimon); items = data['items']; sz = BATCH_SIZES[daimon]
        n = 0
        for i in range(0, len(items), sz):
            chunk = items[i:i+sz]; n += 1
            out = {'daimon':daimon,'level':'N4','batch':n,'items':chunk}
            fp = P('scratchpad','audit',f'batch_{daimon}_{n:02d}.json')
            with io.open(fp,'w',encoding='utf-8') as f: json.dump(out,f,ensure_ascii=False)
            manifest.append({'daimon':daimon,'batch':n,'file':os.path.basename(fp),'n_items':len(chunk)})
        print(f'{daimon}: {n} バッチ ({len(items)} items, {sz}/batch)')
    with io.open(P('scratchpad','audit','_batch_manifest.json'),'w',encoding='utf-8') as f:
        json.dump(manifest,f,ensure_ascii=False,indent=1)
    print(f'計 {len(manifest)} バッチ → scratchpad/audit/  (_batch_manifest.json)')

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv)>1 else 'machine'
    {'machine':cmd_machine, 'batches':cmd_batches}.get(cmd, cmd_machine)()
