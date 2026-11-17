const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

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

test('content usage ranks by user count, then by screen opens', () => {
  const html = fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8');
  const start = html.indexOf('const CONTENT_NAMES =');
  const end = html.indexOf('// 関係・報告タブ', start);
  assert.ok(start >= 0 && end > start);
  const table = {};
  const render = vm.runInNewContext(html.slice(start, end) + '\nrenderContentUsage;', {
    $: () => table,
    esc: value => String(value).replaceAll('<', '&lt;'),
    simpleTbl: (el, columns, rows, cells) => {
      el.rows = Array.from(rows, row => Array.from(cells, cell => cell(row)));
    },
  });
  render([
    { content: 'PosterAudio', level: 'N4', users: '5', opens: '90' },
    { content: 'Mock:mini', level: 'N5', users: '12', opens: '14' },
    { content: '<custom>', level: 'N3', users: '12', opens: '20' },
  ]);
  assert.deepEqual(table.rows, [
    ['&lt;custom>', 'N3', '12', '20'],
    ['ミニ模試', 'N5', '12', '14'],
    ['ポスター朗読画面', 'N4', '5', '90'],
  ]);
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
