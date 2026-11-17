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
