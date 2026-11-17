const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { launch } = require('puppeteer-core');
function lessonHtml(level = 'N4') {
 return fs.readFileSync(path.join(__dirname,'../assets/radical-lessons/course.html'),'utf8')
  .replace('/*APP_LESSON_CONFIG*/ {}',JSON.stringify({language:'en',level,completed:{}}))
  .replace('<head>','<head><script>window.sent=[];window.ReactNativeWebView={postMessage:s=>sent.push(JSON.parse(s))};</script>');
}
test('offline scroll course exposes 24 complete lessons and native dictionary-audio/progress events', async()=>{
 const browser=await launch({executablePath:process.env.JLPT_TEST_CHROME,headless:true});
 try{const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.setViewport({width:320,height:740});await page.setRequestInterception(true);
 page.on('request',r=>r.url().startsWith('data:')?r.continue():r.abort());
 await page.goto('about:blank');await page.setContent(lessonHtml(),{waitUntil:'load'});
 assert.equal(await page.evaluate(()=>currentLevel),'N4');
 for(const level of ['N5','N4','N3']) {
 await page.goto('about:blank');await page.setContent(lessonHtml(level),{waitUntil:'load'});
 assert.equal((await page.$$('.level-tab')).length,0);
 assert.equal(await page.$('.level-tabs'),null);
 const ids=await page.evaluate(level=>lessons.filter(l=>l.level===level).map(l=>l.id),level);
 assert.equal((await page.$$('.lesson-card')).length,ids.length);
 const titles=await page.$$eval('.lesson-card h2',els=>els.map(e=>e.textContent));
 for(const title of titles) assert.match(title,/^[^＋→＝]+＝[^＝]+$/);
 if(level==='N3'){assert(titles.includes('氵＝水'));assert(titles.includes('亻＝人'));}
 for(const id of ids){
  await page.evaluate(id=>location.hash=id,id);await page.waitForFunction(id=>current?.id===id,{},id);
  assert.equal((await page.$$('.reading-section')).length,4);
  const source=await page.evaluate(()=>current.radicalSource);
  if(source) assert.equal(await page.$eval('.radical-source',e=>e.href),source);
  await page.waitForFunction(()=>document.querySelector('.hero-art').naturalWidth>0);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),id+' fits 320px');
 }
 await page.evaluate(level=>location.hash=level==='N5'?'n3-feelings':'human',level);
 await page.waitForSelector('.lesson-grid');assert.equal(await page.$('.reading-lesson'),null);
 }
 await page.goto('about:blank');await page.setContent(lessonHtml('N4'),{waitUntil:'load'});
 await page.evaluate(()=>location.hash='n4-water');await page.waitForSelector('[data-word="池"]');await page.click('[data-word="池"]');
 const request=await page.evaluate(()=>sent.findLast(e=>e.type==='speak'));
 assert.equal(request.word,'池');assert.equal(request.reading,'いけ');assert.equal(typeof request.requestId,'number');
 await page.evaluate(id=>window.onNativeAudioStatus(id,'recording'),request.requestId);assert.match(await page.$eval('#audio-status',e=>e.textContent),/Dictionary audio/);
 await page.click('#mark-read');assert(await page.evaluate(()=>sent.some(e=>e.type==='complete'&&e.id==='n4-water')));
 await page.evaluate(()=>location.hash='human');await page.waitForSelector('.lesson-grid');assert.equal(await page.evaluate(()=>sent.some(e=>e.type==='view'&&e.level==='N5')),false);
 assert(await page.evaluate(()=>sent.some(e=>e.type==='stop-audio')));assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});

test('targets and example words stay within the app kanji level',()=>{const vm=require('node:vm');const lessons=vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../docs/previews/radicals-lessons.js'),'utf8')+';RADICAL_LESSONS');const levels=require('../src/data/dict/kanjiJlptLevel.json').items;for(const l of lessons)for(const text of [...l.cards.map(c=>c.char),...l.words.map(w=>w[0])])for(const char of text.match(/\p{Script=Han}/gu)||[])assert(levels[char]&&Number(levels[char].slice(1))>=Number(l.level.slice(1)),l.id+' '+char);});
