# 文章の文法「候補フラグ」: 4択が同一動詞/コピュラの活用違いだけの空所を洗い出す(報告のみ)。
#   python tools\check_passage_thin.py [ファイル.json ...]   引数なし=既存 passage_grammar_{N5,N4,N3}.json
#
# 【重要】これは"薄い(一文型)判定"ではない。形(同一活用パラダイム)は「薄い/本文依存」を分けられない
#  (本文全体の時制で決まる同形の良問=本文依存が多数ある)。よってハードゲートにしてはいけない。
#  役割=採用前の「本文依存チェック(LLM反証)に回す候補」を機械で絞るだけ。最終判定は文脈判断(反証)。
#  真のゲート=(1)生成プロンプトで本文依存を必須化 (2)LLM反証で"一文だけで一意に決まるか"を判定して落とす。
#  (md\08_文章の文法.md の永久ルール / 既存の一文型は n5-g-92 へ隔離済=指標対象外)
import sys, os, json, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXCLUDED = 'n5-g-92'
strip = lambda s: re.sub(r'[一-龥々]+（[ぁ-んァ-ヴー]+）', '', str(s))
POLITE = re.compile(r'(ませんでした|ましょう|ました|ません|ます)$')
COPULA = re.compile(r'(ではありませんでした|ではありません|でしょう|でした|です)$')

def same_paradigm(choices, pat):
    stems = set()
    for c in choices:
        m = pat.search(c)
        if not m:
            return False
        stems.add(c[:m.start()])
    return len(choices) == 4 and len(stems) == 1

def is_paradigm(choices):
    cs = [strip(c).strip() for c in choices]
    return same_paradigm(cs, POLITE) or same_paradigm(cs, COPULA)

def main():
    args = sys.argv[1:]
    files = args if args else [os.path.join(ROOT, 'content', 'problems', 'bunpou', f'passage_grammar_{lv}.json') for lv in ('N5', 'N4', 'N3')]
    cand = []
    for f in files:
        d = json.load(open(f, encoding='utf-8'))
        items = d['items'] if isinstance(d, dict) and 'items' in d else d
        for it in items:
            for q in it.get('questions', []):
                if is_paradigm(q.get('choices', [])) and q.get('pointId') != EXCLUDED:
                    cand.append((os.path.basename(f), q.get('id')))
    print(f"同一活用パラダイムの空所 {len(cand)} 件（=本文依存チェックに回す候補。薄いと確定した訳ではない）")
    for f, i in cand[:60]:
        print(f"  {f} {i}")
    print("→ 各候補を『一文だけで一意に決まるか』LLM反証で判定。決まる=一文型→作り直し/n5-g-92、決まらない=本文依存→採用。")
    # 報告のみ。exit 0(ハードゲートにしない=良問の誤ブロック回避)。
    sys.exit(0)

if __name__ == '__main__':
    main()
