// chunk_runner.mjs — 汎用チェックポイント実行器
// 目的: サブエージェント/スクリプトで大量データを作成・修正する時、「全部やってから一括書き出し」
//       をやめ、チャンク(小分け)ごとに durable に保存する。途中でエラー・出力上限(約64k)・kill で
//       落ちても、そこまでの結果は残り、同じコマンドの再実行で「落ちた所から」続きを作れる。
// 依存なし(Node標準のみ)。Gemini作問/Claudeサブエージェント/本体のどれからでも import して使える。
//
// 使い方(新規作成):
//   import { runChunked, mergeChunks } from './tools/chunk_runner.mjs';
//   const items = [...];                       // 作る対象(語・問題ID 等)の配列
//   await runChunked({
//     items, chunkSize: 6, outDir: 'out/mono',
//     processChunk: async (chunk, i) => await genItems(chunk),   // ← 生成の実体(配列を返す)
//   });
//   mergeChunks('out/mono', 'out/mono/_final.json');            // 全chunkを結合
//
// 使い方(既存修正=IDで差し戻し):
//   await runChunked({ items: idsToFix, chunkSize: 6, outDir: 'out/figfix',
//     processChunk: async (ids) => ids.map(id => patchOne(id)) });   // ← 直した item 配列を返す
//   mergeById('out/figfix', 'content/problems/dokkai/joho_N4.json', 'id');  // 元ファイルへID上書き
//
// 再開: 同じ outDir でもう一度実行するだけ。既存 chunk_NN.json は自動スキップ。
// 進捗確認(データ本文を会話に載せない): status(outDir) が {done,total?,lastLedger} を返す。

import {
  readFileSync, writeFileSync, existsSync, mkdirSync,
  renameSync, unlinkSync, readdirSync, appendFileSync,
} from 'node:fs';
import { join } from 'node:path';

const pad = (n) => String(n).padStart(3, '0');
const chunkPath = (outDir, i) => join(outDir, `chunk_${pad(i)}.json`);

// 配列を size ごとに分割
export function planChunks(items, size) {
  const s = Math.max(1, size | 0);
  const out = [];
  for (let i = 0; i < items.length; i += s) out.push(items.slice(i, i + s));
  return out;
}

// 既存 chunk が「妥当なJSON」かを確認(壊れていたら作り直す)
function chunkIsValid(f, validate) {
  if (!existsSync(f)) return false;
  try {
    const parsed = JSON.parse(readFileSync(f, 'utf8'));
    return validate ? !!validate(parsed) : true;
  } catch { return false; }
}

// 原子的書き込み(.tmp→rename)。Windowsで既存があるとrenameが失敗するので先に消す。
function atomicWrite(f, data) {
  const tmp = f + '.tmp';
  writeFileSync(tmp, typeof data === 'string' ? data : JSON.stringify(data));
  if (existsSync(f)) unlinkSync(f);
  renameSync(tmp, f);
}

// 本体: チャンクごとに処理→即保存→台帳追記。既存はスキップ。エラーは即中断(そこまでは残る)。
// stamp は Date.now() を使わない環境(Workflow等)向けに呼び出し側から渡す任意の時刻文字列。
export async function runChunked({ items, chunkSize, outDir, processChunk, validate, stamp = '' }) {
  mkdirSync(outDir, { recursive: true });
  const chunks = planChunks(items, chunkSize);
  const ledger = join(outDir, '_ledger.jsonl');
  let done = 0, skipped = 0;
  for (let i = 0; i < chunks.length; i++) {
    const f = chunkPath(outDir, i);
    if (chunkIsValid(f, validate)) { skipped++; continue; }
    // processChunk が throw したらここで中断。i-1 までの chunk ファイルは既に残っている。
    const result = await processChunk(chunks[i], i, chunks.length);
    atomicWrite(f, result);
    appendFileSync(ledger, JSON.stringify({ i, n: Array.isArray(result) ? result.length : null, stamp }) + '\n');
    done++;
  }
  return { total: chunks.length, done, skipped };
}

// 進捗のみ返す(データ本文は返さない=会話を太らせない)。再開前の状況把握に。
export function status(outDir) {
  if (!existsSync(outDir)) return { done: 0, files: [] };
  const files = readdirSync(outDir).filter((x) => /^chunk_\d+\.json$/.test(x)).sort();
  let last = null;
  const lf = join(outDir, '_ledger.jsonl');
  if (existsSync(lf)) {
    const lines = readFileSync(lf, 'utf8').trim().split('\n').filter(Boolean);
    if (lines.length) { try { last = JSON.parse(lines[lines.length - 1]); } catch {} }
  }
  return { done: files.length, files, lastLedger: last };
}

// 全 chunk(配列)を順に結合して1ファイルへ(新規作成向け)
export function mergeChunks(outDir, outFile) {
  const files = readdirSync(outDir).filter((x) => /^chunk_\d+\.json$/.test(x)).sort();
  const all = [];
  for (const x of files) {
    const v = JSON.parse(readFileSync(join(outDir, x), 'utf8'));
    if (Array.isArray(v)) all.push(...v); else all.push(v);
  }
  if (outFile) atomicWrite(outFile, all);
  return all;
}

// 修正向け: chunk 群(直した item)を key で元ファイルへ差し戻し。
// 浅いマージ({...元, ...patch})なので、patch に含めた"トップレベルのフィールドだけ"が上書きされ、
// 含めなかったフィールド(本文・選択肢・ふりがな・多言語訳 等)は baseFile 側が温存される。
// → 「図(figure)だけ差し替え」なら patch は {id, figure} だけで良い(残りは自動で残る)。
export function mergeById(outDir, baseFile, key = 'id') {
  const base = JSON.parse(readFileSync(baseFile, 'utf8'));
  const arr = Array.isArray(base) ? base : (base.items || base.data);
  if (!Array.isArray(arr)) throw new Error('baseFile が配列/items/data 形式でない: ' + baseFile);
  const patches = mergeChunks(outDir, null); // 直した item を全部集める
  const byId = new Map(patches.map((p) => [p[key], p]));
  let replaced = 0;
  for (let i = 0; i < arr.length; i++) {
    const p = byId.get(arr[i][key]);
    if (p) { arr[i] = { ...arr[i], ...p }; replaced++; } // 浅いマージ=渡した欄だけ上書き
  }
  atomicWrite(baseFile, base);
  return { replaced, patches: patches.length, missing: patches.length - replaced };
}
