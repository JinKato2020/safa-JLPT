-- safa まいにちJLPT 匿名計測 D1 スキーマ。クライアント(telemetry.ts)の payload と整合。
-- 4区分 = moji_goi(漢字・語彙) / bunpou(文法) / dokkai(読解) / choukai(聴解)。

CREATE TABLE IF NOT EXISTS snapshots (
  anon_id TEXT, day TEXT, ts INTEGER,
  level TEXT, ui_lang TEXT, app TEXT, platform TEXT, country TEXT,
  r_total INTEGER, r_moji_goi INTEGER, r_bunpou INTEGER, r_dokkai INTEGER, r_choukai INTEGER,
  learned INTEGER, streak INTEGER,
  rem_moji_goi INTEGER, rem_bunpou INTEGER, rem_dokkai INTEGER, rem_choukai INTEGER,
  tot_moji_goi INTEGER, tot_bunpou INTEGER, tot_dokkai INTEGER, tot_choukai INTEGER,  -- 区分別の全数(枯渇率=1-rem/tot の算出用)
  exhausted TEXT,
  PRIMARY KEY (anon_id, day)            -- 1ユーザー/日=1行(upsert)
);

CREATE TABLE IF NOT EXISTS mocks (
  anon_id TEXT, ts INTEGER, level TEXT, full INTEGER, pct INTEGER,
  p_moji_goi INTEGER, p_bunpou INTEGER, p_dokkai INTEGER, p_choukai INTEGER,
  timed_out INTEGER, elapsed_sec INTEGER, app TEXT
);
CREATE INDEX IF NOT EXISTS idx_mocks_ts ON mocks(ts);

CREATE TABLE IF NOT EXISTS events (
  anon_id TEXT, ts INTEGER, name TEXT, props TEXT, app TEXT, level TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_name ON events(name, ts);
