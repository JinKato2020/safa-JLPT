import { test } from 'node:test';
import assert from 'node:assert/strict';
import { didSwitchTab } from './tabReturn';

const routes = [
  { key: 'home', name: 'ホーム' },
  { key: 'words', name: '単語', state: { key: 'words-stack', routes: [{ key: 'word-kubun', name: 'WordKubun' }] } },
  { key: 'dict', name: '辞書' },
];

test('opening a root lesson preserves the selected tab card and nested list', () => {
  assert.equal(didSwitchTab({ index: 1, routes }, 'words'), false);
  assert.equal(didSwitchTab({ index: 1, routes }, 'words-stack'), false);
});

test('switching to a different tab still resets the previous tab', () => {
  assert.equal(didSwitchTab({ index: 2, routes }, 'words'), true);
  assert.equal(didSwitchTab({ index: 2, routes }, 'words-stack'), true);
});

test('an unknown route cannot reset an unrelated tab', () => {
  assert.equal(didSwitchTab({ index: 1, routes }, 'missing'), false);
});

test('tab switching is detected even while the hub is behind a nested study list', () => {
  const nestedRoutes = routes.map(route => route.key === 'words' ? {
    ...route,
    state: { key: 'words-stack', index: 1, routes: [
      { key: 'words-home', name: 'WordsHome' },
      { key: 'word-list', name: 'WordList' },
    ] },
  } : route);
  assert.equal(didSwitchTab({ index: 1, routes: nestedRoutes }, 'words-stack'), false);
  assert.equal(didSwitchTab({ index: 2, routes: nestedRoutes }, 'words-stack'), true);
});
