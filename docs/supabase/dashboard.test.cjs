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
