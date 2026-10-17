# 用法ダミーの「殺し方タグ」サイドカーを生成する。
#   出力: src/data/shared/usageDistractorTags.json
#   目的: 番人 src/data/usageDistractor.test.ts が P1(置換語ユニーク)/P2(殺し方分散) を検査するための元データ。
#   置換語(repl)は確認用Excelから客観抽出。殺し方(type)は下の TYPES(人手レビュー由来)を使う。
#   ※Excelは中間物。生成後のサイドカーは自己完結(repl+typeを内包)し、Excel無しで番人が動く。
import json, re, sys
import openpyxl

ROOT = '.'
XLSX = '用法N4_新規20問_確認用.xlsx'
OUT  = 'src/data/shared/usageDistractorTags.json'

# 殺し方タクソノミー(05_用法.md 準拠)。番人もこの集合で検証する。
TYPEVOCAB = {'自他','別義','近接','選択','コロケ','対義','呼応','授受'}

# 誤答A,B,C の順(=Excel列順=JSON choices[1..3]順、下で整合を検証)で殺し方を付与。
TYPES = {
 'N4-V-Y-0174':['自他','別義','選択'], 'N4-V-Y-0175':['自他','近接','選択'],
 'N4-V-Y-0176':['自他','近接','別義'], 'N4-V-Y-0177':['自他','近接','選択'],
 'N4-V-Y-0178':['自他','選択','近接'], 'N4-V-Y-0179':['自他','対義','別義'],
 'N4-V-Y-0180':['自他','選択','近接'], 'N4-V-Y-0181':['自他','コロケ','選択'],
 'N4-V-Y-0182':['自他','近接','選択'], 'N4-V-Y-0183':['自他','近接','選択'],
 'N4-V-Y-0184':['自他','選択','近接'], 'N4-V-Y-0185':['自他','近接','近接'],
 'N4-V-Y-0186':['別義','選択','近接'], 'N4-V-Y-0187':['選択','近接','近接'],
 'N4-V-Y-0188':['選択','コロケ','近接'], 'N4-V-Y-0189':['近接','近接','コロケ'],
 'N4-V-Y-0190':['自他','対義','選択'], 'N4-V-Y-0191':['近接','別義','近接'],
 'N4-V-Y-0192':['対義','近接','選択'], 'N4-V-Y-0193':['別義','近接','別義'],
 'N4-V-Y-0194':['近接','コロケ','近接'], 'N4-V-Y-0195':['選択','近接','近接'],
 'N4-V-Y-0196':['近接','選択','近接'], 'N4-V-Y-0197':['選択','選択','近接'],
 'N4-V-Y-0198':['対義','近接','近接'], 'N4-V-Y-0199':['選択','選択','近接'],
 'N4-V-Y-0200':['選択','コロケ','近接'], 'N4-V-Y-0201':['近接','近接','対義'],
 'N4-V-Y-0202':['選択','選択','近接'], 'N4-V-Y-0203':['近接','対義','選択'],
 'N4-V-Y-0204':['対義','近接','選択'], 'N4-V-Y-0205':['選択','コロケ','選択'],
 'N4-V-Y-0206':['別義','近接','選択'], 'N4-V-Y-0207':['近接','選択','選択'],
 'N4-V-Y-0208':['近接','コロケ','選択'], 'N4-V-Y-0209':['選択','選択','近接'],
 'N4-V-Y-0210':['選択','選択','選択'], 'N4-V-Y-0211':['別義','近接','選択'],
 'N4-V-Y-0212':['別義','選択','近接'], 'N4-V-Y-0213':['選択','選択','近接'],
 'N4-V-Y-0214':['授受','授受','選択'], 'N4-V-Y-0215':['授受','授受','選択'],
 'N4-V-Y-0216':['呼応','近接','選択'], 'N4-V-Y-0217':['呼応','呼応','呼応'],
 'N4-V-Y-0218':['選択','選択','近接'], 'N4-V-Y-0219':['近接','選択','呼応'],
 'N4-V-Y-0220':['選択','選択','近接'], 'N4-V-Y-0221':['呼応','対義','近接'],
 'N4-V-Y-0222':['選択','近接','選択'], 'N4-V-Y-0223':['対義','選択','近接'],
}
# 公式が認める単一殺し方の良問(選択制限型/否定呼応型)。P2の例外として明示。
MONO_ALLOW = ['N4-V-Y-0210','N4-V-Y-0217']

# 自他2連発の差替済み誤答。JSON本文を別タイプへ差し替えたので replは Excel(古い)でなくこちらを使い、
# 整合チェックもこの位置はスキップ。key=(id, 誤答位置0-2), val=置換語。
REPL_OVERRIDES = {
 ('N4-V-Y-0174',2):'消えた', ('N4-V-Y-0175',2):'いれた', ('N4-V-Y-0177',2):'開いた',
 ('N4-V-Y-0178',1):'働いた', ('N4-V-Y-0180',1):'変わった', ('N4-V-Y-0181',2):'倒れた',
 ('N4-V-Y-0182',2):'こぼした', ('N4-V-Y-0183',2):'閉めた', ('N4-V-Y-0184',1):'つけた',
}

def norm(s):
    s = re.sub(r'（[^）]*）', '', s or '')  # ルビ除去
    return re.sub(r'\s+', '', s)

def load_json(lv):
    return json.load(open(f'content/problems/moji_goi/usage_{lv}.json', encoding='utf-8'))['items']

# Excel: repl(A=col6,B=8,C=10) と 誤答文(A=5,B=7,C=9)
wb = openpyxl.load_workbook(XLSX, data_only=True)
ws = wb.active
xl = {}
for r in ws.iter_rows(values_only=True):
    if r and isinstance(r[0], str) and r[0].startswith('N4-V-Y-'):
        xl[r[0]] = {'A':(r[5],r[6]),'B':(r[7],r[8]),'C':(r[9],r[10])}

n4 = load_json('N4'); n3 = load_json('N3')
byid = {it['id']:it for it in n4+n3}

tags = {}; misalign=[]; dup=[]
for iid, types in TYPES.items():
    it = byid[iid]
    assert it['choices'][0]==it['answer'], f'{iid} answer!=choices[0]'
    dist = it['choices'][1:]              # JSON誤答(順序)
    ex = xl[iid]
    repls=[]; ok=True
    for j,key in enumerate(['A','B','C']):
        sent, repl = ex[key]
        ov = REPL_OVERRIDES.get((iid,j))
        if ov is not None:
            repls.append(ov)            # 差替済み: Excelでなくオーバーライドを使用(整合チェックもスキップ)
            continue
        if norm(sent)!=norm(dist[j]): ok=False
        repls.append((repl or '').strip())
    if not ok: misalign.append(iid)
    if len(set(repls))<len(repls): dup.append(iid)
    tags[iid] = [{'repl':repls[j],'type':types[j]} for j in range(3)]

# 既存サイドカーの他ソース(legacy 111問=apply_usage_reduce.py 由来)のタグは保全してマージ。
import os as _os
prev = json.load(open(OUT, encoding='utf-8')) if _os.path.exists(OUT) else {}
for k, v in prev.get('tags', {}).items():
    if k not in tags:            # このビルダーが持たない id(=legacy)は温存
        tags[k] = v
mono = sorted(set(MONO_ALLOW) | set(prev.get('monoTypeAllow', [])))

# legacyAllowlist = 4択なのに未タグの item(=既存分の backfill 債務)
def four(items): return [it['id'] for it in items if len(it['choices'])==4]
legacy = [i for i in four(n4)+four(n3) if i not in tags]

out = {
 'note': '用法ダミーの殺し方タグ。番人=src/data/usageDistractor.test.ts。'
         'P1=1問内で repl(置換語)ユニーク。P2=殺し方type分散(全同型はmonoTypeAllowのみ許容)。'
         'type∈'+'/'.join(sorted(TYPEVOCAB))+'。0154-0223はExcel由来/legacyはapply_usage_reduce由来。',
 'monoTypeAllow': mono,
 'knownDupRepl': sorted(dup),   # 既知のP1違反(自他2連発等)。ラチェット=縮小のみ。要ダミー差替。
 'tags': tags,
 'legacyAllowlist': sorted(legacy),
}
json.dump(out, open(OUT,'w',encoding='utf-8'), ensure_ascii=False, indent=1)
print('wrote', OUT)
print('tagged', len(tags), 'legacyAllowlist', len(legacy))
print('misalign(順序不整合・要確認):', misalign)
print('knownDupRepl(P1違反=要差替):', sorted(dup))
