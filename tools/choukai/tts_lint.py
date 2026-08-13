# -*- coding: utf-8 -*-
"""音声化テキストの誤読チェック（2026-08-13 追加）。音声生成の“前”に回す。

原理：`tts_script.FORCE_KANA`＝Flashが漢字から読めない/外す語（日付の熟字訓・助数詞・異読・係）。
これらは「ルビの読み」を音声に使う設計なので、**to_tts の出力に生の漢字のまま残っていたら誤読になる**
（＝ルビ欠落 or 熟字訓＋接尾語のユニットルビで surface 不一致。例：三日後(みっかご)→FORCE不一致→生「三日後」→さんにち誤読）。
このツールは to_tts を通した音声テキストに FORCE_KANA 語が“生”で残っていないか走査して警告する。

使い方:
  python tools/choukai/tts_lint.py            # 正本 kadai_*.json を点検
  python tools/choukai/tts_lint.py --new <DIR># <DIR>/new_kadai.json(簡易レコード配列)を点検
出力: id ごとに、生で残った FORCE_KANA 語（＝要ルビ修正 or 言い換え）。0件なら OK。
※直し方：日付は熟字訓部分だけを FORCE_KANA の単位でルビ（三日(みっか)後(ご)）か、言い換え（三日(みっか)で）。
"""
import os, sys, re, json, glob, argparse
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, '問題', 'tools'))
sys.path.insert(0, HERE)
import tts_script as TS                 # to_tts / FORCE_KANA
from merge_and_gate import strip_furi   # 素化（比較用ではなく行分割の補助）
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass

LEVELS = ['N5', 'N4', 'N3']
LAB = re.compile(r'^\s*[男女][^：:\n]*[：:]')   # 音声側 turns_of と同じ：男/女始まりの話者ラベルを剥がす
CHSP = {'gaiyou', 'hatsuwa', 'sokuji'}          # 選択肢も音声化される大問

def audio_text(cat, script, question, choices):
    """gen が読み上げる素材（導入＋本文＋設問〔＋選択肢〕）を to_tts 済みで返す。"""
    parts = []
    for ln in str(script).split('\n'):
        s = ln.strip()
        if not s:
            continue
        parts.append(TS.to_tts(LAB.sub('', s)))   # ラベルを剥がしてから音声化
    parts.append(TS.to_tts(str(question or '')))
    if cat in CHSP:
        parts += [TS.to_tts(str(c)) for c in (choices or [])]
    return ' '.join(parts)

def raw_force_kana(text):
    """to_tts 出力に残った FORCE_KANA 語（＝force-kana 不発＝誤読源）を返す。
    漢数字直前は除外（二十一日 の中の『一日』等の部分一致を弾く）。"""
    hits = []
    for w in TS.FORCE_KANA:
        for m in re.finditer(re.escape(w), text):
            i = m.start()
            if i > 0 and text[i - 1] in '一二三四五六七八九十':
                continue   # より大きな数の一部＝別語（正規の読みでOK）
            if w == '係':  # 関係/連係(かんけい)・係数/係長/係わり(けい/かかりちょう/かかわり)は誤検出
                prev = text[i - 1] if i > 0 else ''
                nxt = text[m.end()] if m.end() < len(text) else ''
                if prev in '関連' or nxt in '数長わ':
                    continue
            hits.append(w)
    return sorted(set(hits))

def load_bank():
    out = []
    base = os.path.join(ROOT, 'content', 'problems', 'choukai')
    for f in sorted(glob.glob(os.path.join(base, 'kadai_*.json'))):
        d = json.load(open(f, encoding='utf-8'))
        for it in d.get('items', []):
            q = (it.get('questions') or [{}])[0]
            out.append(('kadai', it['id'], it.get('script', ''), q.get('q', ''), q.get('choices', [])))
    return out

def load_new(dirpath):
    out = []
    p = os.path.join(dirpath, 'new_kadai.json')
    if not os.path.exists(p):   # per-level にも対応
        recs = []
        for lv in LEVELS:
            pl = os.path.join(dirpath, f'new_kadai_{lv}.json')
            if os.path.exists(pl):
                recs += json.load(open(pl, encoding='utf-8'))
    else:
        recs = json.load(open(p, encoding='utf-8'))
    for r in recs:
        out.append((r.get('daimon', 'kadai'), r.get('id'), r.get('script', ''), r.get('question', ''), r.get('choices', [])))
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--new', help='new_kadai.json のあるディレクトリ')
    a = ap.parse_args()
    recs = load_new(a.new) if a.new else load_bank()
    src = f'新規 {a.new}' if a.new else '正本 kadai_*.json'
    flagged = 0
    print(f'=== TTS誤読リント [{src}] n={len(recs)} ===')
    for cat, rid, script, q, ch in recs:
        raw = raw_force_kana(audio_text(cat, script, q, ch))
        if raw:
            flagged += 1
            print(f'  ⚠{rid}: 生のFORCE_KANA語 {raw} → ルビ欠落/ユニットルビ不一致。熟字訓は単位でルビ or 言い換え')
    print(f'--- 生残り {flagged}/{len(recs)} 件 ---' + ('' if flagged else '  ✅誤読源なし'))

if __name__ == '__main__':
    main()
