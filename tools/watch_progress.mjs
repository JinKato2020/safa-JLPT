// watch_progress.mjs — chunk_runner の進捗をプロセス側で見張る停止検知ウォッチドッグ
// 目的: 大量ジョブを一括で回すと「止まっていても気づけない」(開始1秒で死んで1時間待つ)。
//       会話でポーリングすると往復ごとに全読み直し=高コスト(A4違反)。そこで本スクリプトを
//       バックグラウンドで1本だけ走らせ、「停止」か「完了」を検知した時だけ1行を出して終了する。
//       run_in_background で起動→終了時に通知が1回だけ来る=通知駆動(A4準拠)。
//
// 使い方:
//   node tools/watch_progress.mjs <outDir> --total <N> [--stall 180] [--poll 20] [--max 7200]
//     <outDir>  chunk_runner の出力先(chunk_NN.json と _ledger.jsonl が貯まる場所)
//     --total   期待チャンク総数(分かれば。完了検知に使う)
//     --stall   何秒 新チャンクが増えなければ「停止」とみなすか(既定180)
//     --poll    何秒ごとに見るか(既定20。会話ではなくこのプロセス内の待機なので会話は増えない)
//     --max     見張りの上限秒(既定7200=2時間。念のための自動終了)
//   → 標準出力に1行だけ: "PROGRESS-DONE ..." / "PROGRESS-STALLED ..." / "PROGRESS-TIMEOUT ..."
//   → 終了コード: DONE=0 / STALLED=2 / TIMEOUT=3 (非0で通知が目立つ)

import { readdirSync, existsSync } from 'node:fs';

const args = process.argv.slice(2);
const outDir = args[0];
const opt = (name, def) => {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] != null ? Number(args[i + 1]) : def;
};
const total = opt('total', 0);          // 0=不明(完了検知しない・停止検知のみ)
const stall = opt('stall', 180);
const poll = opt('poll', 20);
const max = opt('max', 7200);

if (!outDir) { console.log('PROGRESS-ERROR outDir未指定'); process.exit(1); }

const countChunks = () => {
  if (!existsSync(outDir)) return 0;
  try { return readdirSync(outDir).filter((x) => /^chunk_\d+\.json$/.test(x)).length; }
  catch { return 0; }
};
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));

const startAt = Date.now();
let lastCount = -1;
let lastProgressAt = Date.now();   // 最後に「件数が増えた」壁時計時刻(このプロセス基準=実時刻でOK)

for (;;) {
  const count = countChunks();
  if (count !== lastCount) { lastCount = count; lastProgressAt = Date.now(); }

  if (total > 0 && count >= total) {
    console.log(`PROGRESS-DONE ${count}/${total} 完了 (${Math.round((Date.now() - startAt) / 1000)}s)`);
    process.exit(0);
  }
  const idle = Math.round((Date.now() - lastProgressAt) / 1000);
  if (idle >= stall) {
    const ttl = total > 0 ? `/${total}` : '';
    console.log(`PROGRESS-STALLED ${count}${ttl} 件で ${idle}s 新規なし=停止の疑い。要確認(ログ/再開)。`);
    process.exit(2);
  }
  if ((Date.now() - startAt) / 1000 >= max) {
    console.log(`PROGRESS-TIMEOUT 見張り上限${max}s到達。現在 ${lastCount} 件。`);
    process.exit(3);
  }
  await sleep(poll);
}
