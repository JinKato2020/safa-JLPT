# 教師専用サイト(docs/supabase/teacher.html)のUI文言を ja を元に全11言語へ翻訳し、
# teacher.html 内の /* I18N-START */ … /* I18N-END */ ブロックを丸ごと上書きする。
# Gemini翻訳は tools/trans_i18n.py の gemini_batch を再利用(2.5-flash・thinkingBudget0・プレースホルダ保全)。
#
#   使い方:  GEMINI_API_KEY=... python tools/teacher_site_i18n.py
#            python tools/teacher_site_i18n.py --dry-run   # 翻訳せず対象キー数だけ表示
#
# ja(正本)は teacher.html の I18N ブロック内。ここを編集→本スクリプト再実行で全言語更新。
import os, re, sys, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML = os.path.join(ROOT, 'docs', 'supabase', 'teacher.html')
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from trans_i18n import gemini_batch  # noqa: E402

# teacher.html の言語コード → Gemini に渡す言語名
TARGETS = {
    'en': 'English', 'ne': 'Nepali', 'bn': 'Bengali', 'id': 'Indonesian',
    'ko': 'Korean', 'my': 'Burmese (Myanmar)', 'th': 'Thai', 'vi': 'Vietnamese',
    'zh': 'Simplified Chinese', 'zh2': 'Traditional Chinese (Taiwan)',
}
BLOCK = re.compile(r'(/\* I18N-START.*?\*/\s*)const I18N = (\{.*?\});(\s*/\* I18N-END \*/)', re.DOTALL)


def read_block():
    html = open(HTML, encoding='utf-8').read()
    m = BLOCK.search(html)
    if not m:
        print('I18N ブロックが見つかりません'); sys.exit(1)
    obj = json.loads(m.group(2))
    return html, m, obj


def chunks(pairs, n=30):
    for i in range(0, len(pairs), n):
        yield pairs[i:i + n]


def main():
    dry = '--dry-run' in sys.argv
    html, m, obj = read_block()
    ja = obj['ja']
    pairs = list(ja.items())
    print(f'ja キー数 = {len(pairs)} / 対象言語 = {len(TARGETS)}')
    if dry:
        return
    if not os.environ.get('GEMINI_API_KEY'):
        print('GEMINI_API_KEY 未設定'); sys.exit(1)

    result = {'ja': ja}
    tin = tout = 0
    for code, name in TARGETS.items():
        acc = {}
        for ch in chunks(pairs):
            out, ci, co = gemini_batch(ch, name)
            acc.update(out); tin += ci; tout += co
        # 欠けたキーは ja でフォールバック(表示が空にならないように)
        result[code] = {k: acc.get(k, ja[k]) for k in ja}
        got = sum(1 for k in ja if k in acc)
        print(f'  {code:4} {got}/{len(ja)} 翻訳')

    block = 'const I18N = ' + json.dumps(result, ensure_ascii=False, indent=2) + ';'
    new_html = html[:m.start()] + m.group(1) + block + m.group(3) + html[m.end():]
    open(HTML, 'w', encoding='utf-8').write(new_html)
    yen = (tin / 1e6) * 0.30 * 155 + (tout / 1e6) * 2.50 * 155
    print(f'書き込み完了。tokens in={tin} out={tout} 概算 JPY {yen:.1f}')


if __name__ == '__main__':
    main()
