const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');

test('course OTA retains a usable course through offline and incomplete downloads', async () => {
  const files = new Map();
  let offline = false, corrupted = false;
  let html = '<html>/*APP_LESSON_CONFIG*/ {} first</html>';
  const md5 = value => crypto.createHash('md5').update(value).digest('hex');
  const nativeFs = {
    documentDirectory: 'doc/',
    makeDirectoryAsync: async () => {},
    getInfoAsync: async path => files.has(path) ? { exists: true, isDirectory: false, md5: md5(files.get(path)) } : {exists:false},
    readAsStringAsync: async path => { if (!files.has(path)) throw Error('missing'); return files.get(path); },
    writeAsStringAsync: async (path, text) => files.set(path, text),
  };
  const source = ts.transpileModule(fs.readFileSync(__dirname + '/radicalCourseRemote.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = { exports: {}, require: () => nativeFs, AbortController, setTimeout, clearTimeout,
    fetch: async url => {
      if (offline) throw Error('offline');
      const hash = md5(html);
      return {ok:true, text:async()=>url.endsWith('manifest.json') ? JSON.stringify({schema:1,file:`course-${hash}.html`,md5:hash}) : corrupted ? 'partial' : html};
    },
  };
  vm.runInNewContext(source, context);
  const api = context.exports;
  assert.equal(await api.cachedRadicalCourse(), null);
  await api.syncRadicalCourse();
  const first = html;
  assert.equal(await api.cachedRadicalCourse(), first);
  html = '<html>/*APP_LESSON_CONFIG*/ {} newly added lessons</html>';
  corrupted = true;
  await api.syncRadicalCourse();
  assert.equal(await api.cachedRadicalCourse(), first);
  offline = true;
  await api.syncRadicalCourse();
  assert.equal(await api.cachedRadicalCourse(), first);
  offline = corrupted = false;
  await Promise.all([api.syncRadicalCourse(), api.syncRadicalCourse()]);
  assert.equal(await api.cachedRadicalCourse(), html);
});
