// Webアプリ(トンネル)に現実的seedを投入し、各画面を1320×2868(440x956@3x)で撮影。
const { chromium } = require('playwright-core');
const fs = require('fs');
const URL = process.argv[2] || 'https://gbizncg-jinkato1914-8083.exp.direct';
const seed = fs.readFileSync('./seed.json', 'utf8');
const OUT = './raw';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  console.log('goto', URL);
  await page.goto(URL, { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(10000);
  await page.evaluate((s) => localStorage.setItem('safa-jlpt:state:v1', s), seed);
  await page.reload({ waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(9000);

  const shot = async (name) => { await page.screenshot({ path: `${OUT}/${name}.png` }); console.log('shot', name); };
  const scrollTo = async (text) => {
    try { await page.getByText(text, { exact: false }).first().scrollIntoViewIfNeeded({ timeout: 6000 }); await page.waitForTimeout(900); }
    catch (e) { console.log('scroll miss:', text, '-', e.message.split('\n')[0]); }
  };
  const tab = async (name) => {
    try { await page.getByText(name, { exact: true }).last().click({ timeout: 6000 }); await page.waitForTimeout(1800); }
    catch (e) { console.log('tab miss:', name, '-', e.message.split('\n')[0]); }
  };

  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  await shot('01_home');
  await tab('学習');
  await shot('02_study');
  await tab('テスト');
  await shot('03_test');
  await tab('辞書');
  await shot('04_dict');
  await tab('ホーム');
  await page.waitForTimeout(800);
  await scrollTo('継続');
  await shot('05_streak');

  await browser.close();
  console.log('done');
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
