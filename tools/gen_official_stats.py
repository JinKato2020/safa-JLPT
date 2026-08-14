# -*- coding: utf-8 -*-
"""公式JLPT統計(評価/*.csv)から src/data/officialStats.ts を機械生成。
   基準回=2025年第2回(12月)。相対位置カード/ダッシュボードの参照データ。
   出典: jlpt.jp 統計(平均点/SD, 得点分布) + 結果の概要(認定率)。
   使い方: python tools/gen_official_stats.py"""
import csv, io, os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
MEAN_CSV = os.path.join(ROOT, '評価', 'jlpt_2016_2025_mean_sd_total.csv')
CUM_CSV = os.path.join(ROOT, '評価', 'jlpt_2025_dec_cumulative_scaled_scores.csv')
OUT = os.path.join(ROOT, 'src', 'data', 'officialStats.ts')

BASE_YEAR, BASE_SESSION = '2025', '2'  # 得点分布表(2025_2_6)と揃える
LEVELS = ['N1', 'N2', 'N3', 'N4', 'N5']

# scoring_section 名 → (key, 対象レベル判定)
SEC = {
    'Language Knowledge (Vocabulary/Grammar)': 'gengo',            # N1/N2/N3 (60)
    'Reading': 'dokkai',                                            # N1/N2/N3 (60)
    'Language Knowledge (Vocabulary/Grammar) & Reading': 'gengo',  # N4/N5 (120, 合算)
    'Listening': 'choukai',                                         # (60)
    'Total Score': 'total',                                         # (180)
}

# ── 平均点/SD(基準回) ──
sec_stats = {lv: {} for lv in LEVELS}   # lv -> key -> (mean, sd, max)
total_mean = {}                          # lv -> (mean, sd)
with io.open(MEAN_CSV, encoding='utf-8-sig') as f:
    for r in csv.DictReader(f):
        if r['year'] != BASE_YEAR or r['session'] != BASE_SESSION:
            continue
        lv = r['level']
        if lv not in LEVELS:
            continue
        key = SEC.get(r['scoring_section'])
        if not key:
            continue
        mean, sd, mx = float(r['mean_score']), float(r['standard_deviation']), int(r['max_score'])
        if key == 'total':
            total_mean[lv] = (mean, sd)
        else:
            sec_stats[lv][key] = (mean, sd, mx)

# ── 得点分布(累積: 総合得点 → 上位%) ──
cum = {lv: [] for lv in LEVELS}  # lv -> [(score, top_percent_total)] 高得点→低得点
with io.open(CUM_CSV, encoding='utf-8-sig') as f:
    for r in csv.DictReader(f):
        lv = r['level']
        if lv not in LEVELS:
            continue
        cum[lv].append((int(r['scaled_score']), float(r['top_percent_total'])))
for lv in LEVELS:
    cum[lv].sort(key=lambda x: x[0])  # 昇順(0..180)

# ── 認定率(結果の概要 2025年第2回)。出典: jlpt.jp/statistics/archive/202502.html ──
PASS_RATE = {'N1': 29.8, 'N2': 33.0, 'N3': 31.2, 'N4': 34.6, 'N5': 50.2}

# ── TS 出力 ──
def sec_obj(lv):
    parts = []
    for key in ['gengo', 'dokkai', 'choukai']:
        if key in sec_stats[lv]:
            m, s, mx = sec_stats[lv][key]
            parts.append(f"{key}:{{mean:{m},sd:{s},max:{mx}}}")
    return '{' + ', '.join(parts) + '}'

L = []
L.append('// 公式JLPT統計(参照データ)。相対位置カード/ダッシュボード用。')
L.append(f'// 基準回=2025年第2回(12月)。平均点/SD・得点分布=jlpt.jp 統計、認定率=結果の概要。')
L.append('// ※自動生成: tools/gen_official_stats.py（評価/*.csv から）。手で編集しない。')
L.append("export type OfficialLevel = 'N1' | 'N2' | 'N3' | 'N4' | 'N5';")
L.append("export type OfficialSecKey = 'gengo' | 'dokkai' | 'choukai';")
L.append("export interface SecStat { mean: number; sd: number; max: number }")
L.append('')
L.append("export const OFFICIAL_BASE_LABEL = '2025年 第2回(12月)';")
L.append("export const OFFICIAL_SOURCE = 'jlpt.jp 公式統計';")
L.append("export const OFFICIAL_SOURCE_URL = 'https://www.jlpt.jp/statistics/';")
L.append('')
L.append('// セクション別 平均点・標準偏差(基準回)。N4/N5のgengoは「言語知識＋読解」合算(120点満点)。')
L.append('export const OFFICIAL_SECTION_STATS: Record<OfficialLevel, Partial<Record<OfficialSecKey, SecStat>>> = {')
for lv in LEVELS:
    L.append(f'  {lv}: {sec_obj(lv)},')
L.append('};')
L.append('')
L.append('// 総合の平均点・標準偏差(基準回)。')
L.append('export const OFFICIAL_TOTAL_STAT: Record<OfficialLevel, { mean: number; sd: number }> = {')
for lv in LEVELS:
    m, s = total_mean[lv]
    L.append(f'  {lv}: {{ mean: {m}, sd: {s} }},')
L.append('};')
L.append('')
L.append('// 総合得点 → その得点以上を取った人の割合(=上位%)。昇順(0..180, 5刻み)。出典=得点分布表(基準回)。')
L.append('export const OFFICIAL_TOP_PERCENT: Record<OfficialLevel, { score: number; top: number }[]> = {')
for lv in LEVELS:
    arr = ', '.join(f'{{score:{sc},top:{tp}}}' for sc, tp in cum[lv])
    L.append(f'  {lv}: [{arr}],')
L.append('};')
L.append('')
L.append('// 公式 認定率(%)。基準回=2025年第2回。出典: https://www.jlpt.jp/statistics/archive/202502.html')
L.append('export const OFFICIAL_PASS_RATE: Record<OfficialLevel, number> = {')
for lv in LEVELS:
    L.append(f'  {lv}: {PASS_RATE[lv]},')
L.append('};')
L.append('')
out = '\n'.join(L) + '\n'
io.open(OUT, 'w', encoding='utf-8', newline='\n').write(out)
print('wrote', OUT)
print('section stats levels:', {lv: list(sec_stats[lv].keys()) for lv in LEVELS})
print('cum rows:', {lv: len(cum[lv]) for lv in LEVELS})
