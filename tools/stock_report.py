# -*- coding: utf-8 -*-
"""大問ごとの在庫問題数レポートを作る（機械処理・LLMトークン0）。

出力: memory/在庫問題数.txt
使い方:
  python tools/stock_report.py              集計して書き出す
  python tools/stock_report.py --quiet      標準出力を出さない（hook用）
  python tools/stock_report.py --if-changed 問題ファイルが更新された時だけ集計（hook用）

■ 「在庫問題数」の定義（2026-07-19 ユーザー決定）
  在庫＝**公式問題にそって新しく作成した問題**だけ。次は在庫に数えない。
    (1) 公式問題にそっていない既存データ … 漢字読み・表記（辞書から機械生成した分）
    (2) 監査に落ちた問題 … hold 付き / ambiguous=True / verified=False
  旧データ（文法形式・組み立て）は**監査に合格した分だけ**在庫に数える。
  未検証（verified 欄はあるが true が付いていない）は在庫に含めつつ別掲する。
  在庫外はファイル末尾の「参考」に件数だけ残す（消えたと誤解しないため）。

記録する内容
  - 在庫問題数 / 未検証数（verified 欄を持つ大問のみ）
  - 在庫の誤答数の分布（データ上の choices 数 - 1）
  - 出題時の選択肢数とシャッフルの有無（アプリ側の実装に基づく固定表）
  - データ上の正解位置の偏り（シャッフルなしの大問では致命的なので必ず見る）
  - needsWork などのフラグ、ファイル更新日時
"""
import io, json, os, sys, glob, datetime, subprocess
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# 修正(2026-07-21): 旧 os.path.join(ROOT,'app') はハルク被害の傷んだ複製 app/ を読んでいた。
# 本番アプリのコンテンツは root 直下（content/problems/…）＝git追跡ファイル。ここを見る。
APP = ROOT
OUT = os.path.join(ROOT, 'memory', '在庫問題数.txt')

# 大問の表示名・出題形式。シャッフル欄の根拠:
#   単問系      app/src/data/daimon.ts:182  build4Choices -> shuffleChoices（4択に間引く）
#   読解/文章文法 app/src/components/PassageSetPlayer.tsx:27
#   聴解        app/src/screens/ListeningScreen.tsx:51（audioChoices の時だけシャッフルしない）
DAIMON = {
    'kanji_read':       ('漢字読み',       'single', True,  '4'),
    'orthography':      ('表記',           'single', True,  '4'),
    'context':          ('文脈規定',       'single', True,  '4'),
    'synonym':          ('言い換え類義',   'single', True,  '4'),
    'usage':            ('用法',           'single', True,  '4'),
    'grammar_form':     ('文法形式',       'single', True,  '4'),
    'order':            ('組み立て',       'single', True,  '4'),
    'passage_grammar':  ('文章の文法',     'set',    True,  '在庫のまま'),
    'naiyou_tan':       ('内容理解(短文)', 'set',    True,  '在庫のまま'),
    'naiyou_chu':       ('内容理解(中文)', 'set',    True,  '在庫のまま'),
    'choubun':          ('内容理解(長文)', 'set',    True,  '在庫のまま'),
    'joho':             ('情報検索',       'set',    True,  '在庫のまま'),
    'kadai':            ('課題理解',       'set',    True,  '在庫のまま'),
    'point':            ('ポイント理解',   'set',    True,  '在庫のまま'),
    'gaiyou':           ('概要理解',       'set',    True,  '在庫のまま'),
    'hatsuwa':          ('発話表現',       'set',    False, '在庫のまま'),
    'sokuji':           ('即時応答',       'set',    False, '在庫のまま'),
}
SECTION = {'moji_goi': '文字・語彙', 'bunpou': '文法', 'dokkai': '読解', 'choukai': '聴解'}
ORDER = ['kanji_read', 'orthography', 'context', 'synonym', 'usage',
         'grammar_form', 'order', 'passage_grammar',
         'naiyou_tan', 'naiyou_chu', 'choubun', 'joho',
         'kadai', 'point', 'gaiyou', 'hatsuwa', 'sokuji']
LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']

# 公式問題にそっていない既存データ。在庫に数えず、末尾の参考に件数だけ出す。
NOT_OFFICIAL = {
    'kanji_read':  '辞書から機械生成した既存データ（公式問題にそって作り直していない）',
    'orthography': '辞書から機械生成した既存データ（公式問題にそって作り直していない）',
}


def rejected(q):
    """監査に落ちた問題か。落ちた理由（表示用）を返す。合格なら None。"""
    if q.get('hold'):
        return 'hold'              # 文法形式: 第2の正解が残り手直し保留
    if q.get('ambiguous') is True:
        return 'ambiguous'         # 組み立て: 並びが一意に定まらない
    if q.get('verified') is False:
        return 'verified=False'    # 反証で落ちた
    return None


_CREATED = {}


def history(path):
    """その大問・レベルのファイルの git 履歴 → (作成日時, 最終コミット日時, コミット回数)。

    作成日時＝そのファイルが最初にコミットされた日時。
    ※2026-07-14 が並ぶのは、その日に問題コンテンツを新フォーマット（content/problems/…）へ
      一括生成し直したため。それより前の作成履歴はこのパスには残っていない（旧データは別の場所）。
    git に無い（未コミットの新規）ファイルはローカルの作成時刻に「?」を付ける。
    """
    rel = os.path.relpath(path, ROOT).replace('\\', '/')
    if rel in _CREATED:
        return _CREATED[rel]
    first = last = None
    n = 0
    try:
        r = subprocess.run(['git', 'log', '--format=%ad', '--date=format:%Y-%m-%d %H:%M', '--', rel],
                           cwd=ROOT, capture_output=True, text=True, timeout=60)
        lines = [x.strip() for x in r.stdout.splitlines() if x.strip()]
        if lines:
            n = len(lines)
            last, first = lines[0], lines[-1]   # git log は新しい順
    except Exception:
        pass
    if not first:
        first = datetime.datetime.fromtimestamp(os.path.getctime(path)).strftime('%Y-%m-%d %H:%M') + '?'
        last = '未コミット'
    got = (first, last, n)
    _CREATED[rel] = got
    return got


def dist(counter):
    """{3: 100, 4: 5} -> '3択100 / 4択5' のような短い文字列"""
    return ' / '.join('%s:%d' % (k, counter[k]) for k in sorted(counter))


def scan(path):
    d = json.load(io.open(path, encoding='utf-8'))
    items = d.get('items') or []
    sets_n = 0
    qs = []          # 集計対象の設問（単問はitem自身、セットはitem内のquestions）
    for it in items:
        if not isinstance(it, dict):
            continue
        sub = it.get('questions')
        if isinstance(sub, list):
            sets_n += 1
            qs.extend(q for q in sub if isinstance(q, dict))
        else:
            qs.append(it)

    wrong = Counter()      # 誤答数の分布
    anspos = Counter()     # データ上の正解位置（0始まり）
    ver_true = ver_false = ver_none = 0
    flags = Counter()
    broken = 0            # 正解が選択肢に無い等の壊れ
    out = Counter()       # 在庫外（監査に落ちた分）の理由別件数

    # 監査に落ちた問題は在庫ではない。以降の集計から丸ごと外す。
    kept = []
    for q in qs:
        why = rejected(q)
        if why:
            out[why] += 1
        else:
            kept.append(q)
    qs = kept

    for q in qs:
        ch = q.get('choices')
        if isinstance(ch, list) and ch:
            # 2形式ある:
            #  (a) choices に正解が含まれる（answerIndex を持つセット問題）→ 誤答=len-1・正解位置が意味を持つ
            #  (b) choices は誤答プールだけ（単問系。正解は answer フィールド）→ 誤答=len・正解位置は無い
            if 'answerIndex' in q:
                wrong[len(ch) - 1] += 1
                anspos[q['answerIndex']] += 1
            elif isinstance(q.get('answer'), str) and q['answer'] in ch:
                wrong[len(ch) - 1] += 1
                anspos[ch.index(q['answer'])] += 1
            elif 'answer' in q:
                wrong[len(ch)] += 1   # 誤答プール形式
            else:
                broken += 1
        v = q.get('verified')
        if v is True:
            ver_true += 1
        elif v is False or 'verified' in q:
            ver_false += 1
        else:
            ver_none += 1
        for k in ('needsWork', 'ambiguous'):
            if q.get(k):
                flags['%s=%s' % (k, q[k])] += 1

    # verified 欄そのものが無い大問と、あるのに未検証の大問を区別する
    has_ver = (ver_true + ver_false) > 0
    unverified = (len(qs) - ver_true) if has_ver else None
    return dict(sets=sets_n, n=len(qs), has_ver=has_ver, verified=ver_true,
                unverified=unverified, wrong=wrong, anspos=anspos,
                flags=flags, broken=broken, out=out, hist=history(path),
                mtime=datetime.datetime.fromtimestamp(os.path.getmtime(path)))


def main():
    files = sorted(glob.glob(os.path.join(APP, 'content', 'problems', '*', '*.json')))

    # --if-changed: 問題ファイルが前回集計より新しい時だけ走る（Stop hookの空回りを防ぐ）
    if '--if-changed' in sys.argv and os.path.exists(OUT) and files:
        if max(os.path.getmtime(p) for p in files) <= os.path.getmtime(OUT):
            return

    rows = {}
    for p in files:
        base = os.path.basename(p)[:-5]
        for lv in LEVELS:
            if base.endswith('_' + lv):
                key = base[: -(len(lv) + 1)]
                if key in DAIMON:
                    rows[(key, lv)] = scan(p)
                break

    L = []
    now = datetime.datetime.now().strftime('%Y-%m-%d %H:%M')
    L.append('まいにちJLPT 在庫問題数（自動生成 / tools/stock_report.py）')
    L.append('最終更新: ' + now)
    L.append('')
    L.append('■ 在庫＝公式問題にそって新しく作成した問題だけ。次は在庫に数えない。')
    L.append('   ・公式問題にそっていない既存データ（漢字読み・表記＝辞書から機械生成）')
    L.append('   ・監査に落ちた問題（hold / ambiguous=True / verified=False）')
    L.append('   在庫外の件数はファイル末尾の「参考」に出す。')
    L.append('')
    L.append('※「未検証」= verified が付いていない在庫。出題ゲートONの大問では出題されない。')
    L.append('※「誤答数」= 在庫データの選択肢数-1。単問系は出題時に4択へ間引かれる。')
    L.append('※「正解位置」= データ上の正解の位置。シャッフルなしの大問はここが偏ると即バレる。')
    L.append('※「作成」= その大問・レベルのファイルが最初にコミットされた日時。')
    L.append('   2026-07-14 が並ぶのは、その日に問題コンテンツを新フォーマット（content/problems/…）へ一括で')
    L.append('   作り直したため。それより前の作成履歴はこのパスには残っていない。')
    L.append('※「最終」= 最後にそのファイルを変えたコミットの日時と、これまでのコミット回数。')
    L.append('※「更新」= 手元のファイルの更新時刻（コミット前の編集もここに出る）。')
    L.append('')

    tot_n = tot_unv = 0
    cur_sec = None
    for key in ORDER:
        if key in NOT_OFFICIAL:
            continue
        name, kind, shuf, shown = DAIMON[key]
        got = [(lv, rows[(key, lv)]) for lv in LEVELS if (key, lv) in rows]
        if not got:
            continue
        sec = next((s for s in SECTION
                    if os.path.exists(os.path.join(APP, 'content', 'problems', s, '%s_%s.json' % (key, got[0][0])))), '')
        if sec != cur_sec:
            cur_sec = sec
            L.append('=' * 60)
            L.append('■ ' + SECTION.get(sec, sec))
            L.append('=' * 60)
        L.append('')
        L.append('【%s】 表示選択肢=%s / シャッフル=%s' % (name, shown, 'あり' if shuf else 'なし'))
        for lv, r in got:
            tot_n += r['n']
            unv = '未検証%d' % r['unverified'] if r['has_ver'] else '検証欄なし'
            if r['has_ver']:
                tot_unv += r['unverified']
            head = '  %s: 在庫%d問' % (lv, r['n'])
            if kind == 'set':
                head += '（%dセット）' % r['sets']
            first, last, ncom = r['hist']
            L.append('%s / %s / 更新 %s' % (head, unv, r['mtime'].strftime('%m-%d %H:%M')))
            L.append('       作成 %s ／ 最終 %s（コミット%d回）' % (first, last, ncom))
            L.append('       誤答数 %s ｜ 正解位置 %s' % (dist(r['wrong']) or '-', dist(r['anspos']) or '-'))
            if r['broken']:
                L.append('       ※正解フィールドが無い壊れた問題 %d 件' % r['broken'])
            if r['out']:
                L.append('       ※在庫外（監査に落ちた分）'
                         + ', '.join('%s×%d' % (k, v) for k, v in sorted(r['out'].items())))
            if r['flags']:
                L.append('       ※フラグ ' + ', '.join('%s×%d' % (k, v) for k, v in r['flags'].items()))
    L.append('')
    L.append('=' * 60)
    L.append('合計 在庫 %d問 / 未検証 %d問（検証欄のある大問のみ）' % (tot_n, tot_unv))

    # 在庫外の参考（消えたと誤解しないため、件数だけ残す）
    L.append('')
    L.append('=' * 60)
    L.append('■ 参考：在庫に数えないデータ')
    L.append('=' * 60)
    for key in ORDER:
        got = [(lv, rows[(key, lv)]) for lv in LEVELS if (key, lv) in rows]
        if not got:
            continue
        if key in NOT_OFFICIAL:
            n = sum(r['n'] + sum(r['out'].values()) for _, r in got)
            L.append('【%s】 %d問（%s）… %s'
                     % (DAIMON[key][0], n,
                        ' / '.join('%s %d' % (lv, r['n'] + sum(r['out'].values())) for lv, r in got),
                        NOT_OFFICIAL[key]))
        else:
            out = Counter()
            for _, r in got:
                out.update(r['out'])
            if out:
                L.append('【%s】 監査に落ちて在庫外 %d問（%s）'
                         % (DAIMON[key][0], sum(out.values()),
                            ', '.join('%s×%d' % (k, v) for k, v in sorted(out.items()))))

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    io.open(OUT, 'w', encoding='utf-8', newline='\r\n').write('\n'.join(L) + '\n')
    if '--quiet' not in sys.argv:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        print('wrote %s (%d daimon-level rows, %d items, %d unverified)' % (OUT, len(rows), tot_n, tot_unv))


if __name__ == '__main__':
    main()
