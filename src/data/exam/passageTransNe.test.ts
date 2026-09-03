import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PASSAGE_TRANS_NE as trans, READING as reading, READING_MOCK as readingMock, PASSAGE_GRAMMAR as pg, LISTENING as listening, LISTENING_MOCK as listeningMock, listeningSubtype } from '../index'; // rehydrate由来(旧 exam/*.json 相当)

const T = trans as Record<string, string[]>;

// 期待する本文数。情報検索(joho)は図表主体で InfoSearchFigure が描画し、
// PASSAGE_TRANS_NE(本文ネパール訳)を一切使わないので期待から除外する。
// 学習(READING)と模試(READING_MOCK)の両方を検査（2026-08-31 読解mock翻訳完了で mock も ne 必須）。
const wantReading: Record<string, number> = {};
for (const r of [...(reading as any[]), ...(readingMock as any[])]) if (r.subtype !== 'joho') wantReading[r.id] = 1;
const wantPg: Record<string, number> = {};
for (const s of pg as any[]) wantPg[s.id] = s.passages.length;
// 聴解 課題理解(kadai)/ポイント理解(point)/概要理解(gaiyou)/発話表現(hatsuwa)は台本(場面文)訳を PASSAGE_TRANS_NE へ入れる(kadai=2026-09-02 / point,gaiyou,hatsuwa=2026-09-03)。
// 台本の行数は可変ゆえ期待本文数は実長を採る(行数一致チェックは自明成立・非空/デーヴァナーガリーは有効)。完全性は専用テストで別途見張る。
const scriptTransSubs = new Set(['kadai', 'point', 'gaiyou', 'hatsuwa', 'sokuji']);
const kadaiItems = [...(listening as any[]), ...(listeningMock as any[])].filter((l) => scriptTransSubs.has(listeningSubtype(l)));
const wantListening: Record<string, number> = {};
for (const l of kadaiItems) wantListening[l.id] = T[l.id]?.length ?? 1;

// ── 文章の文法の本文ネパール語訳（2026-08-23 全210セット翻訳完了で借金ゼロ）──────
// 経緯: 長らく未作成の「借金」だった（Flash約¥100の見積りで保留）。2026-08-23 に
// 全210セット(N5 80/N4 60/N3 70)の本文＋選択肢を en/ne 両方へ翻訳し反映（Gemini2.5Flash・実費約¥82）。
// これで pg の未訳は 0。以後は「未訳が増えていない(=0)」を見張る。本文追加時は訳も同時に作ること。
const KNOWN_PG_UNTRANSLATED = 0;
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

test('聴解 課題理解(kadai)/ポイント理解(point)は全部ネパール語訳がある', () => {
  const missing = kadaiItems.map((l) => l.id).filter((id) => !T[id]);
  assert.equal(missing.length, 0, `台本訳欠落(kadai/point): ${missing.slice(0, 5)}`);
});

test('存在する訳は本文数一致・非空・デーヴァナーガリー', () => {
  const want = { ...wantReading, ...wantPg, ...wantListening };
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
  const want = { ...wantReading, ...wantPg, ...wantListening };
  const extra = Object.keys(T).filter((id) => !(id in want));
  assert.equal(extra.length, 0, `対応するセットが無い訳: ${extra.slice(0, 5)}`);
});
