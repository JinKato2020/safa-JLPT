const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { launch } = require('puppeteer-core');

function lessonHtml(name) {
  return fs.readFileSync(path.join(__dirname, '../assets/radical-lessons', name + '.html'), 'utf8')
    .replace('/*APP_LESSON_CONFIG*/ {}', '{"language":"en","level":"N4","completed":{}}')
    .replace('<head>', '<head><script>window.sent=[];window.ReactNativeWebView={postMessage:s=>sent.push(JSON.parse(s))};</script>');
}

test('the embedded course and person lesson open offline and report lesson selection', async () => {
  const browser = await launch({ executablePath: process.env.JLPT_TEST_CHROME, headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.setRequestInterception(true);
    page.on('request', request => request.url().startsWith('data:') ? request.continue() : request.abort());
    await page.setContent(lessonHtml('course'), { waitUntil: 'load' });
    assert.equal(await page.$eval('.level-tab.selected', el => el.textContent.slice(0, 2)), 'N4');

    for (const level of ['N5', 'N4', 'N3']) {
      await page.evaluate(level => { location.hash = level; }, level);
      await page.waitForFunction(level => document.querySelector('.level-tab.selected').textContent.startsWith(level), {}, level);
      assert.equal((await page.$$('.lesson-card')).length, 6);
      await page.$$eval('.lesson-card img', images => images.forEach(image => { image.loading = 'eager'; }));
      await page.waitForFunction(() => [...document.querySelectorAll('.lesson-card img')]
        .every(image => image.src.startsWith('data:image/') && image.naturalWidth > 0));
    }
    await page.click('.lesson-card');
    await page.waitForFunction(() => sent.some(event => event.type === 'view' && event.id === 'n3-feelings'));
    assert.ok(await page.$eval('.scene', image => image.src.startsWith('data:image/')));
    await page.waitForFunction(() => document.querySelector('.scene').naturalWidth > 0);
    await page.evaluate(() => { location.hash = 'N5'; });
    await page.waitForSelector('[data-app-page=human]');
    await page.click('[data-app-page=human]');
    assert.ok(await page.evaluate(() => sent.some(event => event.type === 'page' && event.page === 'human')));

    const human = await browser.newPage();
    human.on('pageerror', error => errors.push(String(error)));
    await human.setContent(lessonHtml('human'), { waitUntil: 'load' });
    assert.ok(await human.$('[data-app-page=course]'));
    assert.ok(await human.$eval('.sakura-person', image => image.complete && image.naturalWidth > 0));
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
