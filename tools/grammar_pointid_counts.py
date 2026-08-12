# 文法ポイントID別の問題数を集計（文法形式判断＋文の組み立て）。
#   python tools\grammar_pointid_counts.py
# 会話には要約数行だけ出す。全件は 問題\文法ポイント別_問題数.xlsx へ。
import json, os, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def L(*p): return os.path.join(ROOT, *p)

pts = {x['id']: x for x in json.load(open(L('src','data','shared','grammar.json'), encoding='utf-8'))}

cnt = collections.Counter()        # pointId -> 問題数(合計)
by_daimon = {'form': collections.Counter(), 'order': collections.Counter()}
no_pid = {'form': 0, 'order': 0}

by_daimon = {'form': collections.Counter(), 'order': collections.Counter(), 'passage': collections.Counter()}
no_pid = {'form': 0, 'order': 0, 'passage': 0}
for kind, prefix in (('form', 'grammar_form'), ('order', 'order')):
    for lv in ('N3', 'N4', 'N5'):
        d = json.load(open(L('content','problems','bunpou', f'{prefix}_{lv}.json'), encoding='utf-8'))
        for it in d['items']:
            pid = it.get('pointId')
            if not pid:
                no_pid[kind] += 1
                continue
            cnt[pid] += 1
            by_daimon[kind][pid] += 1
# 文章の文法(passage): items[].questions[].pointId も数える
for lv in ('N3', 'N4', 'N5'):
    d = json.load(open(L('content','problems','bunpou', f'passage_grammar_{lv}.json'), encoding='utf-8'))
    for it in d['items']:
        for q in it.get('questions', []):
            pid = q.get('pointId')
            if not pid:
                no_pid['passage'] += 1
                continue
            cnt[pid] += 1
            by_daimon['passage'][pid] += 1

used = set(cnt)
allpts = set(pts)
ghosts = sorted(allpts - used)

# 分布ヒストグラム
hist = collections.Counter(cnt.values())

print(f"総問題数(pointId付): form {sum(by_daimon['form'].values())} / order {sum(by_daimon['order'].values())} / passage {sum(by_daimon['passage'].values())}")
print(f"pointId無し: form {no_pid['form']} / order {no_pid['order']} / passage {no_pid['passage']}")
print(f"文法ポイント総数 {len(allpts)} / 使用中 {len(used)} / 幽霊(0問) {len(ghosts)}")
print("--- 問題数の分布(何問持つポイントが何個あるか) ---")
for n in sorted(hist):
    print(f"  {n:>2}問: {hist[n]}ポイント")
print("--- 多い順トップ15 ---")
for pid, c in cnt.most_common(15):
    print(f"  {c:>3}  {pid}  {pts.get(pid,{}).get('point','?')}")

# Excel 全件
try:
    from openpyxl import Workbook
    wb = Workbook(); ws = wb.active; ws.title = '文法ポイント別'
    ws.append(['pointId', '級', '文法', '意味', '合計', '文法形式判断', '文の組み立て', '文章の文法'])
    for pid in sorted(allpts, key=lambda p: (-cnt[p], p)):
        x = pts.get(pid, {})
        ws.append([pid, x.get('level',''), x.get('point',''), x.get('meaning',''),
                   cnt[pid], by_daimon['form'][pid], by_daimon['order'][pid], by_daimon['passage'][pid]])
    out = L('問題', '文法ポイント別_問題数.xlsx')
    wb.save(out)
    print(f"\n全{len(allpts)}件を保存: {out}")
except PermissionError:
    print("\n[!] Excelが開いています。閉じてから再実行してください。")
except ImportError:
    print("\n[!] openpyxl 未導入のためExcelはスキップ")
