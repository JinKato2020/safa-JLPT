// SNSモック画像の量産（ヘッドレスChromeで実AICoach画面をフルページ撮影）。
// 前提: (1) node --import tsx tools/sns/gen_state.ts でダミー状態を生成済み
//       (2) npx expo start --web --port 8081 が起動中（?snsdemo で AICoach 単独描画）
// 実行: node tools/sns/shoot.mjs            … 全言語×2状態
//       node tools/sns/shoot.mjs ja passing … 1言語1状態だけ（spike検証用）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const STATE_KEY = 'safa-jlpt:state:v1';
const URL = 'http://localhost:8081/?snsdemo=1&lang=';

const LANGS = ['ko', 'zh', 'vi', 'id', 'th', 'my', 'bn'];
const LEVEL = { passing: 'N4', beginner: 'N5' };
const STATES = ['beginner', 'passing'];

const seeds = {
  passing: JSON.parse(fs.readFileSync(path.join(__dirname, 'passing.json'), 'utf8')),
  beginner: JSON.parse(fs.readFileSync(path.join(__dirname, 'beginner.json'), 'utf8')),
};

const argLang = process.argv[2];
const argState = process.argv[3];
const langs = argLang ? [argLang] : LANGS;
const states = argState ? [argState] : STATES;

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--hide-scrollbars', '--force-device-scale-factor=3', '--font-render-hinting=none'],
  });
  const page = await browser.newPage();

  // ScrollView 内のコンテンツ実高さ（CSS px）を測る。AICoach は ScrollView でクリップされるため
  // fullPage では画面分しか撮れない → 実高さを測ってビューポートを広げ、全内容を1枚に収める。
  const contentHeight = () => page.evaluate(() => {
    let max = 0;
    for (const e of document.querySelectorAll('*')) {
      const s = getComputedStyle(e);
      if (/(scroll|auto)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 4) max = Math.max(max, e.scrollHeight);
    }
    return max || document.documentElement.scrollHeight;
  });

  for (const state of states) {
    for (const lang of langs) {
      const seed = { ...seeds[state], settings: { ...seeds[state].settings, uiLang: lang } };
      await page.setViewport({ width: 390, height: 900, deviceScaleFactor: 3 });
      // localStorage を先に仕込む（次のロードで StoreProvider が読む）
      await page.evaluateOnNewDocument((key, val) => { try { localStorage.setItem(key, val); } catch (e) {} }, STATE_KEY, JSON.stringify(seed));
      await page.goto(URL + lang, { waitUntil: 'networkidle2', timeout: 120000 });
      await page.waitForFunction(() => document.body && document.body.innerText.length > 200, { timeout: 60000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 1200));

      // 実高さを測る → ビューポートをその高さへ広げ、ScrollView を全展開
      const h = Math.ceil(await contentHeight());
      await page.setViewport({ width: 390, height: h + 8, deviceScaleFactor: 3 });
      await new Promise((r) => setTimeout(r, 700));

      const outDir = path.join(ROOT, '画像', 'SNS', '1', lang);
      fs.mkdirSync(outDir, { recursive: true });
      const out = path.join(outDir, `AICoach_${state}_${LEVEL[state]}_${lang.toUpperCase()}.png`);
      await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 390, height: h + 8 } });
      console.log('saved', out, `(${(h + 8) * 3}px tall)`);
    }
  }
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
