'use strict';
const lessons = RADICAL_LESSONS;
const appLesson = window.APP_RADICAL_CONFIG || {};
const sendNative = (type, values = {}) => window.ReactNativeWebView?.postMessage(JSON.stringify({type, ...values}));
const imageURL = name => window.RADICAL_ART?.[name] || 'assets/' + name;
const el = id => document.getElementById(id);
const escapeHTML = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let language = appLesson.language === 'en' ? 'en' : 'ja';
let current = null;
const fixedLevel = appLesson.level || new URLSearchParams(location.search).get('level');
let currentLevel = ['N5','N4','N3'].includes(fixedLevel) ? fixedLevel : 'N5';
let completed = appLesson.completed || {};
if (!window.ReactNativeWebView) try { completed = JSON.parse(localStorage.getItem('radicals-reading-v2') || '{}') || {}; } catch {}
const L = (ja, en) => language === 'ja' ? ja : en;
function bilingual(value, cls = '') {
  const first = language === 'ja' ? 'ja' : 'en', second = first === 'ja' ? 'en' : 'ja';
  return `<div class="bilingual ${cls}"><p lang="${first}">${escapeHTML(value[first])}</p><p class="translation" lang="${second}">${escapeHTML(value[second])}</p></div>`;
}
function wordButton([word, reading, meaning]) {
  return `<button class="word" data-word="${escapeHTML(word)}" data-reading="${escapeHTML(reading)}" aria-label="${escapeHTML(word)}（${escapeHTML(reading)}） ${L('音声を聞く','Listen')}"><span class="word-copy"><ruby lang="ja">${escapeHTML(word)}<rt>${escapeHTML(reading)}</rt></ruby><span lang="en" class="word-meaning">${escapeHTML(meaning)}</span></span><span class="play" aria-hidden="true">▶</span></button>`;
}
function flow(lesson) {
  return `<div class="learning-flow" aria-label="${L('部首から漢字、単語へ','Radical to kanji to word')}"><div><span>01 ${L('部首','RADICAL')}</span><strong>${lesson.title.split('＝')[0]}</strong></div><b aria-hidden="true">→</b><div><span>02 ${L('漢字','KANJI')}</span><strong>${lesson.cards[0].char}</strong></div><b aria-hidden="true">→</b><div><span>03 ${L('単語','WORD')}</span><strong class="flow-word">${(lesson.id==='n4-water'?lesson.words[2]:lesson.words.find(w=>w[0].includes(lesson.cards[0].char))||lesson.words[0])[0]}</strong></div></div>`;
}
function cardMarkup(card) {
  const tags = {origin:L('成り立ち','ORIGIN'),structure:L('意味と音','MEANING + SOUND'),memory:L('覚えるためのお話','MEMORY STORY')};
  const partLabels = {meaning:L('意味の手がかり','MEANING'),sound:L('音の手がかり','SOUND'),shape:L('形のまとまり','SHAPE')};
  const pieces = card.parts.map(part=>`<div class="part ${part[3]}"><span class="part-role">${partLabels[part[3]]}</span><strong lang="ja">${part[0]}</strong><span lang="ja">${part[1]}</span><small lang="en">${part[2]}</small></div>`).join('<span class="operator" aria-hidden="true">＋</span>');
  return `<article class="kanji-card"><header><span class="tag ${card.kind}">${tags[card.kind]}</span><span class="card-reading" lang="ja">${card.reading}</span></header><div class="decomposition">${pieces}<span class="operator" aria-hidden="true">＝</span><div class="part result"><strong lang="ja">${card.char}</strong><span lang="ja">${card.meaning.ja}</span><small lang="en">${card.meaning.en}</small></div></div>${bilingual(card.story)}${card.source?`<a class="source-inline" href="${card.source}" target="_blank" rel="noopener noreferrer">${L('成り立ちの出典','Origin reference')} ↗</a>`:''}</article>`;
}
function renderMenu() {
  current = null;
  el('app').innerHTML = `<section class="welcome"><p class="eyebrow">SAKURA’S KANJI NOTEBOOK</p><h1>${L('部首 → 漢字 → 単語','Radicals → Kanji → Words')}</h1>${bilingual({ja:'知っている部品が、新しい漢字を覚える手がかりに。',en:'Known parts make new kanji easier to remember.'})}${flow(lessons.find(l=>l.level===currentLevel))}</section><section class="lesson-grid">${lessons.filter(l=>l.level===currentLevel).map(l=>`<a class="lesson-card" href="#${l.id}"><img src="${imageURL(l.image)}" alt="${l.title} / ${l.english}" width="1536" height="1024" loading="lazy"><div class="card-copy"><span class="eyebrow">${l.english}</span><h2 lang="ja">${l.title}</h2><p class="card-family">${l.cards.map(c=>c.char).join(' · ')}</p><span class="open">${completed[l.id]?L('読了 ✓','Read ✓'):L('読んで学ぶ →','Read the lesson →')}</span></div></a>`).join('')}</section><p class="menu-note">${L('部品の意味や音から、ことばへつなげて覚えます。','Connect meaningful parts and sound clues to useful words.')}</p>`;
}
function sectionTitle(number, ja, en) {
  return `<div class="section-title"><span>${number}</span><h2>${L(ja,en)}<small>${L(en,ja)}</small></h2></div>`;
}
function renderLesson() {
  const l=current;
  const sources=[...new Set(l.cards.map(c=>c.source).filter(Boolean))];
  el('app').innerHTML=`<article class="reading-lesson"><a class="back-menu" href="#${l.level}">← ${L('レッスン一覧','All lessons')}</a><header class="lesson-hero"><div><p class="eyebrow">${l.level} · ${l.english}</p><h1 lang="ja">${l.title}</h1><p class="radical-name" lang="ja">${l.name}</p>${bilingual(l.insight,'hero-insight')}</div><img class="hero-art" src="${imageURL(l.image)}" alt="${l.title} / ${l.english}" width="1536" height="1024"></header>${flow(l)}<nav class="reading-nav" aria-label="${L('レッスン内の移動','Lesson sections')}"><button data-jump="radical">01 ${L('部首','Radical')}</button><button data-jump="kanji">02 ${L('漢字','Kanji')}</button><button data-jump="words">03 ${L('単語','Words')}</button><button data-jump="clue">04 ${L('応用','Apply')}</button></nav><section id="radical" class="reading-section">${sectionTitle('01','部首から意味をつかむ','Start with a meaning family')}<div class="radical-explanation"><strong class="radical-large" lang="ja">${l.title.split('＝')[0]}</strong>${bilingual(l.radical)}</div></section><section id="kanji" class="reading-section">${sectionTitle('02','組み合わせから漢字を覚える','Build a memorable kanji')}<div class="legend"><span class="meaning">● ${L('意味','Meaning')}</span><span class="sound">● ${L('音','Sound')}</span><span class="shape">● ${L('形・お話','Shape / story')}</span></div>${l.cards.map(cardMarkup).join('')}</section><section id="words" class="reading-section">${sectionTitle('03','単語の意味と読みを覚える','Learn the word and its sound')}${bilingual({ja:'単語を押して聞く → 声に出す → 漢字と意味を結びつける。',en:'Tap a word to listen → say it aloud → connect its kanji and meaning.'})}<div class="words">${l.words.map(wordButton).join('')}</div><p class="audio-status" id="audio-status" role="status" aria-live="polite"></p><p class="audio-note">${L('辞書と同じ単語音声を使用。音源がない場合は、辞書と同じく端末の日本語読み上げを使用します。','Uses the dictionary’s word recordings. If a recording is unavailable, it uses your device’s Japanese speech, as the dictionary does.')}</p></section><section id="clue" class="reading-section"><div class="application">${sectionTitle('04','知らない漢字にも手がかりを','Use clues in unfamiliar kanji')}${bilingual(l.transfer)}<div class="rule">${bilingual({ja:'部首・意符で「意味の仲間」を考える。音符で「音読みの候補」を考える。最後に単語で意味と読みを確かめる。',en:'Use a radical or meaning part to guess the meaning family. Use a sound part to suggest an on-reading. Confirm the meaning and pronunciation in a real word.'})}</div></div></section><footer class="lesson-footer"><button id="mark-read" class="primary">${completed[l.id]?L('読了 ✓','Read ✓'):L('読んだことを記録する','Mark as read')}</button><a href="#${l.level}">${L('レッスン一覧へ','Back to lessons')} →</a><details class="references"><summary>${L('成り立ち・覚え方について','About origins and memory stories')}</summary>${bilingual({ja:'「覚えるためのお話」は、記憶を助ける創作です。歴史的な字源とは区別しています。部品だけで、すべての意味や読みが決まるわけではありません。',en:'A “memory story” is an invented learning aid, not a historical origin. Components offer clues; they do not determine every meaning or reading.'})}${sources.map(url=>`<a href="${url}" target="_blank" rel="noopener noreferrer">${url.includes('kanjipedia')?L('漢字ペディア','Kanjipedia'):L('漢字のなりたち教材','Kanji learning reference')} ↗</a>`).join('')}</details></footer></article>`;
  el('app').querySelectorAll('[data-word]').forEach(button=>button.onclick=()=>playWord(button));
  el('app').querySelectorAll('[data-jump]').forEach(button=>button.onclick=()=>el(button.dataset.jump).scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'}));
  el('mark-read').onclick=()=>{completed[l.id]=true;sendNative('complete',{id:l.id});try{localStorage.setItem('radicals-reading-v2',JSON.stringify(completed))}catch{}el('mark-read').textContent=L('読了 ✓','Read ✓');};
}
let activeAudio=null, audioToken=0, audioTimer=null;
function stopAudio() {
  sendNative('stop-audio');
  audioToken++; clearTimeout(audioTimer); audioTimer=null;
  if(activeAudio){activeAudio.pause();activeAudio.removeAttribute('src');activeAudio.load();activeAudio=null;}
  if('speechSynthesis' in window)speechSynthesis.cancel();
  document.querySelectorAll('.word.playing').forEach(b=>{b.classList.remove('playing');b.removeAttribute('aria-pressed');});
}
function audioStatus(text){if(el('audio-status'))el('audio-status').textContent=text;}
async function playWord(button) {
  stopAudio();const token=audioToken;const word=button.dataset.word,reading=button.dataset.reading;
  button.classList.add('playing');button.setAttribute('aria-pressed','true');
  const done=()=>{if(token!==audioToken)return;clearTimeout(audioTimer);button.classList.remove('playing');button.removeAttribute('aria-pressed');};
  if(window.ReactNativeWebView){
    window.onNativeAudioStatus = (requestId, status) => {
      if(requestId!==audioToken)return;
      done();
      audioStatus((status==='recording'?L('辞書の音声：','Dictionary audio: '):status==='speech'?L('端末の日本語読み上げ：','Device Japanese voice: '):L('音声を再生できません：','Audio unavailable: '))+word);
    };
    audioStatus(L('音声を読み込み中：','Loading audio: ')+word);
    sendNative('speak',{word,reading,requestId:token});return;
  }
  let fellBack=false;
  const fallback=()=>{
    if(token!==audioToken||fellBack)return;fellBack=true;clearTimeout(audioTimer);
    if(activeAudio){activeAudio.pause();activeAudio.removeAttribute('src');activeAudio.load();activeAudio=null;}
    if(!('speechSynthesis'in window)){done();audioStatus(L('音声を再生できません。もう一度お試しください。','Audio is unavailable. Please try again.'));return;}
    const utterance=new SpeechSynthesisUtterance(reading);utterance.lang='ja-JP';
    utterance.onend=done;utterance.onerror=()=>{if(token!==audioToken)return;done();audioStatus(L('日本語の音声を再生できませんでした。','The Japanese voice could not be played.'));};
    audioStatus(L('端末の日本語読み上げ：','Device Japanese voice: ')+word);speechSynthesis.speak(utterance);
  };
  const id=RADICAL_AUDIO_IDS[word+'|'+reading];
  if(!id){fallback();return;}
  audioStatus(L('辞書の音声を読み込み中：','Loading dictionary audio: ')+word);
  const audio=new Audio(RADICAL_AUDIO_BASE+encodeURIComponent(id)+'.mp3');activeAudio=audio;
  audio.onended=done;audio.onerror=fallback;
  audio.onplaying=()=>{if(token!==audioToken||fellBack){audio.pause();return;}clearTimeout(audioTimer);audioStatus(L('辞書の音声：','Dictionary audio: ')+word);};
  audioTimer=setTimeout(fallback,8000);
  try{await audio.play()}catch{fallback()}
}
function route(){stopAudio();const id=location.hash.slice(1);const lesson=lessons.find(l=>l.id===id&&(!fixedLevel||l.level===fixedLevel));if(lesson){current=lesson;currentLevel=lesson.level;renderLesson();sendNative('view',{id:lesson.id,level:lesson.level});}else{if(!fixedLevel&&['N5','N4','N3'].includes(id))currentLevel=id;renderMenu();}window.scrollTo(0,0);}
// Both languages remain visible; this changes the primary language without losing reading position.
el('language').onclick=()=>{const y=scrollY;stopAudio();language=language==='ja'?'en':'ja';document.documentElement.lang=language;el('language').textContent=language==='ja'?'English first':'日本語を先に';if(current)renderLesson();else renderMenu();window.scrollTo(0,y);};
document.documentElement.lang=language;el('language').textContent=language==='ja'?'English first':'日本語を先に';
window.addEventListener('hashchange',route);window.addEventListener('pagehide',stopAudio);route();
