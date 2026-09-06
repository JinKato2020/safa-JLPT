# 翻訳を回した後、⑥翻訳状況シートの該当セクションの「出力字数／概算実費」2行サマリに、
# 言語ごとの値を自動記入する。記入場所はセクションのヘッダ行から言語→列を動的に特定する
# （③辞書=G列, ④大問=H列… とセクションで列位置が違うため決め打ちしない）。
#
# 使い方:
#   python tools/update_trans_status.py <section> <lang> [--yen N] [--chars N]
#     section = dict(③辞書) | daimon(④大問) | drill(⑤ドリル)   ※A列の見出し文字で照合
#     lang    = id|bn|ko|my|th|vi|zh|en|ne
#     --yen   = 実費(円)。省略時は費用セルを触らない。
#     --chars = 出力字数を明示。省略時は翻訳キャッシュから自動集計(dictは自動/daimonはlangフィールド集計)。
#   python tools/update_trans_status.py --ensure <section>   # 2行サマリ(字数/費用)が無ければ作成
#
# ★Excelが開いてロックされていたら Excel を強制終了(保存しない)してから書き込む(ユーザー指示 2026-09-06)。
import os, sys, glob, json, time, argparse

# cp932 の ≈/¥ で print が落ちるのを防ぐ
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XLSX = os.path.join(ROOT, 'memory', '在庫・模試ストックまとめ.xlsx')
SHEET_HINT = '翻訳'  # シート名に含まれる語

# section キー → A列見出しの目印
SECTION_MARK = {'dict': '③ 辞書', 'daimon': '④ 各大問', 'drill': '⑤ 各ドリル'}
# lang コード → ヘッダ行の日本語列名
LANG_JA = {'en': '英語', 'ne': 'ネパール語', 'bn': 'ベンガル語', 'id': 'インドネシア語',
           'ko': '韓国語', 'my': 'ミャンマー', 'th': 'タイ語', 'vi': 'ベトナム語', 'zh': '中国語'}
CHARS_LABEL = {'dict': '辞書訳 出力字数(参考)', 'daimon': '◇大問訳 出力字数(参考)', 'drill': '◇ドリル訳 出力字数(参考)'}
YEN_LABEL   = {'dict': '辞書訳 概算実費(参考・Gemini2.5Flash)', 'daimon': '◇大問訳 概算実費(参考・Gemini2.5Flash)', 'drill': '◇ドリル訳 概算実費(参考・Gemini2.5Flash)'}
AMBER = 'FFFFF2CC'


def _ws(wb):
    return [wb[s] for s in wb.sheetnames if SHEET_HINT in s][0]


def _close_excel_holding(path):
    """Excelがファイルを掴んでいたら閉じる。まずCOMで当該ブックだけ(保存せず)、無理ならEXCEL.EXE全kill。"""
    try:
        import win32com.client, pythoncom
        pythoncom.CoInitialize()
        xl = win32com.client.GetActiveObject('Excel.Application')
        for wb in list(xl.Workbooks):
            try:
                if os.path.normcase(wb.FullName) == os.path.normcase(path):
                    wb.Close(SaveChanges=False)
                    print('  Excel: 当該ブックを保存せず閉じました(COM)')
            except Exception:
                pass
        return
    except Exception:
        pass
    os.system('taskkill /F /IM EXCEL.EXE >NUL 2>&1')
    print('  Excel: EXCEL.EXE を強制終了しました(保存せず・taskkill)')


def force_save(wb, path):
    try:
        wb.save(path); return
    except PermissionError:
        print('  ⚠ ファイルがロック中(Excelで開いている)→強制終了して書き込みます')
        _close_excel_holding(path); time.sleep(1.2)
        wb.save(path)


def find_section(ws, mark):
    """A列で mark を含む行 = セクション開始。次のセクション見出し(①..⑨/■ でなく丸数字)まで。"""
    circ = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨']
    start = None
    for r in range(1, ws.max_row + 1):
        v = ws.cell(r, 1).value
        if isinstance(v, str) and mark in v:
            start = r; break
    if start is None:
        raise SystemExit(f'セクション見出し「{mark}」が見つかりません')
    end = ws.max_row
    for r in range(start + 1, ws.max_row + 1):
        v = ws.cell(r, 1).value
        if isinstance(v, str) and v[:1] in circ:
            end = r - 1; break
    return start, end


def find_header_cols(ws, start, end):
    """セクション内で言語名(インドネシア語 等)が並ぶヘッダ行を探し {langコード:列番号} を返す。"""
    for r in range(start, end + 1):
        rowvals = {c: ws.cell(r, c).value for c in range(1, ws.max_column + 1)}
        if any(isinstance(v, str) and 'インドネシア' in v for v in rowvals.values()):
            colmap = {}
            for lang, ja in LANG_JA.items():
                for c, v in rowvals.items():
                    if isinstance(v, str) and ja in v:
                        colmap[lang] = c; break
            return r, colmap
    raise SystemExit('言語ヘッダ行(インドネシア語…)が見つかりません')


def find_block_rows(ws, start, end, section):
    """セクション内の「出力字数」「概算実費」行を探す。無ければ (None,None)。"""
    cr = yr = None
    for r in range(start, end + 1):
        v = ws.cell(r, 1).value
        if isinstance(v, str):
            if '出力字数' in v: cr = r
            elif '概算実費' in v: yr = r
    return cr, yr


def ensure_block(ws, section):
    from openpyxl.styles import PatternFill, Alignment, Border, Side, Font
    from openpyxl.utils import get_column_letter as L
    start, end = find_section(ws, SECTION_MARK[section])
    cr, yr = find_block_rows(ws, start, end, section)
    if cr and yr:
        print(f'  既存ブロック: 出力字数=行{cr} / 概算実費=行{yr}(作成不要)')
        return cr, yr
    # 挿入位置 = セクション内で最初の「※」注記行の直前(無ければ end の直前)。
    ins = None
    for r in range(start + 1, end + 1):
        v = ws.cell(r, 1).value
        if isinstance(v, str) and v.lstrip().startswith('※'):
            ins = r; break
    if ins is None:
        ins = end + 1
    N = 2
    affected = [(m.min_row, m.min_col, m.max_row, m.max_col) for m in ws.merged_cells.ranges if m.min_row >= ins]
    for (r1, c1, r2, c2) in affected: ws.unmerge_cells(start_row=r1, start_column=c1, end_row=r2, end_column=c2)
    ws.insert_rows(ins, N)
    for (r1, c1, r2, c2) in affected: ws.merge_cells(start_row=r1 + N, start_column=c1, end_row=r2 + N, end_column=c2)
    amber = PatternFill('solid', fgColor=AMBER); f9 = Font(size=9, italic=True)
    thin = Side(style='thin', color='FFBFBFBF'); bd = Border(left=thin, right=thin, top=thin, bottom=thin)
    ws.cell(ins, 1, CHARS_LABEL[section]).font = f9;  ws.cell(ins, 1).fill = amber;  ws.cell(ins, 1).border = bd
    ws.cell(ins + 1, 1, YEN_LABEL[section]).font = f9; ws.cell(ins + 1, 1).fill = amber; ws.cell(ins + 1, 1).border = bd
    print(f'  2行サマリを作成: 出力字数=行{ins} / 概算実費=行{ins+1}(セクション「{SECTION_MARK[section]}」)')
    return ins, ins + 1


def dict_chars(lang):
    ch = 0
    for f in glob.glob(os.path.join(ROOT, 'scratchpad', 'pg', f'dictlang_{lang}_*.json')):
        try:
            d = json.load(open(f, encoding='utf-8')); ch += sum(len(str(v)) for v in d.values())
        except Exception:
            pass
    return ch


def daimon_chars(lang):
    """trans_<daimon>_cache.json が {id:{en,ne,lang,...}} 形式を想定し lang フィールドの字数合計。"""
    ch = 0
    for f in glob.glob(os.path.join(ROOT, 'scratchpad', 'pg', 'trans_*_cache.json')):
        try:
            d = json.load(open(f, encoding='utf-8'))
            for _id, tr in d.items():
                if isinstance(tr, dict):
                    v = tr.get(lang)
                    if isinstance(v, str): ch += len(v)
                    elif isinstance(v, dict): ch += sum(len(str(x)) for x in v.values())
        except Exception:
            pass
    return ch


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('section', nargs='?')
    ap.add_argument('lang', nargs='?')
    ap.add_argument('--yen', type=float, default=None)
    ap.add_argument('--chars', type=int, default=None)
    ap.add_argument('--ensure', metavar='SECTION')
    a = ap.parse_args()
    import openpyxl
    from openpyxl.styles import PatternFill, Alignment, Font, Border, Side
    from openpyxl.utils import get_column_letter as L

    wb = openpyxl.load_workbook(XLSX); ws = _ws(wb)

    if a.ensure:
        section = a.ensure
        if section not in SECTION_MARK: raise SystemExit(f'section は {list(SECTION_MARK)} のいずれか')
        ensure_block(ws, section)
        force_save(wb, XLSX); print('保存:', XLSX); return

    if not a.section or not a.lang:
        raise SystemExit('使い方: update_trans_status.py <section> <lang> [--yen N] [--chars N]  /  --ensure <section>')
    section, lang = a.section, a.lang
    if section not in SECTION_MARK: raise SystemExit(f'section は {list(SECTION_MARK)} のいずれか')
    if lang not in LANG_JA: raise SystemExit(f'lang は {list(LANG_JA)} のいずれか')

    start, end = find_section(ws, SECTION_MARK[section])
    _hr, colmap = find_header_cols(ws, start, end)
    if lang not in colmap: raise SystemExit(f'ヘッダ行に「{LANG_JA[lang]}」列が見つかりません(langs={list(colmap)})')
    col = colmap[lang]
    cr, yr = ensure_block(ws, section)  # 無ければ作る

    chars = a.chars if a.chars is not None else (dict_chars(lang) if section == 'dict' else daimon_chars(lang))
    amber = PatternFill('solid', fgColor=AMBER); f9 = Font(size=9)
    cen = Alignment(horizontal='center', vertical='center')
    thin = Side(style='thin', color='FFBFBFBF'); bd = Border(left=thin, right=thin, top=thin, bottom=thin)

    def put(r, val, numfmt=None):
        c = ws.cell(r, col); c.value = val; c.font = f9; c.alignment = cen; c.fill = amber; c.border = bd
        if numfmt: c.number_format = numfmt

    if chars: put(cr, chars, '#,##0')
    if a.yen is not None:
        put(yr, f'¥{a.yen:.0f}')
    print(f'  記入: セクション「{SECTION_MARK[section]}」{LANG_JA[lang]}={L(col)}列 → 字数(行{cr})={chars or "—"} / 費用(行{yr})={("¥%.0f"%a.yen) if a.yen is not None else "据置"}')
    force_save(wb, XLSX); print('保存:', XLSX)


if __name__ == '__main__':
    main()
