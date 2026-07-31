# -*- coding: utf-8 -*-
"""文脈規定の作り直し結果を journal.jsonl から回収し、アプリのデータへ焼き込む（0トークン）。

やること:
  1. journal.jsonl から gen の items と、反証2回分の verdicts を回収
  2. 【和集合】どちらかの反証が valid と言った誤答は全部削除（削除のみ・追加なし＝新バグが構造的に入らない）
  3. 残り3個未満 / bad_answer は【データを変更せず】人手送りの報告書へ
  4. ふりがなを MeCab で機械生成（0トークン）
  5. context_<LV>.json へ merge（prompt/answer/choices を差し替え、古い解説 i18n は削除）
  6. sentenceFuri.json を更新
  7. 検証（〔　〕が1個 / 正解が誤答に混入していない / 誤答3〜5個 / nullガード）

使い方:
  python tools/bake_context.py wf_40c81941-e5a --level N4            # ドライラン（書き込まない）
  python tools/bake_context.py wf_40c81941-e5a --level N4 --write    # 実際に書き込む
"""
import argparse, io, json, os, re, sys
from collections import Counter

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
sys.path.insert(0, os.path.join(ROOT, 'data-build'))
from harvest_workflow import find_journal, harvest  # noqa: E402
from gen_furigana import furigana, has_kanji        # noqa: E402

BLANK = '〔　〕'


def collect(results):
    """【生成→反証+修正→再反証フロー対応】
    - 修理済み items（status付き＝反証+修正段の最終版）を最終ベースにする
    - 再反証の verdicts（validChoices）を集める
    - gen の生 items（status無し）は、修理agentが落ちた時のフォールバック＋word補完にだけ使う
    """
    gen, repaired, verdicts = {}, {}, {}
    for res in results.values():
        if not isinstance(res, dict):
            continue
        for it in res.get('items') or []:
            if not (isinstance(it, dict) and it.get('id')):
                continue
            (repaired if 'status' in it else gen)[it['id']] = it
        for v in res.get('results') or []:
            if isinstance(v, dict) and v.get('id'):
                verdicts.setdefault(v['id'], []).append(v)
    base = dict(gen)                       # 修理が落ちた分の救済（生成版で埋める）
    for iid, r in repaired.items():
        r.setdefault('word', gen.get(iid, {}).get('word'))
        base[iid] = r                      # 修理済みで上書き＝最終版
    return base, verdicts


def apply_union(items, verdicts):
    """和集合で削除。1回でも valid と言われた誤答は落とす（損害は非対称＝迷ったら消す）。"""
    good, flagged = [], []
    for iid, it in items.items():
        vs = verdicts.get(iid, [])
        if any(v.get('verdict') == 'bad_answer' for v in vs):
            flagged.append({**it, 'issue': 'bad_answer',
                            'note': next((v.get('note') for v in vs if v.get('verdict') == 'bad_answer'), '')})
            continue
        bad = set()
        for v in vs:
            bad.update(v.get('validChoices') or [])
        left = [c for c in (it.get('choices') or []) if c not in bad]
        if len(left) < 3:
            flagged.append({**it, 'issue': 'under3', 'left': left,
                            'deleted': sorted(bad), 'note': ' / '.join(filter(None, (v.get('note') for v in vs)))})
            continue
        good.append({**it, 'choices': left, 'deletedCount': len(bad), 'verifyRuns': len(vs)})
    return good, flagged


def validate(good):
    """出荷前チェック。壊れたものは good から外す（中途半端に壊れた問題を残さない）。"""
    ok, bad = [], []
    for it in good:
        p, a, ch = it.get('prompt') or '', it.get('answer') or '', it.get('choices') or []
        why = None
        if p.count(BLANK) != 1:
            why = f'空所が{p.count(BLANK)}個（1個でない）'
        elif not a:
            why = '正解が空'
        elif a in ch:
            why = '正解が誤答に混入'
        elif len(ch) != len(set(ch)):
            why = '誤答が重複'
        elif not (3 <= len(ch) <= 5):
            why = f'誤答が{len(ch)}個（3〜5個でない）'
        elif '（' in p or '(' in p:
            why = 'promptにルビらしき括弧（機械生成と衝突する）'
        (bad if why else ok).append({**it, 'why': why} if why else it)
    return ok, bad


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('run', help='runId か journal.jsonl のパス')
    ap.add_argument('--level', default='N4')
    ap.add_argument('--polish', help='仕上げ走行のrunId（揃い監査＋ルビ。wf_polish_*.mjs の結果）')
    ap.add_argument('--write', action='store_true', help='実際に書き込む（既定はドライラン）')
    args = ap.parse_args()
    LV = args.level.upper()

    jp = find_journal(args.run)
    results, started, unfinished = harvest(jp)
    items, verdicts = collect(results)
    print(f'journal   : {jp}')
    print(f'agent起動 : {len(started)}  完了: {len(results)}  未完(=落ちた): {len(unfinished)}')
    if unfinished:
        print(f'  ⚠ 未完のagent: {unfinished} → resumeFromRunId で再開できます')
    print(f'回収items : {len(items)}   判定された問題数: {len(verdicts)}')
    nruns = Counter(len(v) for v in verdicts.values())
    print(f'反証回数の分布: {dict(nruns)}（2=両方の反証を通った）')

    good, flagged = apply_union(items, verdicts)
    good, broken = validate(good)
    flagged += broken

    dels = Counter(it.get('deletedCount', 0) for it in good)
    print(f'\n=== 結果 ===')
    print(f'  確定      : {len(good)}問')
    print(f'  人手送り  : {len(flagged)}問（データは変更しない）')
    print(f'  削除数の分布（確定分）: {dict(sorted(dels.items()))}  ※0=反証が何も見つけなかった')
    if flagged:
        print(f'  人手送りの内訳: {dict(Counter(f.get("issue") or f.get("why") for f in flagged))}')

    # --- 仕上げ走行（揃い監査＋ルビ）を回収 ---
    audit, ruby_src = {}, {}
    if args.polish:
        pres, _pst, punf = harvest(find_journal(args.polish))
        if punf:
            print(f'  ⚠ 仕上げ走行に未完のagent: {len(punf)}体 → resumeFromRunId で再開できます')
        for res in pres.values():
            if not isinstance(res, dict):
                continue
            for r in res.get('results') or []:
                if isinstance(r, dict) and r.get('id'):
                    audit[r['id']] = r
            for r in res.get('items') or []:
                if isinstance(r, dict) and r.get('id') and r.get('furi'):
                    ruby_src[r['id']] = r['furi']

    # 揃い監査を適用。guessable=出題しない / partly=場違いな誤答を削るだけ（追加しない＝新バグなし）
    if audit:
        kept, n_al, n_pa, n_gu, n_cut = [], 0, 0, 0, 0
        for it in good:
            r = audit.get(it['id'])
            if not r:
                kept.append(it); continue
            v = r.get('verdict')
            if v == 'guessable':
                n_gu += 1
                flagged.append({**it, 'issue': 'guessable(当てずっぽうで消せる)', 'note': r.get('note')})
                continue
            off = set(r.get('offenders') or [])
            if v == 'partly' and off:
                n_pa += 1
                left = [c for c in it['choices'] if c not in off]
                if len(left) < 3:
                    flagged.append({**it, 'issue': 'partly→誤答3個未満', 'left': left,
                                    'deleted': sorted(off), 'note': r.get('note')})
                    continue
                n_cut += len(it['choices']) - len(left)
                kept.append({**it, 'choices': left, 'alignCut': sorted(off)})
                continue
            n_al += 1
            kept.append(it)
        good = kept
        print(f'\n=== 揃い監査（全{len(audit)}問） ===')
        print(f'  aligned={n_al} / partly={n_pa}（場違いな誤答を計{n_cut}個削除） / guessable={n_gu}（出題しない）')
        print(f'  → 確定 {len(good)}問 / 人手送り {len(flagged)}問')

    # ふりがな = Opusが書いたものを受け取り、機械で検算する。
    # MeCab単体は使わない（既存N4 646件で検証したところ読み違い・振り漏らしが118件=18%あった）。
    furi, furi_bad = {}, []
    need = {it['id']: it['prompt'] for it in good if has_kanji(it['prompt'])}
    if args.polish:
        src = ruby_src
        for iid, p in need.items():
            f = src.get(iid)
            if not f:
                furi_bad.append((iid, p, None, 'ルビが返ってこなかった'))
            elif re.sub(r'[（(][^）)]*[）)]', '', f) != p:
                # 括弧を除いたら本文と一致しなければならない（既存スクリプトと同じ検算）
                furi_bad.append((iid, p, f, '括弧を除いた文が本文と一致しない'))
            else:
                furi[iid] = f
        print(f'  ふりがな: {len(furi)}/{len(need)}件がOpus生成＋検算OK')
        if furi_bad:
            print(f'  ⚠ ルビが不正: {len(furi_bad)}件 → この問題は出題しない（verifiedを付けない）')
            for iid, p, f, why in furi_bad[:3]:
                print(f'     {iid}: {why}\n       本文: {p}\n       ルビ: {f}')
    else:
        print(f'  ⚠ --polish が未指定。揃い監査もふりがな（{len(need)}件）も未反映です。')
        print(f'     MeCab単体は読み違い18%のため使いません。先に wf_polish_{LV}.mjs を回してください。')

    bad_ids = {iid for iid, _, _, _ in furi_bad}
    if bad_ids:
        flagged += [{**it, 'issue': 'ruby不正'} for it in good if it['id'] in bad_ids]
        good = [it for it in good if it['id'] not in bad_ids]
    if good:
        s = good[0]
        print(f'\n  例: {s["prompt"]}')
        print(f'      正解={s["answer"]} 誤答={s["choices"]} 手口={s.get("trick")} 鍵={s.get("key")}')
        if s['id'] in furi:
            print(f'      ルビ={furi[s["id"]]}')

    outdir = os.path.join(ROOT, 'scratchpad/context_regen')
    os.makedirs(outdir, exist_ok=True)
    with io.open(os.path.join(outdir, f'baked_{LV}.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump({'good': good, 'flagged': flagged}, f, ensure_ascii=False, indent=1)
    print(f'\n  回収データ: {os.path.join(outdir, f"baked_{LV}.json")}')

    if not args.write:
        print('\n※ ドライランです。書き込むには --write を付けてください。')
        return

    # ルビ無しで書き込むと、レベル以上の漢字にルビが出ない問題を出荷することになる（CLAUDE.md の必須要件違反）
    if need and not args.polish:
        sys.exit('中止: --polish が未指定です。ルビ無しでは出荷できません（漢字にルビが出ない）。')

    # --- 書き込み ---
    cpath = os.path.join(ROOT, f'content/problems/moji_goi/context_{LV}.json')
    doc = json.load(io.open(cpath, encoding='utf-8'))
    by_id = {it['id']: it for it in good}
    n_rep = 0
    for e in doc['items']:
        g = by_id.get(e['id'])
        if not g:
            continue
        e['prompt'] = g['prompt']
        e['answer'] = g['answer']
        e['choices'] = g['choices']
        e['verified'] = True
        e.pop('i18n', None)   # 古い解説は誤答が変わったので削除（残すと存在しない選択肢の説明が出る）
        e.pop('needsWork', None)  # 前回フラグの残留を消す。今回verified化＝健全化したので不要。残すとcontextGate.testが矛盾で落ちる
        n_rep += 1
    with io.open(cpath, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
    print(f'  → {cpath} を更新（{n_rep}問を差し替え・verified=true）')

    fpath = os.path.join(ROOT, 'src/data/dict/sentenceFuri.json')
    sf = json.load(io.open(fpath, encoding='utf-8'))
    for k, v in furi.items():
        sf[k] = v
    for it in good:                      # 漢字が無くなった文の古いルビは消す
        if it['id'] not in furi:
            sf.pop(it['id'], None)
    with io.open(fpath, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(sf, f, ensure_ascii=False)
    print(f'  → {fpath} を更新（{len(furi)}件）')

    if flagged:
        rp = os.path.join(ROOT, f'文脈規定_{LV}_人手が必要な問題.md')
        with io.open(rp, 'w', encoding='utf-8', newline='\n') as f:
            f.write(f'# 文脈規定{LV} — 人手が必要な問題（{len(flagged)}問）\n\n')
            f.write('反証で第2の正解を削ったら誤答が3個未満になった、または文自体が破綻していた問題。\n')
            f.write('**データは変更していません**（中途半端に壊した問題を残さないため）。\n\n')
            for x in flagged:
                f.write(f'## {x["id"]}（{x.get("word")}）— {x.get("issue") or x.get("why")}\n')
                f.write(f'- 文: {x.get("prompt")}\n- 正解: {x.get("answer")}\n')
                f.write(f'- 誤答（生成時）: {x.get("choices")}\n')
                if x.get('left') is not None:
                    f.write(f'- 生き残り: {x["left"]}\n- 削除された: {x.get("deleted")}\n')
                if x.get('note'):
                    f.write(f'- 反証の指摘: {x["note"]}\n')
                f.write('\n')
        print(f'  → 人手送りの報告書: {rp}')


if __name__ == '__main__':
    main()
