# -*- coding: utf-8 -*-
"""言い換え④・用法⑤「模試専用プール」の対象語を機械選定する（0トークン）。

方針（ユーザー承認 2026-08-30「指標が骨組み・肉付けと取捨は作問時にLLM」）:
  - 言い換え④: N5/N4/N3 各50問（5問×10回）。
  - 用法⑤    : N4/N3   各50問（N5に用法は無い＝公式仕様）。
  - 1語=1問。頻出50% + 中頻度帯(良問)50%。カテゴリ上限で品詞/分野を分散。
指標（すべて既存の一次データ）:
  - vocabFreq.json … JMdict由来の実コーパス頻度(小さいほど頻出・50=未評価)。
  - iikaePossible.json … 言い換え適性 p=1(近い類義語あり=作問可)/above_only=答えが級上。
  - usage学習プール(usage_N*.json)の vocabId … 用法の作問実績語(=作れる保証)。
  - 方法C: 新聞コーパスで沈む日常語(食べる等)を SPOKEN_BOOST で頻出ティアへ引き上げ。
ソフト回避（足りなければ重複可・ハードではない）:
  - 他大問の模試プール(kanji_read/orthography/context)・もう一方の新大問の同レベル選定語。
  - 言い換え/用法とも学習プールとの重複は"避けない"(p=1が学習で枯渇済のため実務上不可)。
出力: scratchpad/iikae_youhou_mock/select_{daimon}_{level}.json + 同フォルダに preview.txt
"""
import io, json, os, re, glob
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def L(p): return json.load(io.open(os.path.join(ROOT, p), encoding='utf-8'))

freq  = L('src/data/dict/vocabFreq.json')
cat   = L('src/data/dict/vocabCategory.json')
vocab = {v['id']: v for v in L('src/data/shared/vocab.json')}
mex_raw = L('src/data/shared/vocabMetricExcluded.json')
mex = set(mex_raw if isinstance(mex_raw, list) else mex_raw.keys())
iikae = L('src/data/shared/iikaePossible.json')['items']   # vid -> {p, syn, above_only?}

# 用法の作問実績語（=作れる保証つき）
usage_covered = {}
for lv in ['N4', 'N3']:
    usage_covered[lv] = set(
        it['vocabId'] for it in L(f'content/problems/moji_goi/usage_{lv}.json')['items'] if it.get('vocabId'))

# 他大問の模試プール語（ソフト回避）
mock_avoid = set()
for p in glob.glob(os.path.join(ROOT, 'content/problems/moji_goi/mock/*.json')):
    for it in L(f'content/problems/moji_goi/mock/{os.path.basename(p)}').get('items', []):
        if it.get('vocabId'): mock_avoid.add(it['vocabId'])

# 方法C: 新聞頻度で沈む「話し言葉の基幹語」を頻出ティア(effFreq<=3)へ引き上げ（監査可能・明示）
SPOKEN_BOOST = set("""
食べる 飲む 見る 見せる 聞く 話す 読む 書く 買う 行く 来る 待つ 持つ 作る 使う 思う 言う 分かる
知る 起きる 寝る 入る 出る 立つ 座る 歩く 走る 休む 遊ぶ 泳ぐ 歌う 乗る 降りる 開ける 閉める
始める 終わる 教える 習う 借りる 貸す 洗う 着る 脱ぐ 忘れる 覚える 呼ぶ 帰る 送る 渡す
決める 選ぶ 比べる 増える 減る 足りる 困る 急ぐ 手伝う 探す 運ぶ 並ぶ 変わる 直す 過ぎる
""".split())

TARGET = {'N5': 50, 'N4': 50, 'N3': 50}
CAT_CAP = 0.22          # 1カテゴリが目標の22%を超えない（多様化）
RESERVE = 15            # 作問時の差替用に各(大問,レベル)で+15語の予備を出す
MID_MIN, MID_MAX = 6, 40
AFFIX = re.compile(r'[～〜]|^御')
KANA1 = re.compile(r'^[ぁ-んァ-ヴー]$')
NUM   = re.compile(r'^[0-9０-９〇一二三四五六七八九十百千万億]+$')

def base_elig(v):
    w = v['word']
    if v['id'] in mex: return False
    if AFFIX.search(w): return False
    if len(w) == 1 and not KANA1.match(w): return False   # 裸の単漢字(接尾語用法)
    if NUM.match(w): return False
    return True

def eff_freq(v):
    f = freq.get(v['id'], 50)
    if v['word'] in SPOKEN_BOOST: f = min(f, 3)
    return f

def candidates(daimon, lv):
    out = []
    for v in vocab.values():
        if v['level'] != lv or not base_elig(v): continue
        if daimon == 'iikae':
            it = iikae.get(v['id'])
            if not it or it.get('p') != 1 or it.get('above_only') == 1: continue
        else:  # youhou: 作問実績語のみ（作れる保証）
            if v['id'] not in usage_covered[lv]: continue
        out.append(v)
    return out

def pick(daimon, lv, cross_avoid):
    target = TARGET[lv] + RESERVE
    cands = candidates(daimon, lv)
    for v in cands: v['_f'] = eff_freq(v)
    cands.sort(key=lambda v: (v['_f'], v['id']))
    # ソフト回避: 他大問模試 + もう一方の新大問の選定語（避けたい順に後回し）
    avoid = mock_avoid | cross_avoid
    pref  = [v for v in cands if v['id'] not in avoid]
    rest  = [v for v in cands if v['id'] in avoid]
    cap = max(4, int(target * CAT_CAP))
    catcnt = Counter(); picked = []; have = set()
    half = TARGET[lv] // 2

    def take(v, half_tag):
        c = cat.get(v['id'], 'other')
        v['_half'] = half_tag; v['_avoid'] = v['id'] in avoid
        picked.append(v); have.add(v['id']); catcnt[c] += 1

    # ① 頻出half = 最頻ティア（カテゴリ上限で多様化）
    for v in pref:
        if len([p for p in picked if p['_half']=='頻出']) >= half: break
        if catcnt[cat.get(v['id'],'other')] >= cap: continue
        take(v, '頻出')
    # ② 中頻度half = MID帯を等間隔サンプル（breadth）
    mid = [v for v in pref if v['id'] not in have and MID_MIN <= v['_f'] <= MID_MAX]
    need = TARGET[lv] - len(picked)
    if mid and need > 0:
        stride = max(1, len(mid) // max(1, need))
        for i in range(0, len(mid), stride):
            if len([p for p in picked if p['_half']=='中頻度']) >= (TARGET[lv]-half): break
            v = mid[i]
            if v['id'] in have or catcnt[cat.get(v['id'],'other')] >= cap: continue
            take(v, '中頻度')
    # ③ 目標未達なら pref→rest 順で補充（カテゴリ上限解除）
    for v in pref + rest:
        if len(picked) >= TARGET[lv]: break
        if v['id'] not in have: take(v, '補充')
    # ④ 予備(RESERVE) = 続き（頻度順・予備タグ）
    for v in pref + rest:
        if len(picked) >= target: break
        if v['id'] not in have: take(v, '予備')

    picked.sort(key=lambda v: (0 if v['_half']!='予備' else 1, v['_f'], v['id']))
    return picked, len(cands)

os.makedirs(os.path.join(ROOT, 'scratchpad/iikae_youhou_mock'), exist_ok=True)
PLAN = [('iikae', ['N5','N4','N3']), ('youhou', ['N4','N3'])]
selected = {}   # (daimon,lv) -> ids  (cross-avoid用)
lines = []
for daimon, levels in PLAN:
    for lv in levels:
        cross = set()
        other = 'youhou' if daimon=='iikae' else 'iikae'
        for k, ids in selected.items():
            if k[1] == lv and k[0] == other: cross |= ids
        picked, ncand = pick(daimon, lv, cross)
        selected[(daimon, lv)] = set(v['id'] for v in picked)
        rows = [{'vocabId': v['id'], 'word': v['word'], 'reading': v['reading'],
                 'meaning': v['meaning'], 'freq': freq.get(v['id'],50), 'effFreq': v['_f'],
                 'cat': cat.get(v['id'],'other'), 'half': v['_half'], 'softAvoid': v['_avoid']}
                for v in picked]
        with io.open(os.path.join(ROOT, f'scratchpad/iikae_youhou_mock/select_{daimon}_{lv}.json'),
                     'w', encoding='utf-8', newline='\n') as f:
            json.dump(rows, f, ensure_ascii=False, indent=1)
        core = [r for r in rows if r['half'] != '予備']
        h1 = [r['word'] for r in core if r['half']=='頻出']
        h2 = [r['word'] for r in core if r['half']=='中頻度']
        h3 = [r['word'] for r in core if r['half']=='補充']
        rv = [r['word'] for r in rows if r['half']=='予備']
        nm = {'iikae':'④言い換え','youhou':'⑤用法'}[daimon]
        nsoft = sum(1 for r in core if r['softAvoid'])
        lines.append(f'==== {nm} {lv} ==== 候補{ncand}語 / 選定{len(core)}(+予備{len(rv)})  ソフト回避該当{nsoft}')
        lines.append(f'  【頻出{len(h1)}】 ' + ' '.join(h1))
        lines.append(f'  【中頻度{len(h2)}】 ' + ' '.join(h2))
        if h3: lines.append(f'  【補充{len(h3)}】 ' + ' '.join(h3))
        lines.append(f'  （予備{len(rv)}: ' + ' '.join(rv) + '）')

io.open(os.path.join(ROOT, 'scratchpad/iikae_youhou_mock/preview.txt'),
        'w', encoding='utf-8').write('\n'.join(lines))
print('OK: scratchpad/iikae_youhou_mock/ に select_*.json + preview.txt を出力')
