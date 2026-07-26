# -*- coding: utf-8 -*-
"""語彙例文レビューの修正(tools/vocab_out/batch_*.json)を取り込む。
  各修正 {id, ja, en} について:
    - vocabExamplesAi.json[id] = {ja, en}
    - MeCab(fugashi)でふりがなを付与 → vocabFurigana.json[id]
    - 見出し語の読み一致を検証(C3対策): 単一漢字語は annotate(w,r) が furigana文に含まれるか
  既定=ドライラン(集計+読み不一致フラグのみ)。--write で実書込。
"""
import os, sys, json, glob
import fugashi

ROOT = r'C:\Users\jwpsa\Documents\desktop\claude\JLPTアプリ'
D = os.path.join(ROOT, 'app', 'src', 'data')
OUT = os.path.join(ROOT, 'tools', 'vocab_out')
tagger = fugashi.Tagger()

def kata2hira(s): return ''.join(chr(ord(c) - 0x60) if 'ァ' <= c <= 'ヶ' else c for c in s)
def has_kanji(s): return any(('㐀' <= c <= '鿿') or ('豈' <= c <= '﫿') for c in s)
def is_kana(c): return ('ぁ' <= c <= 'ゟ') or ('ァ' <= c <= 'ヿ')

def annotate(surface, reading):
    if not has_kanji(surface) or not reading: return surface
    suf = 0
    while (suf < len(surface) and suf < len(reading)
           and surface[-1-suf] == reading[-1-suf] and is_kana(surface[-1-suf])): suf += 1
    pre = 0
    while (pre < len(surface)-suf and pre < len(reading)-suf
           and surface[pre] == reading[pre] and is_kana(surface[pre])): pre += 1
    core_s = surface[pre:len(surface)-suf]; core_r = reading[pre:len(reading)-suf]
    if not has_kanji(core_s) or not core_r: return surface
    tail = surface[len(surface)-suf:] if suf else ''
    return f'{surface[:pre]}{core_s}（{core_r}）{tail}'

def furigana(text):
    out = []
    for w in tagger(text):
        s = w.surface
        if not has_kanji(s): out.append(s); continue
        kana = getattr(w.feature, 'kana', None) or ''
        r = kata2hira(kana) if kana and kana != '*' else ''
        out.append(annotate(s, r))
    return ''.join(out)

def main():
    write = '--write' in sys.argv
    vocab = {v['id']: v for v in json.load(open(os.path.join(D, 'vocab.json'), encoding='utf-8'))}
    exai = json.load(open(os.path.join(D, 'vocabExamplesAi.json'), encoding='utf-8'))
    furi = json.load(open(os.path.join(D, 'vocabFurigana.json'), encoding='utf-8'))

    fixes = []; parse_err = []
    for f in sorted(glob.glob(os.path.join(OUT, 'batch_*.json'))):
        try:
            arr = json.load(open(f, encoding='utf-8'))
            if isinstance(arr, list): fixes.extend(arr)
            else: parse_err.append(os.path.basename(f) + ': not array')
        except Exception as e:
            parse_err.append(os.path.basename(f) + ': ' + str(e))

    applied = 0; read_flag = []; missing_word = []; reasons = {}
    for fx in fixes:
        vid = fx.get('id'); ja = (fx.get('ja') or '').strip(); en = (fx.get('en') or '').strip()
        if not vid or vid not in vocab or not ja: continue
        v = vocab[vid]; w = (v.get('word') or '').replace('～', '').replace('~', ''); r = (v.get('reading') or '').replace('～', '').replace('~', '')
        reasons[fx.get('reason', '?')[:1]] = reasons.get(fx.get('reason', '?')[:1], 0) + 1
        fu = furigana(ja)
        # 見出し語が文中にあるか(かな語/漢字語とも surface で)
        if w and w not in ja: missing_word.append(f'{vid} {w}: 文に無い → {ja}')
        # 読み一致検証(単一/短い漢字語): annotate(w,r) が furigana に含まれるか
        if has_kanji(w) and len(w) <= 2:
            if annotate(w, r) not in fu and f'{w}（{r}' not in fu:
                read_flag.append(f'{vid} {w}({r}): 読み未確認 → {fu}')
        if write:
            exai[vid] = {'ja': ja, **({'en': en} if en else {})}
            furi[vid] = fu if has_kanji(ja) else ja
        applied += 1

    print(f'修正取り込み: {applied}語 (parseErr {len(parse_err)})')
    print('理由内訳:', reasons)
    print(f'見出し語が文に無い: {len(missing_word)}')
    for x in missing_word[:15]: print('  ' + x)
    print(f'読み未確認(要目視): {len(read_flag)}')
    for x in read_flag[:25]: print('  ' + x)
    if parse_err:
        print('parseErr:'); [print('  ' + x) for x in parse_err]
    if write and not parse_err:
        json.dump(exai, open(os.path.join(D, 'vocabExamplesAi.json'), 'w', encoding='utf-8'), ensure_ascii=False)
        json.dump(furi, open(os.path.join(D, 'vocabFurigana.json'), 'w', encoding='utf-8'), ensure_ascii=False)
        print('\n書込完了: vocabExamplesAi.json / vocabFurigana.json')
    elif write:
        print('\n⚠ parseErr のため未書込')

if __name__ == '__main__':
    main()
