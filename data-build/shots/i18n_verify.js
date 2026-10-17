// uiLang をseedに注入し、各言語でホーム画面を撮影してレンダリング確認。
const { chromium } = require('playwright-core');
const fs = require('fs');
const URL = process.argv[2] || 'https://gbizncg-jinkato1914-8083.exp.direct';
const LANGS = (process.argv[3] || 'en,th,ne,my').split(',');
const seedBase = JSON.parse(fs.readFileSync('./seed.json', 'utf8'));
const OUT = './i18n_shots';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(10000);
  for (const lang of LANGS) {
    const seed = JSON.stringify({ ...seedBase, settings: { ...seedBase.settings, uiLang: lang, onboarded: true, tourDone: true } });
    await page.evaluate((s) => localStorage.setItem('safa-jlpt:state:v1', s), seed);
    await page.reload({ waitUntil: 'load', timeout: 90000 });
    await page.waitForTimeout(7000);
    await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
    await page.screenshot({ path: `${OUT}/${lang}_home.png` });
    console.log('shot', lang);
  }
  await browser.close();
  console.log('done');
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
