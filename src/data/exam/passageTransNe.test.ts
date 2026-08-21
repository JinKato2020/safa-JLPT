import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PASSAGE_TRANS_NE as trans, READING as reading, PASSAGE_GRAMMAR as pg } from '../index'; // rehydrate由来(旧 exam/*.json 相当)

const T = trans as Record<string, string[]>;

// 期待する本文数。情報検索(joho)は図表主体で InfoSearchFigure が描画し、
// PASSAGE_TRANS_NE(本文ネパール訳)を一切使わないので期待から除外する。
const wantReading: Record<string, number> = {};
for (const r of reading as any[]) if (r.subtype !== 'joho') wantReading[r.id] = 1;
const wantPg: Record<string, number> = {};
for (const s of pg as any[]) wantPg[s.id] = s.passages.length;

// ── 既知の借金（2026-07-26 ユーザー判断で保留）─────────────────────────────
// 文章の文法(passage_grammar)の本文ネパール語訳は未作成。200セット / 280本文 / 79,072字。
// 翻訳は有料APIを使うため「今は作らない」と決定（費用: Opus約¥2,300 / Sonnet約¥450 / Flash約¥100）。
// アプリは PassageSetPlayer.tsx が l1==='ne' の時だけ訳トグルを出すので落ちない＝
// 「ネパール語話者に文章の文法だけ訳が出ない」という体験の欠けだけが残っている状態。
// ここは "増えていないこと" を見張る。訳を作ったらこの数を減らし、0 になったら
// この定数ごと消して wantPg を上の完全チェック側へ戻す。
// 2026-08-21: 文章の文法 N4 を新方式50問へ全面差替（旧80問は没問題へ退避）。未訳 200→170。
// 2026-08-21: 続けて N3 を新方式20問へ全面差替（旧40問は没問題へ退避）。未訳 170→150（旧N3 40退避 − 新N3 20追加 = −20）。翻訳は従来方針どおり未作成。
const KNOWN_PG_UNTRANSLATED = 150;
// ────────────────────────────────────────────────────────────────

test('読解セット(joho以外)は全部ネパール語訳がある', () => {
  const missing = Object.keys(wantReading).filter((id) => !T[id]);
  assert.equal(missing.length, 0, `訳欠落: ${missing.slice(0, 5)}`);
});

test('文章の文法の未訳セット数が既知の借金から増えていない', () => {
  const missing = Object.keys(wantPg).filter((id) => !T[id]);
  assert.equal(
    missing.length,
    KNOWN_PG_UNTRANSLATED,
    `文章の文法の未訳が ${KNOWN_PG_UNTRANSLATED} → ${missing.length} に変化。` +
      `増えたなら本文追加時に訳を作り忘れている。減ったなら KNOWN_PG_UNTRANSLATED を更新する。例: ${missing.slice(0, 3)}`,
  );
});

test('存在する訳は本文数一致・非空・デーヴァナーガリー', () => {
  const want = { ...wantReading, ...wantPg };
  const badLen: string[] = [];
  const empty: string[] = [];
  for (const id in want) {
    const v = T[id];
    if (!v) continue; // 欠落は上の2テストが見る
    if (v.length !== want[id]) badLen.push(id);
    for (const s of v) if (!s || !/[ऀ-ॿ]/.test(s)) empty.push(id); // Devanagari必須
  }
  assert.equal(badLen.length, 0, `本文数不一致: ${badLen.slice(0, 5)}`);
  assert.equal([...new Set(empty)].length, 0, `空/非デーヴァナーガリー: ${[...new Set(empty)].slice(0, 5)}`);
});

test('PASSAGE_TRANS_NE に余計なidが入っていない', () => {
  const want = { ...wantReading, ...wantPg };
  const extra = Object.keys(T).filter((id) => !(id in want));
  assert.equal(extra.length, 0, `対応するセットが無い訳: ${extra.slice(0, 5)}`);
});
