// 共有ホームの i18n キーを A/B/C 各アプリの i18n JSON に「ネスト構造」で注入。
// (聞いて話せる i18n は pick() がドットで入れ子を辿る方式=フラットキーでは解決しない)
// ja/en は本スクリプト内、ne/bn/vi/zh/ko は翻訳ワークフロー .output から。各アプリの既存langファイルのみ対象。
const fs = require('fs'), path = require('path');
const ROOT = 'C:/Users/jwpsa/Documents/desktop/claude/聞いて話せるシリーズ';
const OUT = process.argv[2];

const JA = {
  'nav.home': 'ホーム', 'home.title': 'ホーム', 'home.streak_days': '連続', 'home.total_days': '学習日', 'home.longest': '最長',
  'home.section_streak': '継続', 'home.section_growth': '成長', 'home.section_badges': 'バッジ',
  'home.growth_title': '学習した日（直近14日）', 'home.cal_caption': '直近5週（学習した日に色）',
  'home.wd_sun': '日', 'home.wd_mon': '月', 'home.wd_tue': '火', 'home.wd_wed': '水', 'home.wd_thu': '木', 'home.wd_fri': '金', 'home.wd_sat': '土',
  'home.badge_first': 'はじめの一歩', 'home.badge_first_hint': '学習を開始', 'home.badge_3': '3日連続', 'home.badge_3_hint': '3日続ける',
  'home.badge_7': '7日連続', 'home.badge_7_hint': '7日続ける', 'home.badge_30': '30日連続', 'home.badge_30_hint': '30日続ける', 'home.badge_achieved': '達成',
};
const EN = {
  'nav.home': 'Home', 'home.title': 'Home', 'home.streak_days': 'Streak', 'home.total_days': 'Days', 'home.longest': 'Best',
  'home.section_streak': 'Streak', 'home.section_growth': 'Growth', 'home.section_badges': 'Badges',
  'home.growth_title': 'Days studied (last 14 days)', 'home.cal_caption': 'Last 5 weeks (studied days colored)',
  'home.wd_sun': 'Sun', 'home.wd_mon': 'Mon', 'home.wd_tue': 'Tue', 'home.wd_wed': 'Wed', 'home.wd_thu': 'Thu', 'home.wd_fri': 'Fri', 'home.wd_sat': 'Sat',
  'home.badge_first': 'First Step', 'home.badge_first_hint': 'Start learning', 'home.badge_3': '3-Day Streak', 'home.badge_3_hint': 'Keep 3 days',
  'home.badge_7': '7-Day Streak', 'home.badge_7_hint': 'Keep 7 days', 'home.badge_30': '30-Day Streak', 'home.badge_30_hint': 'Keep 30 days', 'home.badge_achieved': 'Done',
};

const wf = JSON.parse(fs.readFileSync(OUT, 'utf8'));
const wfres = (wf.result || wf).results || [];
const maps = { ja: JA, en: EN };
for (const r of wfres) { const m = {}; for (const e of r.entries) m[e.key] = e.text; maps[r.lang] = m; }

function setDeep(o, dotted, v) {
  const ps = dotted.split('.');
  let c = o;
  for (let i = 0; i < ps.length - 1; i++) { if (typeof c[ps[i]] !== 'object' || c[ps[i]] == null) c[ps[i]] = {}; c = c[ps[i]]; }
  c[ps[ps.length - 1]] = v;
}

const apps = ['聞いて話せる日本語', '聞いて話せるネパール語', '聞いて話せる英語'];
for (const app of apps) {
  const dir = path.join(ROOT, app, 'expo-app', 'src', 'i18n');
  for (const f of fs.readdirSync(dir)) {
    const mm = f.match(/^([a-z]{2})\.json$/);
    if (!mm) continue;
    const map = maps[mm[1]];
    if (!map) continue;
    const p = path.join(dir, f);
    const o = JSON.parse(fs.readFileSync(p, 'utf8'));
    for (const [k, v] of Object.entries(map)) setDeep(o, k, v);
    fs.writeFileSync(p, JSON.stringify(o, null, 2) + '\n', 'utf8');
    console.log(app, mm[1], '✓ nav.home + home.*');
  }
}
console.log('done');
