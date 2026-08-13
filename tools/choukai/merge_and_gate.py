# -*- coding: utf-8 -*-
"""新規作成した聴解問題(簡易JSON)を自動QA→正本(content/problems/choukai/*.json)へ追記。

入力: <NEWDIR>/new_{kadai,point,gaiyou,hatsuwa,sokuji}.json
  各レコード(サブエージェント生成の簡易スキーマ):
   {id, level, daimon, script, question, choices(正解を先頭), why_unique, scenario_tag}
   ※発話/即時は question="" ・choices3つ。課題/ポイント/概要は choices4つ。

使い方:
  python tools/choukai/merge_and_gate.py --new <NEWDIR>            # ゲート(検証)のみ
  python tools/choukai/merge_and_gate.py --new <NEWDIR> --apply   # 検証OKなら合格分だけ追記

QA(合否):
  致命(その問を追記しない): id/level不正・id衝突(既存/バッチ内)・選択肢数(4/3)違い・選択肢重複
  帯外(その問を追記しない): 本文モーラが公式中央値の 80〜120% の帯(floor_080〜ceiling_120)の外
                           ← 新規は公式の±20%以内(ユーザールール 2026-07-27)。既存は据え置き(測らない)。帯幅=BAND_PCT。
                           短すぎ(<下限)=本文に自然文を加筆(答え・一意性・観点は不変)→再gate。
                           長すぎ(>上限)=短縮しない(短縮は一意性を壊す危険)→作り直し。
  参考表示(合否に使わない): 音声化テキストの字数レンジ・場面タグ重複
基準値: tools/choukai/official_mora_baseline.json の official[<daimon>_<level>].floor_085
  ※「本文」= 台本から導入(冒頭の状況ナレーション)と設問・選択肢を除いた台詞のみ。定義は
    official_mora_baseline.json 生成時と揃える(kadai/point/gaiyouは最初の話者行から/発話・即時は台本全体)。
追記: 既存 items[0] を template として deepcopy し id/level/script/question/choices/answerIndex=0 を差替
      (subtype/qtype/audioChoices/title/audio/i18n{} を継承=スキーマ完全一致)。合格分のみ。compact JSONで書き戻し。
"""
import json, os, re, sys, copy, glob, argparse, statistics
from collections import defaultdict
import pykakasi
sys.path.insert(0, os.path.dirname(__file__))
from scene_ledger import classify as scene_classify, SCENE as SCENE_KEYS   # 場面(scenario)の確定に再利用
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass

def resolve_scene(r):
    """新規レコードの場面を確定。scenario_tag が正規カテゴリならそれ、無効/未指定なら台本から分類。"""
    st = (r.get('scenario_tag') or '').strip()
    return st if st in SCENE_KEYS else scene_classify(r.get('script') or '')

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
CDIR = os.path.join(REPO, 'content', 'problems', 'choukai')
BASELINE = os.path.join(os.path.dirname(__file__), 'official_mora_baseline.json')
kks = pykakasi.kakasi(); SMALL = set("ゃゅょぁぃぅぇぉゎ")
def mora(s):
    h = "".join(x['hira'] for x in kks.convert(s))
    return sum(1 for c in h if ('ぁ' <= c <= 'ん' or c == 'ー') and c not in SMALL)
# 行頭の話者ラベル(会話の台詞行か)を判定/除去。役割注記「女1（客）：」も剥がす(strip_furi 後に (…) が残るため。
# 音声側 build_choukai3.turns_of は ^[男女][^：]*： で剥がすので、ゲートもそれに合わせて (…) を任意で消費する)。
SPK = re.compile(r'^\s*(?:[男女][12]?|店員|スタッフ|先生|学生|客|係|係員|母|父|司会|アナウンス|店長|部長|課長|先輩|後輩|医者|受付)(?:（[^）]*）)?\s*[：:]')
LABEL = re.compile(r'^\s*(?:ナレ(?:ーション)?|[男女][12]?|店員|スタッフ|先生|学生|客|係|係員|母|父|司会|アナウンス|店長|部長|課長|先輩|後輩|医者|受付)?(?:（[^）]*）)?\s*[：:]\s*')
# ふりがな＝漢字直後の（かな）。モーラ/字数は必ず「ふりがな無しの素の本文」で比較する
# （公式基準=STT由来で素のため）。中身が仮名だけ かつ 直前が漢字 の括弧のみ除去＝役割注記 女1（先生）は残す。
FURI = re.compile(r'(?<=[一-龥々])（[ぁ-んァ-ヶーゝゞ・]+?）')
def strip_furi(s):
    return FURI.sub('', s or '')
def _lines(script):
    return [l.strip() for l in re.split(r'[\n　]+', strip_furi(script)) if l.strip()]
def spoken(script):
    return ''.join(LABEL.sub('', l) for l in _lines(script))
def body_text(cat, script):
    """モーラ計測の対象=本文のみ。kadai/point/gaiyouは最初の話者行から(導入=状況ナレを落とす)。
    発話/即時は短い状況+投げかけ=台本全体を本文とみなす(official_mora_baseline.json と同じ定義)。"""
    lines = _lines(script)
    if cat in ('kadai', 'point', 'gaiyou'):
        idx = next((i for i, l in enumerate(lines) if SPK.match(l)), None)
        if idx is not None:
            lines = lines[idx:]
        elif cat == 'gaiyou' and len(lines) > 1:
            lines = lines[1:]   # 独話(話者ラベルなし): 先頭の導入ナレを除外
    return ''.join(LABEL.sub('', l) for l in lines)
def body_mora(cat, script):
    return mora(body_text(cat, script))

CHSP = {'gaiyou', 'hatsuwa', 'sokuji'}      # 選択肢も音声化される大問(参考字数に選択肢を加算)
NCH = {'kadai':4,'point':4,'gaiyou':4,'hatsuwa':3,'sokuji':3}
# 公式実測 字数レンジ(参考表示のみ・合否に使わない)。出典: md/10_聴解.md
OFF = {('kadai','N5'):(106,209),('kadai','N4'):(214,270),('kadai','N3'):(190,295),
       ('point','N5'):(109,215),('point','N4'):(192,292),('point','N3'):(253,262),
       ('gaiyou','N3'):(251,295),
       ('hatsuwa','N5'):(43,103),('hatsuwa','N4'):(66,104),('hatsuwa','N3'):(98,113),
       ('sokuji','N5'):(33,90),('sokuji','N4'):(49,90),('sokuji','N3'):(40,90)}

def audio_chars(cat, script, choices):
    c = len(spoken(script))
    if cat in CHSP: c += sum(len(x) for x in choices)
    return c

BAND_PCT = 0.20   # 新規は公式中央値の (1±BAND_PCT) の帯内が合格。緩め/厳しめはここだけ変える。
def load_bands():
    """{ '<daimon>_<level>': (下限, 上限) } 新規はこの帯(公式中央値±BAND_PCT)内が合格。"""
    if not os.path.exists(BASELINE):
        print(f'!! 基準値なし: {BASELINE} が見当たりません(先に公式本文モーラ基準を作成)'); return {}
    off = json.load(open(BASELINE, encoding='utf-8')).get('official', {})
    out = {}
    for k, v in off.items():
        med = v.get('mora_median')
        if med: out[k] = (round(med*(1-BAND_PCT)), round(med*(1+BAND_PCT)))
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--new', required=True, help='new_*.json のあるディレクトリ')
    ap.add_argument('--apply', action='store_true')
    a = ap.parse_args()

    BAND = load_bands()
    existing = set(); seen_scene = defaultdict(set)
    for f in glob.glob(os.path.join(CDIR, '*.json')):
        for it in json.load(open(f, encoding='utf-8'))['items']: existing.add(it['id'])

    problems, stats, plan = [], [], {}
    bad_ids, redo_ids = set(), set()   # bad=致命 / redo=帯外(短すぎ=加筆/長すぎ=短縮)。どちらも追記しない
    for cat in ['kadai','point','gaiyou','hatsuwa','sokuji']:
        p = os.path.join(a.new, f'new_{cat}.json')
        if not os.path.exists(p): continue
        try: recs = json.load(open(p, encoding='utf-8'))
        except Exception as e: problems.append(f'[{cat}] JSON parse error: {e}'); continue
        seen = set()
        for r in recs:
            rid, lv, ch, sc = r.get('id'), r.get('level'), r.get('choices') or [], r.get('script') or ''
            tag = f'{cat} {rid}'
            if not rid or lv not in ('N5','N4','N3'): problems.append(f'{tag}: bad id/level'); bad_ids.add(rid); continue
            if rid in existing or rid in seen: problems.append(f'{tag}: DUP id'); bad_ids.add(rid)
            seen.add(rid)
            if len(ch) != NCH[cat]: problems.append(f'{tag}: choices={len(ch)} != {NCH[cat]}'); bad_ids.add(rid)
            if len(set(ch)) != len(ch): problems.append(f'{tag}: duplicate choice text'); bad_ids.add(rid)
            # 本文モーラ・ゲート(合否)= 公式中央値の85〜115%の帯内
            bm = body_mora(cat, sc); band = BAND.get(f'{cat}_{lv}')
            if band:
                lo, hi = band
                if bm < lo:
                    problems.append(f'{tag} [{lv}] 本文mora={bm} < 下限{lo}(不足{lo-bm}) → 自然文を加筆(答え/一意性不変)'); redo_ids.add(rid)
                elif bm > hi:
                    problems.append(f'{tag} [{lv}] 本文mora={bm} > 上限{hi}(超過{bm-hi}) → 作り直し(短縮は一意性を壊す恐れ)'); redo_ids.add(rid)
            # 場面(scenario)= データに保存される確定値。scenario_tag が無効/未指定なら台本から自動確定。
            st = (r.get('scenario_tag') or '').strip()
            scene = resolve_scene(r)
            if st and st not in SCENE_KEYS:
                problems.append(f'{tag}: scenario_tag <{st}> は正規カテゴリ外→台本から自動確定=<{scene}>(参考)')
            if scene in seen_scene[(cat, lv)]:
                problems.append(f'{tag}: 場面重複 <{scene}>(多様性・参考)')
            seen_scene[(cat, lv)].add(scene)
            # 係→スタッフ(TTSが「係」のアクセントを外す)。新規に「係/係員」が残れば参考警告。
            # 『〜する係』の当番語は動詞句へ言い換える判断が要るので致命にしない(人手判断)。
            kb = strip_furi(sc) + strip_furi(r.get('question') or '') + ''.join(strip_furi(str(x)) for x in ch)
            # 関係(かんけい)/連係/係数/係長 等の複合語は 係=けい/かかりちょう で誤検出。担当語「係(かかり)/係員」だけ拾う。
            if re.search(r'(?<![関連])係(?!数|長|わり)', kb):
                problems.append(f'{tag}: 「係」が残存→スタッフに置換推奨(TTSがアクセントを外す・『〜する係』の当番語は動詞句へ言い換え)(参考)')
            ac = audio_chars(cat, sc, ch)
            stats.append((cat, lv, bm, ac, band))
        plan[cat] = recs

    g = defaultdict(list)
    for cat, lv, bm, ac, band in stats: g[(cat, lv)].append((bm, ac, band))
    print('=== 新規 本文モーラ min/med/max (合格帯=公式中央値の80〜120%) | 参考:字数med ===')
    for cat in ['kadai','point','gaiyou','hatsuwa','sokuji']:
        for lv in ['N5','N4','N3']:
            if (cat, lv) in g:
                v = g[(cat, lv)]; bms = sorted(x[0] for x in v); acs = sorted(x[1] for x in v)
                band = v[0][2]; bandtxt = f'{band[0]}-{band[1]}' if band else '基準なし'
                print(f'  {cat:8} {lv}: n={len(v)} mora {min(bms)}/{int(statistics.median(bms))}/{max(bms)} 帯[{bandtxt}]'
                      f'  | 字数med{int(statistics.median(acs))}')
    print(f'\n新規合計= {sum(len(v) for v in plan.values())}  (致命 {len(bad_ids)} / 帯外(短/長) {len(redo_ids)})')
    print(f'\n=== 問題点 {len(problems)} 件 ===')
    for x in problems: print('  -', x)
    if not problems: print('  (なし)')

    parse_fatal = [x for x in problems if 'parse error' in x]
    if a.apply and parse_fatal:
        print('\n!! JSON parse error があるため APPLY 中止'); return
    if a.apply:
        skip = bad_ids | redo_ids
        byfile = defaultdict(list)
        for cat, recs in plan.items():
            for r in recs:
                if r.get('id') in skip: continue
                byfile[(cat, r['level'])].append(r)
        total = 0
        for (cat, lv), recs in byfile.items():
            fp = os.path.join(CDIR, f'{cat}_{lv}.json')
            data = json.load(open(fp, encoding='utf-8'))
            tmpl = copy.deepcopy(data['items'][0])
            for r in recs:
                it = copy.deepcopy(tmpl)
                it['id'], it['level'], it['script'] = r['id'], lv, r['script']
                it['scenario'] = resolve_scene(r)   # 場面をデータに保存(tmplの継承値を上書き)
                q = it['questions'][0]
                q['id'], q['q'], q['choices'], q['answerIndex'] = r['id']+'-q1', r.get('question','') or '', r['choices'], 0
                data['items'].append(it)
            json.dump(data, open(fp, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
            total += len(recs); print(f'APPLIED {cat}_{lv}: +{len(recs)} -> {len(data["items"])}')
        print(f'=== APPLY 完了: 合格 +{total} / 追記除外(致命+帯外) {len(skip)} ===')
        if skip: print('  帯外/除外id(加筆or短縮で帯内へ→再gate):', ', '.join(sorted(skip)))
    else:
        print('\n(ゲートのみ。--apply で合格分だけ追記)')

if __name__ == '__main__':
    main()
