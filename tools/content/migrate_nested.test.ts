// app/tools/content/migrate_nested.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitKnowledgeBank, readingToFiles, listeningToFiles, passageGrammarToFiles, lexiconToFiles } from './migrate_nested.ts';

test('splitKnowledgeBank: daimon×level・order ambiguous除外', () => {
  const kb = [
    { id: 'kb-1', level: 'N4', daimon: 'usage', stem: 's', question: 'q', answer: 'a', choices: ['a'] },
    { id: 'kb-2', level: 'N4', daimon: 'order', stem: 's', question: 'q', answer: 'a', choices: ['a'] },
    { id: 'kb-3', level: 'N4', daimon: 'order', ambiguous: true, stem: 's', question: 'q', answer: 'a', choices: ['a'] },
    { id: 'kb-4', level: 'N4', daimon: 'passage_grammar', stem: 's', question: 'q', answer: 'a', choices: ['a'] },
  ];
  const files = splitKnowledgeBank(kb);
  const usage = files.find((f) => f.daimon === 'usage' && f.level === 'N4')!;
  const order = files.find((f) => f.daimon === 'order' && f.level === 'N4')!;
  assert.equal(usage.items.length, 1);
  assert.equal(order.items.length, 1); // ambiguous除外
  assert.ok(!files.some((f) => f.daimon === 'passage_grammar')); // 含めない
});
test('readingToFiles: body訳(配列を連結)＋question explain', () => {
  const reading = [{ id: 'r-N4-tan-1', level: 'N4', subtype: 'naiyou_tan', title: 't', body: 'B', questions: [{ id: 'q1', q: 'Q', choices: ['a', 'b'], answerIndex: 0, explain: 'E' }] }];
  const files = readingToFiles(reading, { 'r-N4-tan-1': ['行1', '行2'] });
  const f = files[0];
  assert.equal(f.daimon, 'naiyou_tan');
  assert.equal(f.items[0].i18n.ne.body, '行1\n行2');
  assert.equal((f.items[0] as any).questions[0].i18n.ja.explain, 'E');
});
test('listeningToFiles: subtype×level・question explain', () => {
  const listening = [{ id: 'l-N5-kadai-1', level: 'N5', subtype: 'kadai', title: 't', script: 'S', audio: 'a.mp3', questions: [{ id: 'q1', q: 'Q', choices: ['a'], answerIndex: 0, explain: 'E' }] }];
  const files = listeningToFiles(listening);
  assert.equal(files[0].daimon, 'kadai');
  assert.equal((files[0].items[0] as any).script, 'S');
  assert.equal((files[0].items[0] as any).questions[0].i18n.ja.explain, 'E');
});
test('passageGrammarToFiles: level分割・daimon=passage_grammar', () => {
  const pg = [{ id: 'pg1', level: 'N4', kind: 'k', passages: ['p'], questions: [{ id: 'q', blankNo: 1, choices: ['a'], answerIndex: 0, pointId: 'x' }] }];
  const f = passageGrammarToFiles(pg);
  assert.equal(f[0].daimon, 'passage_grammar');
  assert.equal(f[0].level, 'N4');
  assert.equal((f[0].items[0] as any).questions[0].pointId, 'x');
});
test('lexiconToFiles: levelOf で級分割(漢字キーも解決)', () => {
  const levelOf = (k: string) => (/^n([1-5])-/.test(k) ? 'N' + k.match(/^n([1-5])-/)![1] : k === '会' ? 'N4' : 'N?');
  const files = lexiconToFiles({ 'n4-v-1': { ne: 'x' }, 'n5-v-2': { ne: 'y' }, '会': { ne: 'z' } }, 'meaning', levelOf);
  assert.equal(files.length, 2); // N4(n4-v-1 + 会) と N5(n5-v-2)
  assert.ok(files.every((f) => f.kind === 'meaning'));
  const n4 = files.find((f) => f.level === 'N4')!;
  assert.ok('会' in n4.items && 'n4-v-1' in n4.items);
});
