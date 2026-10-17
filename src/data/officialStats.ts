// 公式JLPT統計(参照データ)。相対位置カード/ダッシュボード用。
// 基準回=2025年第2回(12月)。平均点/SD・得点分布=jlpt.jp 統計、認定率=結果の概要。
// ※自動生成: tools/gen_official_stats.py（評価/*.csv から）。手で編集しない。
export type OfficialLevel = 'N1' | 'N2' | 'N3' | 'N4' | 'N5';
export type OfficialSecKey = 'gengo' | 'dokkai' | 'choukai';
export interface SecStat { mean: number; sd: number; max: number }

export const OFFICIAL_BASE_LABEL = '2025年 第2回(12月)';
export const OFFICIAL_SOURCE = 'jlpt.jp 公式統計';
export const OFFICIAL_SOURCE_URL = 'https://www.jlpt.jp/statistics/';

// セクション別 平均点・標準偏差(基準回)。N4/N5のgengoは「言語知識＋読解」合算(120点満点)。
export const OFFICIAL_SECTION_STATS: Record<OfficialLevel, Partial<Record<OfficialSecKey, SecStat>>> = {
  N1: {gengo:{mean:28.2,sd:10.4,max:60}, dokkai:{mean:28.0,sd:13.7,max:60}, choukai:{mean:33.5,sd:10.1,max:60}},
  N2: {gengo:{mean:24.3,sd:10.5,max:60}, dokkai:{mean:24.7,sd:12.0,max:60}, choukai:{mean:34.8,sd:9.5,max:60}},
  N3: {gengo:{mean:27.9,sd:8.3,max:60}, dokkai:{mean:26.5,sd:9.3,max:60}, choukai:{mean:33.4,sd:10.5,max:60}},
  N4: {gengo:{mean:52.6,sd:20.6,max:120}, choukai:{mean:29.5,sd:9.2,max:60}},
  N5: {gengo:{mean:54.4,sd:21.0,max:120}, choukai:{mean:29.0,sd:8.6,max:60}},
};

// 総合の平均点・標準偏差(基準回)。
export const OFFICIAL_TOTAL_STAT: Record<OfficialLevel, { mean: number; sd: number }> = {
  N1: { mean: 89.7, sd: 28.1 },
  N2: { mean: 83.8, sd: 26.0 },
  N3: { mean: 87.7, sd: 23.0 },
  N4: { mean: 82.1, sd: 27.0 },
  N5: { mean: 83.3, sd: 27.6 },
};

// 総合得点 → その得点以上を取った人の割合(=上位%)。昇順(0..180, 5刻み)。出典=得点分布表(基準回)。
export const OFFICIAL_TOP_PERCENT: Record<OfficialLevel, { score: number; top: number }[]> = {
  N1: [{score:0,top:100.0}, {score:5,top:100.0}, {score:10,top:100.0}, {score:15,top:100.0}, {score:20,top:100.0}, {score:25,top:99.9}, {score:30,top:99.6}, {score:35,top:99.1}, {score:40,top:98.1}, {score:45,top:96.5}, {score:50,top:94.1}, {score:55,top:90.7}, {score:60,top:86.1}, {score:65,top:80.5}, {score:70,top:74.0}, {score:75,top:66.9}, {score:80,top:59.3}, {score:85,top:51.6}, {score:90,top:44.2}, {score:95,top:37.3}, {score:100,top:31.2}, {score:105,top:25.9}, {score:110,top:21.5}, {score:115,top:17.8}, {score:120,top:14.8}, {score:125,top:12.3}, {score:130,top:10.2}, {score:135,top:8.4}, {score:140,top:6.9}, {score:145,top:5.7}, {score:150,top:4.6}, {score:155,top:3.6}, {score:160,top:2.8}, {score:165,top:2.1}, {score:170,top:1.4}, {score:175,top:0.9}, {score:180,top:0.5}],
  N2: [{score:0,top:100.0}, {score:5,top:100.0}, {score:10,top:100.0}, {score:15,top:100.0}, {score:20,top:100.0}, {score:25,top:99.9}, {score:30,top:99.9}, {score:35,top:99.7}, {score:40,top:99.1}, {score:45,top:98.1}, {score:50,top:96.1}, {score:55,top:92.9}, {score:60,top:88.0}, {score:65,top:81.5}, {score:70,top:73.4}, {score:75,top:64.3}, {score:80,top:54.9}, {score:85,top:45.9}, {score:90,top:37.6}, {score:95,top:30.4}, {score:100,top:24.5}, {score:105,top:19.7}, {score:110,top:15.9}, {score:115,top:12.8}, {score:120,top:10.4}, {score:125,top:8.4}, {score:130,top:6.8}, {score:135,top:5.5}, {score:140,top:4.4}, {score:145,top:3.5}, {score:150,top:2.8}, {score:155,top:2.1}, {score:160,top:1.6}, {score:165,top:1.1}, {score:170,top:0.7}, {score:175,top:0.4}, {score:180,top:0.2}],
  N3: [{score:0,top:100.0}, {score:5,top:100.0}, {score:10,top:100.0}, {score:15,top:100.0}, {score:20,top:100.0}, {score:25,top:100.0}, {score:30,top:100.0}, {score:35,top:99.9}, {score:40,top:99.8}, {score:45,top:99.4}, {score:50,top:98.6}, {score:55,top:96.9}, {score:60,top:93.7}, {score:65,top:88.7}, {score:70,top:82.0}, {score:75,top:73.8}, {score:80,top:64.5}, {score:85,top:54.9}, {score:90,top:45.6}, {score:95,top:37.0}, {score:100,top:29.7}, {score:105,top:23.6}, {score:110,top:18.7}, {score:115,top:14.8}, {score:120,top:11.7}, {score:125,top:9.3}, {score:130,top:7.4}, {score:135,top:5.9}, {score:140,top:4.7}, {score:145,top:3.7}, {score:150,top:2.9}, {score:155,top:2.1}, {score:160,top:1.6}, {score:165,top:1.1}, {score:170,top:0.7}, {score:175,top:0.4}, {score:180,top:0.2}],
  N4: [{score:0,top:100.0}, {score:5,top:100.0}, {score:10,top:100.0}, {score:15,top:100.0}, {score:20,top:99.9}, {score:25,top:99.9}, {score:30,top:99.7}, {score:35,top:99.3}, {score:40,top:98.2}, {score:45,top:96.0}, {score:50,top:92.5}, {score:55,top:87.7}, {score:60,top:81.8}, {score:65,top:75.1}, {score:70,top:67.7}, {score:75,top:59.9}, {score:80,top:52.0}, {score:85,top:44.2}, {score:90,top:37.0}, {score:95,top:30.4}, {score:100,top:24.7}, {score:105,top:19.8}, {score:110,top:15.8}, {score:115,top:12.5}, {score:120,top:9.9}, {score:125,top:7.8}, {score:130,top:6.1}, {score:135,top:4.8}, {score:140,top:3.7}, {score:145,top:2.9}, {score:150,top:2.3}, {score:155,top:1.7}, {score:160,top:1.2}, {score:165,top:0.8}, {score:170,top:0.5}, {score:175,top:0.3}, {score:180,top:0.2}],
  N5: [{score:0,top:100.0}, {score:5,top:100.0}, {score:10,top:100.0}, {score:15,top:100.0}, {score:20,top:99.9}, {score:25,top:99.9}, {score:30,top:99.7}, {score:35,top:99.2}, {score:40,top:97.9}, {score:45,top:95.2}, {score:50,top:90.9}, {score:55,top:85.3}, {score:60,top:79.1}, {score:65,top:72.3}, {score:70,top:65.0}, {score:75,top:57.4}, {score:80,top:49.8}, {score:85,top:42.5}, {score:90,top:35.7}, {score:95,top:29.7}, {score:100,top:24.5}, {score:105,top:20.1}, {score:110,top:16.3}, {score:115,top:13.2}, {score:120,top:10.7}, {score:125,top:8.6}, {score:130,top:6.9}, {score:135,top:5.5}, {score:140,top:4.4}, {score:145,top:3.5}, {score:150,top:2.8}, {score:155,top:2.2}, {score:160,top:1.6}, {score:165,top:1.0}, {score:170,top:0.7}, {score:175,top:0.4}, {score:180,top:0.3}],
};

// 公式 認定率(%)。基準回=2025年第2回。出典: https://www.jlpt.jp/statistics/archive/202502.html
export const OFFICIAL_PASS_RATE: Record<OfficialLevel, number> = {
  N1: 29.8,
  N2: 33.0,
  N3: 31.2,
  N4: 34.6,
  N5: 50.2,
};

