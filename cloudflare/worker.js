// safa まいにちJLPT 匿名計測 受信＋閲覧ダッシュボード Worker。
//  受信: POST /jlpt/v1/{snapshot,mock,events} → D1(env.DB)。
//  閲覧: GET /dashboard?k=<DASH_KEY> → 集計HTML / GET /export?k=&t=snapshots|mocks|events → CSV(個別生データ)。
// PIIなし(匿名UUIDのみ)。IP非保存・req.cf.country(粗い国コード)のみ。追跡なし。
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'GET') {
      const k = url.searchParams.get('k');
      const authed = env.DASH_KEY && k === env.DASH_KEY;
      if (url.pathname.endsWith('/dashboard')) {
        if (!authed) return new Response('forbidden', { status: 403 });
        try { return await dashboard(env.DB, k); } catch (e) { return new Response('err: ' + ((e && e.message) || e), { status: 500 }); }
      }
      if (url.pathname.endsWith('/export')) {
        if (!authed) return new Response('forbidden', { status: 403 });
        try { return await exportCsv(env.DB, url.searchParams.get('t')); } catch (e) { return new Response('err: ' + ((e && e.message) || e), { status: 500 }); }
      }
      return new Response('safa-jlpt telemetry', { status: 200 });
    }
    if (req.method !== 'POST') return new Response('ok', { status: 200 });
    const country = (req.cf && req.cf.country) || '';
    let b;
    try { b = await req.json(); } catch { return j({ error: 'bad json' }, 400); }
    if (!b || typeof b.anonId !== 'string' || b.anonId.length < 8 || b.anonId.length > 64) return j({ error: 'bad anonId' }, 400);
    try {
      if (url.pathname.endsWith('/snapshot')) await snap(env.DB, b, country);
      else if (url.pathname.endsWith('/mock')) await mock(env.DB, b);
      else if (url.pathname.endsWith('/events')) await events(env.DB, b);
      else return j({ error: 'not found' }, 404);
    } catch (e) { return j({ error: String((e && e.message) || e) }, 500); }
    return j({ ok: true });
  },
};

const j = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } });
const n = (v) => (typeof v === 'number' && isFinite(v) ? Math.round(v) : null);
const t = (v, max = 64) => (typeof v === 'string' ? v.slice(0, max) : '');

async function snap(db, b, country) {
  const r = b.readiness || {}, m = b.remaining || {}, tt = b.total || {};
  const ex = Array.isArray(b.exhausted) ? b.exhausted.join(',').slice(0, 100) : '';
  await db.prepare(
    `INSERT INTO snapshots (anon_id,day,ts,level,ui_lang,app,platform,country,r_total,r_moji_goi,r_bunpou,r_dokkai,r_choukai,learned,streak,rem_moji_goi,rem_bunpou,rem_dokkai,rem_choukai,exhausted,tot_moji_goi,tot_bunpou,tot_dokkai,tot_choukai)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,?23,?24)
     ON CONFLICT(anon_id,day) DO UPDATE SET ts=?3,level=?4,ui_lang=?5,app=?6,platform=?7,country=?8,r_total=?9,r_moji_goi=?10,r_bunpou=?11,r_dokkai=?12,r_choukai=?13,learned=?14,streak=?15,rem_moji_goi=?16,rem_bunpou=?17,rem_dokkai=?18,rem_choukai=?19,exhausted=?20,tot_moji_goi=?21,tot_bunpou=?22,tot_dokkai=?23,tot_choukai=?24`,
  ).bind(
    t(b.anonId), t(b.day, 10), Math.floor(Date.now() / 1000), t(b.level, 4), t(b.uiLang, 8), t(b.app, 16), t(b.platform, 12), t(country, 4),
    n(r.total), n(r.moji_goi), n(r.bunpou), n(r.dokkai), n(r.choukai),
    n(b.learned), n(b.streak), n(m.moji_goi), n(m.bunpou), n(m.dokkai), n(m.choukai), ex,
    n(tt.moji_goi), n(tt.bunpou), n(tt.dokkai), n(tt.choukai),
  ).run();
}
async function mock(db, b) {
  const p = b.sections || {};
  await db.prepare(
    `INSERT INTO mocks (anon_id,ts,level,full,pct,p_moji_goi,p_bunpou,p_dokkai,p_choukai,timed_out,elapsed_sec,app)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)`,
  ).bind(
    t(b.anonId), n(b.ts) || Math.floor(Date.now() / 1000), t(b.level, 4), b.full ? 1 : 0, n(b.pct),
    n(p.moji_goi), n(p.bunpou), n(p.dokkai), n(p.choukai), b.timedOut ? 1 : 0, n(b.elapsedSec), t(b.app, 16),
  ).run();
}
async function events(db, b) {
  const list = Array.isArray(b.events) ? b.events : [b];
  for (const e of list) {
    if (!e || !e.name) continue;
    await db.prepare(`INSERT INTO events (anon_id,ts,name,props,app,level) VALUES (?1,?2,?3,?4,?5,?6)`)
      .bind(t(e.anonId || b.anonId), n(e.ts) || Math.floor(Date.now() / 1000), t(e.name, 40),
        JSON.stringify(e.props || {}).slice(0, 500), t(e.app || b.app, 16), t(e.level, 4)).run();
  }
}

// ---- CSV エクスポート(個別の生データ・全件) ----
async function exportCsv(db, table) {
  const allowed = { snapshots: 1, mocks: 1, events: 1 };
  const tbl = allowed[table] ? table : 'snapshots';
  const rows = (await db.prepare(`SELECT * FROM ${tbl} ORDER BY ts`).all()).results || [];
  const cols = rows.length ? Object.keys(rows[0]) : [];
  const cell = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n');
  return new Response('﻿' + csv, { // BOM付き=Excelで日本語が文字化けしない
    status: 200,
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${tbl}.csv"` },
  });
}

// ---- 閲覧ダッシュボード(集計HTML・見出しは日本語) ----
const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
function table(cols, rows) {
  const th = cols.map((c) => `<th>${esc(c)}</th>`).join('');
  const tr = rows.map((r) => '<tr>' + cols.map((c) => `<td>${esc(r[c])}</td>`).join('') + '</tr>').join('');
  return `<div style="overflow-x:auto"><table><thead><tr>${th}</tr></thead><tbody>${tr || '<tr><td colspan="' + cols.length + '">(データなし)</td></tr>'}</tbody></table></div>`;
}
// 個別スナップショット: 区分は「横バー(到達度・色変化)＋下に 残数/全数」で表示。
function barCell(pct, rem, tot) {
  const has = pct != null;
  const v = has ? Math.max(0, Math.min(100, pct)) : 0;
  const col = !has ? '#3a496b' : v >= 80 ? '#34d399' : v >= 50 ? '#fbbf24' : '#f87171';
  const done = (tot != null && rem != null) ? Math.max(0, tot - rem) : null; // 学習済=全数-残
  const frac = done != null ? `${done}/${tot}` : '–';
  return `<td><div class="barwrap"><div class="bar" style="width:${v}%;background:${col}"></div></div><div class="cnt">${frac}</div></td>`;
}
function indivTable(rows) {
  const head = ['日付', 'レベル', '到達度', '漢字語彙', '文法', '読解', '聴解', '国', '端末'];
  const th = head.map((h) => `<th>${esc(h)}</th>`).join('');
  const body = rows.map((r) => '<tr>'
    + `<td>${esc(r.day)}</td><td>${esc(r.level)}</td><td>${esc(r.r_total)}</td>`
    + barCell(r.r_moji_goi, r.rem_moji_goi, r.tot_moji_goi)
    + barCell(r.r_bunpou, r.rem_bunpou, r.tot_bunpou)
    + barCell(r.r_dokkai, r.rem_dokkai, r.tot_dokkai)
    + barCell(r.r_choukai, r.rem_choukai, r.tot_choukai)
    + `<td>${esc(r.country)}</td><td>${esc(r.platform)}</td></tr>`).join('');
  return `<div style="overflow-x:auto"><table><thead><tr>${th}</tr></thead><tbody>${body || '<tr><td colspan="9">(データなし)</td></tr>'}</tbody></table></div>`;
}
async function dashboard(db, key) {
  const q = async (sql) => (await db.prepare(sql).all()).results || [];
  const ov = (await q(`SELECT
      (SELECT COUNT(DISTINCT anon_id) FROM snapshots) users,
      (SELECT COUNT(*) FROM snapshots) snaps,
      (SELECT COUNT(*) FROM events) events,
      (SELECT COUNT(*) FROM mocks) mocks`))[0] || {};
  const ret = (await q(`SELECT
      (SELECT ROUND(AVG(s.streak),1) FROM snapshots s JOIN (SELECT anon_id,MAX(day) d FROM snapshots GROUP BY anon_id) m ON s.anon_id=m.anon_id AND s.day=m.d) avg_streak,
      (SELECT MAX(streak) FROM snapshots) max_streak,
      (SELECT ROUND(AVG(d),1) FROM (SELECT COUNT(DISTINCT day) d FROM snapshots GROUP BY anon_id)) avg_days,
      (SELECT ROUND(100.0*SUM(CASE WHEN d>=2 THEN 1 ELSE 0 END)/COUNT(*),0) FROM (SELECT COUNT(DISTINCT day) d FROM snapshots GROUP BY anon_id)) repeat_rate`))[0] || {};
  const byLevel = await q(`
    WITH latest AS (
      SELECT s.* FROM snapshots s
      JOIN (SELECT anon_id, MAX(day) d FROM snapshots GROUP BY anon_id) m
        ON s.anon_id=m.anon_id AND s.day=m.d)
    SELECT level "レベル",
      COUNT(*) "ユーザー",
      ROUND(AVG(r_total),1) "到達度", ROUND(AVG(r_moji_goi),1) "漢字語彙", ROUND(AVG(r_bunpou),1) "文法", ROUND(AVG(r_dokkai),1) "読解", ROUND(AVG(r_choukai),1) "聴解",
      ROUND(AVG(learned),0) "習得数",
      ROUND(100.0*SUM(CASE WHEN rem_dokkai<=3 THEN 1 ELSE 0 END)/COUNT(*),0) "読解枯渇%",
      ROUND(100.0*SUM(CASE WHEN rem_choukai<=3 THEN 1 ELSE 0 END)/COUNT(*),0) "聴解枯渇%"
    FROM latest GROUP BY level ORDER BY level`);
  const ev = await q(`SELECT CASE name
        WHEN 'onboarding_complete' THEN '初回設定完了（使い始めた）'
        WHEN 'session_complete' THEN '学習・演習を完了'
        WHEN 'language_changed' THEN '表示言語を変更'
        ELSE name END "イベント",
      COUNT(*) "回数"
    FROM events GROUP BY name ORDER BY COUNT(*) DESC`);
  // セッション内訳: 区分別(漢字語彙/文法/読解/聴解/混合/旧)＋最後に全体。modeは区分名(新)またはstudy(旧)。
  const sessRaw = await q(`SELECT json_extract(props,'$.mode') m, COUNT(*) n FROM events WHERE name='session_complete' GROUP BY json_extract(props,'$.mode')`);
  const sMap = {};
  for (const r of sessRaw) sMap[r.m] = r.n;
  const sLabels = [['moji_goi', '漢字語彙'], ['bunpou', '文法'], ['dokkai', '読解'], ['choukai', '聴解'], ['quiz', '混合(診断クイズ)'], ['study', '学習(区分前の旧データ)']];
  const sessRows = sLabels.filter(([k]) => sMap[k]).map(([k, l]) => ({ 'セッション種類': l, '回数': sMap[k] }));
  sessRows.push({ 'セッション種類': '全体', '回数': sessRaw.reduce((a, r) => a + (r.n || 0), 0) });
  const mk = await q(`SELECT level "レベル", COUNT(*) "受験数", ROUND(AVG(pct),1) "平均得点率", ROUND(100.0*SUM(CASE WHEN timed_out=1 THEN 1 ELSE 0 END)/COUNT(*),0) "時間切れ%" FROM mocks GROUP BY level ORDER BY level`);
  const recent = await q(`SELECT day, level, r_total, r_moji_goi, r_bunpou, r_dokkai, r_choukai,
      rem_moji_goi, rem_bunpou, rem_dokkai, rem_choukai, tot_moji_goi, tot_bunpou, tot_dokkai, tot_choukai, country, platform
    FROM snapshots ORDER BY ts DESC LIMIT 50`);
  const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>まいにちJLPT 計測ダッシュボード</title>
<style>
 body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#0f1830;color:#e7ecf5;margin:0;padding:20px;line-height:1.5}
 h1{font-size:20px;margin:0 0 4px} .sub{color:#9fb0cf;font-size:12px;margin-bottom:18px}
 h2{font-size:15px;margin:22px 0 8px;color:#cfe0ff}
 .cards{display:flex;gap:12px;flex-wrap:wrap}
 .card{background:#18233f;border:1px solid #27355c;border-radius:12px;padding:14px 18px;min-width:110px}
 .card .v{font-size:26px;font-weight:800} .card .l{font-size:11px;color:#9fb0cf}
 table{border-collapse:collapse;width:100%;background:#141d36;border-radius:10px;overflow:hidden;font-size:13px}
 th,td{padding:8px 10px;text-align:left;border-bottom:1px solid #243154} th{background:#1d294a;color:#bcd0f5;font-weight:700}
 tr:last-child td{border-bottom:none}
 a{color:#7db4ff}
 .barwrap{background:#243154;border-radius:5px;height:9px;width:72px;overflow:hidden}
 .bar{height:100%;border-radius:5px}
 .cnt{font-size:10px;color:#9fb0cf;margin-top:3px;white-space:nowrap}
</style></head><body>
<h1>まいにちJLPT 計測ダッシュボード</h1>
<div class="sub">匿名・利用状況データの集計。PIIなし。自動更新は無し(再読込で最新)。</div>
<div class="sub">CSV(個別の生データ・全件): <a href="/export?k=${esc(key)}&t=snapshots">スナップショット</a> ／ <a href="/export?k=${esc(key)}&t=mocks">模試</a> ／ <a href="/export?k=${esc(key)}&t=events">行動イベント</a></div>
<div class="cards">
 <div class="card"><div class="v">${esc(ov.users || 0)}</div><div class="l">ユーザー(匿名)</div></div>
 <div class="card"><div class="v">${esc(ov.snaps || 0)}</div><div class="l">スナップショット</div></div>
 <div class="card"><div class="v">${esc(ov.events || 0)}</div><div class="l">行動イベント</div></div>
 <div class="card"><div class="v">${esc(ov.mocks || 0)}</div><div class="l">模試</div></div>
</div>
<h2>継続度合（リテンション）</h2>
<div class="cards">
 <div class="card"><div class="v">${esc(ret.avg_streak || 0)}日</div><div class="l">平均 連続日数(現在)</div></div>
 <div class="card"><div class="v">${esc(ret.max_streak || 0)}日</div><div class="l">最大 連続日数</div></div>
 <div class="card"><div class="v">${esc(ret.avg_days || 0)}日</div><div class="l">平均 利用日数/人</div></div>
 <div class="card"><div class="v">${esc(ret.repeat_rate || 0)}%</div><div class="l">リピート率(2日以上)</div></div>
</div>
<h2>レベル別（各ユーザーの最新スナップショット・平均）</h2>
${table(['レベル', 'ユーザー', '到達度', '漢字語彙', '文法', '読解', '聴解', '習得数', '読解枯渇%', '聴解枯渇%'], byLevel)}
<h2>行動イベント（累計）</h2>
${table(['イベント', '回数'], ev)}
<h2>セッション内訳（区分別・累計／最後に全体）</h2>
${table(['セッション種類', '回数'], sessRows)}
<h2>模試</h2>
${table(['レベル', '受験数', '平均得点率', '時間切れ%'], mk)}
<h2>個別スナップショット（最新50件・横バー=区分到達度／下=学習済/全数）</h2>
${indivTable(recent)}
</body></html>`;
  return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
}
