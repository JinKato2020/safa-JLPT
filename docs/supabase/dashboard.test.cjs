const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

test('every dashboard script parses before any connection is attempted', () => {
  const html = fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8');
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];
  assert.ok(scripts.length > 0);
  for (const [, source] of scripts) assert.doesNotThrow(() => new vm.Script(source));
});

test('analysis handles unavailable views independently', async () => {
  const html = fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8');
  const source = html.slice(html.indexOf('async function loadAnalysis(){'), html.indexOf('const CONTENT_LEVELS ='));
  for (const available of [true, false]) {
    const nodes = {};
    const rendered = [];
    const ctx = {
      _url: '', _key: '', api: () => null,
      grabAll: async () => ({ facetAcc: available ? [] : {__err: true}, contentUsage: available ? {__err: true} : [] }),
      dataOk: value => value && !value.__err,
      $: id => nodes[id] ||= {}, renderTrend: () => {},
      renderFacetAcc: () => rendered.push('facet'), renderContentUsage: () => rendered.push('content'),
    };
    await vm.runInNewContext(source + '\nloadAnalysis();', ctx);
    assert.deepEqual(rendered, [available ? 'facet' : 'content']);
    assert.match(nodes[available ? 'tContentUsage' : 'tFacetAcc'].innerHTML, /<td/);
  }
});

test('user study count renders in its actual column scope without summary helpers', () => {
  const html = fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8');
  const start = html.indexOf('const COLS = [');
  const end = html.indexOf('const FROZEN_COUNT', start);
  assert.ok(start >= 0 && end > start);
  const cols = vm.runInNewContext(html.slice(start, end) + '\nCOLS;', {
    dmCol: () => ({}), RD: 'reading',
  });
  const count = cols.find(col => col.key === 'study_sessions');
  assert.equal(count.cell({ study_sessions: 0 }), '0回');
  assert.equal(count.cell({ study_sessions: '1234' }), '1,234回');
  assert.match(count.cell({ study_sessions: null }), /—/);
  assert.equal(cols[cols.indexOf(count) - 1].key, 'study_min');
});

test('content usage shows one row per menu in fixed order with N5, N4, N3 pairs', () => {
  const html = fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8');
  const start = html.indexOf('const CONTENT_LEVELS =');
  const end = html.indexOf('// 関係・報告タブ', start);
  const table = {};
  const render = vm.runInNewContext(html.slice(start, end) + '\nrenderContentUsage;', {
    $: () => table, esc: value => value,
  });
  render([
    {content:'exam_reading', level:'N3', users:'3', opens:'30'},
    {content:'exam_reading', level:'N5', users:'1', opens:'100'},
    {content:'exam_writing', level:'N4', users:'20', opens:'40'},
    {content:'kanji_writing', level:'N4', users:'9', opens:'99'},
    {content:'dictionary_vocab', level:'N5', users:'2', opens:'10'},
    {content:'radicals', level:'N4', users:'10', opens:'13'},
    {content:'review', level:'N3', users:'2', opens:'3'},
    {content:'study_list', level:'N5', users:'100', opens:'300'},
    {content:'listening_drill', level:'N5', users:'100', opens:'300'},
    {content:'expression', level:'N5', users:'100', opens:'300'},
    {content:'first_lesson', level:'N3', users:'3', opens:'5'},
    ...['reading_general', 'listening_general', 'general_quiz', 'kanji_recognition', 'general_drill', 'dictionary_general']
      .map(content => ({content, level:'N5', users:'100', opens:'300'})),
  ]);
  const headers = [...table.innerHTML.matchAll(/scope="colgroup" colspan="2">(N[345])/g)].map(m => m[1]);
  assert.deepEqual(headers, ['N5', 'N4', 'N3']);
  const rows = [...table.innerHTML.matchAll(/<tr><th scope="row">([^<]+)<\/th>(.*?)<\/tr>/g)];
  const labels = rows.map(row => row[1]);
  assert.deepEqual(labels.slice(0, 9), [
    '模試：漢字読み', '模試：表記', '模試：文脈規定', '模試：言い換え類語', '模試：用法',
    '模試：文法形式', '模試：文の組み立て', '模試：文章の文法', '模試：短文',
  ]);
  const i = labels.indexOf('練習：漢字リスト');
  assert.deepEqual(labels.slice(i, i+7), ['練習：漢字リスト', '練習：部首', '練習：書き取り', '練習：意味', '練習：読み', '練習：似た漢字', '練習：聞き取り']);
  assert.deepEqual(labels.slice(-10), ['辞書：漢字', '辞書：語彙', '辞書：文法', '辞書：単語帳', 'AIコーチ', '模試試験', '日本語の町', 'ショップ', 'アカウント', '設定']);
  const cells = row => [...row[2].matchAll(/<td[^>]*>([^<]+)/g)].map(m => m[1]);
  assert.deepEqual(cells(rows.find(row => row[1] === '苦手な分野に挑戦する')), ['0人', '0回', '0人', '0回', '2人', '3回']);
  assert(!labels.some(label => label.includes('総合')));
  for (const removed of ['練習：初回学習', '練習：試験問題の復習', '練習：会話と表現']) {
    assert(!labels.includes(removed));
  }
  assert.deepEqual(cells(rows[0]), ['1人', '100回', '0人', '0回', '3人', '30回']);
  assert.deepEqual(cells(rows[1]), ['0人', '0回', '20人', '40回', '0人', '0回']);
  const dictionary = rows.find(row => row[1] === '辞書：語彙');
  assert.deepEqual(cells(dictionary), ['2人', '10回', '0人', '0回', '0人', '0回']);
  assert.match(rows[0][2], /usage-medium">1人<\/td><td class="num usage-medium">100回/);
  assert.match(rows[0][2], /class="num level-start">0人/);
  assert.match(dictionary[2], /usage-high">2人/);
  assert.match(rows.find(row => row[1] === '練習：書き取り')[2], /usage-low">9人/);
});

test('dashboard restores saved settings even when persistent storage is blocked', () => {
  const html = fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8');
  const start = html.indexOf('function readConnection(');
  const end = html.indexOf('function esc(', start);
  const makeStore = init => { const data = new Map(Object.entries(init || {})); return { getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v) }; };
  function run(local, session) {
    const nodes = {url:{},key:{},connectionStatus:{}};
    const window = {};
    Object.defineProperty(window,'localStorage',{get(){if(local===null)throw new Error('blocked');return local;}});
    Object.defineProperty(window,'sessionStorage',{get(){if(session===null)throw new Error('blocked');return session;}});
    const context={window,location:{host:'dashboard.example'},DEFAULT_URL:'https://project.supabase.co',$:id=>nodes[id]};
    vm.runInNewContext(html.slice(start,end),context);
    return {nodes,context};
  }
  const old=run(makeStore({dash_url:'https://saved.supabase.co',dash_key:'test-key'}),makeStore());
  assert.equal(old.nodes.url.value,'https://saved.supabase.co');assert.equal(old.nodes.key.value,'test-key');
  const blocked=run(null,makeStore({dash_key:'tab-test-key'}));
  assert.equal(blocked.nodes.key.value,'tab-test-key');assert.match(blocked.nodes.connectionStatus.textContent,/永続保存は利用できません/);
  const denied=run(null,null);assert.equal(denied.nodes.url.value,'https://project.supabase.co');assert.equal(denied.nodes.key.value,'');
  assert.doesNotThrow(()=>vm.runInNewContext("saveConnection('https://project.supabase.co','example-key')",denied.context));
  assert.match(denied.nodes.connectionStatus.textContent,/保存できません/);
  const empty=makeStore(), recovered=run(empty,makeStore({dash_key:'recover-test-key'}));
  assert.equal(empty.getItem('dash_key'),'recover-test-key');assert.match(recovered.nodes.connectionStatus.textContent,/復元しました/);
});
