# -*- coding: utf-8 -*-
"""聴解の正本から「場面(シーン)台帳」を作る。既存問題の場面の偏りを測り、
薄い/空の場面を新規作問へ割り当てるための材料 scene_census.json を書き出す。

背景: 既存は 店/会社/学校/家 に集中し 病院/公共手続/交通旅行/地域 が薄い(2026-07-27実測)。
      新規は薄い場面から割り当てて多様性を担保する(ユーザー指示)。

使い方:
  python tools/choukai/scene_ledger.py                 # 集計を表示 + scene_census.json を書き出し
  python tools/choukai/scene_ledger.py --add <NEWDIR>  # 新規(new_*.json の scenario_tag)も加えて再集計

出力: tools/choukai/scene_census.json
  { "<daimon>_<level>": {"counts": {場面:件数}, "thin": [薄い場面], "empty": [空の場面],
                          "assign": [新規はこの順で薄い場面から埋める] }, ... }
"""
import json, os, re, glob, argparse, sys
from collections import Counter, defaultdict
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
CDIR = os.path.join(REPO, 'content', 'problems', 'choukai')
OUT = os.path.join(os.path.dirname(__file__), 'scene_census.json')

# 場面カテゴリ(役割ベース・個人名なしの世界観に沿う)。判定は導入行→台本全体の順で最初に当たったもの。
SCENE = {
    '会社仕事': ['会社', '仕事', '会議', '社員', '取引', '部長', '課長', '資料', '出張', 'オフィス', '職場', '同僚', '上司', '打ち合わせ', '営業', '書類', '残業'],
    '学校学習': ['学校', '大学', '先生', '学生', '授業', 'ゼミ', '試験', '宿題', '部活', '教室', '図書館', '発表', 'レポート', '講義', '先輩', '後輩', 'サークル'],
    '店買い物': ['店', '買', '注文', 'レストラン', 'カフェ', '商品', '売', '客', 'レジ', 'メニュー', 'スーパー', '食堂', '喫茶', '会計'],
    '家家庭':   ['家', '母', '父', '兄', '姉', '弟', '妹', '夫', '妻', '子ども', '掃除', '料理', '引っ越', '家族', '部屋', '洗濯', '晩ご飯'],
    '病院健康': ['病院', '医者', '薬', '体調', '風邪', 'けが', '健康', '診', '看護', '歯医者', '受付', '待合', '検査'],
    '交通旅行': ['駅', '電車', 'バス', '旅行', '空港', '切符', '道', '案内', 'ホテル', '観光', '飛行機', '乗り', '地図', '予約'],
    '公共手続': ['市役所', '区役所', '図書', '郵便', '銀行', '窓口', '申込', '手続', '受付', '会場', 'イベント', '役所', '証明', '登録', '申請'],
    '地域近所': ['近所', '町内', '公園', 'ごみ', '回覧', '掲示', '町会', '自治', 'ボランティア', '祭り', '清掃'],
}
ORDER = ['kadai', 'point', 'gaiyou', 'hatsuwa', 'sokuji']
LEVELS = ['N5', 'N4', 'N3']
SPK = re.compile(r'^\s*(?:[男女][12]?|店員|先生|学生|客|係|係員|母|父|司会|アナウンス|店長|部長|課長|先輩|後輩|医者|受付)\s*[：:]')

def intro_and_body(script):
    lines = [l.strip() for l in re.split(r'[\n　]+', script or '') if l.strip()]
    idx = next((i for i, l in enumerate(lines) if SPK.match(l)), 0)
    intro = ''.join(lines[:idx]) or (lines[0] if lines else '')
    return intro, ''.join(lines)

def classify(script):
    intro, whole = intro_and_body(script)
    for text in (intro, whole):
        for scene, kws in SCENE.items():
            if any(k in text for k in kws):
                return scene
    return 'その他'

def census():
    tally = defaultdict(Counter)
    for f in glob.glob(os.path.join(CDIR, '*.json')):
        cat = re.match(r'([a-z]+)_', os.path.basename(f)).group(1)
        data = json.load(open(f, encoding='utf-8'))
        lv = data['level']
        for it in data['items']:
            tally[(cat, lv)][classify(it.get('script') or '')] += 1
    return tally

def add_new(tally, newdir):
    for cat in ORDER:
        p = os.path.join(newdir, f'new_{cat}.json')
        if not os.path.exists(p): continue
        for r in json.load(open(p, encoding='utf-8')):
            lv = r.get('level'); st = (r.get('scenario_tag') or '').strip()
            scene = st if st in SCENE else classify(r.get('script') or '')
            if lv: tally[(cat, lv)][scene] += 1

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--add', help='new_*.json のディレクトリも加算')
    ap.add_argument('--thin', type=int, default=2, help='この件数以下を「薄い場面」とみなす')
    a = ap.parse_args()
    tally = census()
    if a.add: add_new(tally, a.add)

    out = {}
    print('=== 場面台帳(既存の偏り) ===  ✔=充実 ・=薄い(<=%d) ×=空' % a.thin)
    for cat in ORDER:
        for lv in LEVELS:
            c = tally.get((cat, lv))
            if not c: continue
            counts = {s: c.get(s, 0) for s in list(SCENE) + ['その他']}
            thin = [s for s in SCENE if 0 < counts[s] <= a.thin]
            empty = [s for s in SCENE if counts[s] == 0]
            # 割当= 空→薄い の順(その他は割当しない=場面を具体化させる)
            assign = empty + thin
            out[f'{cat}_{lv}'] = {'counts': counts, 'thin': thin, 'empty': empty, 'assign': assign}
            mark = ' '.join(f'{s}{counts[s]}' for s in SCENE if counts[s] > 0)
            print(f'  {cat:8} {lv} (計{sum(c.values())}): {mark}  | 空={",".join(empty) or "なし"}')
    json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'\n書き出し: {OUT}')
    print('→ 新規作問では out[<daimon>_<level>].assign の薄い/空の場面から埋める(既存の場面と重複させない)')

if __name__ == '__main__':
    main()
