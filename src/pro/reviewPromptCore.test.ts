import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewIsDue, REVIEW_INTERVAL_MS as GAP, feedbackMailUrl, FEEDBACK_EMAIL } from './reviewPromptCore';

test('first request after four days, then at least four days between requests', () => {
  const installed = Date.UTC(2026, 10, 1);
  assert.equal(reviewIsDue(installed, 0, installed + GAP - 1, true), false);
  assert.equal(reviewIsDue(installed, 0, installed + GAP, true), true);
  const asked = installed + GAP;
  assert.equal(reviewIsDue(installed, asked, asked + GAP - 1, true), false);
  assert.equal(reviewIsDue(installed, asked, asked + GAP, true), true);
  assert.equal(reviewIsDue(installed, asked + 10 * GAP, asked + 11 * GAP, true), true);
});

test('legacy timestamps, corrupt data and clock rollback are safe', () => {
  const now = Date.UTC(2026, 10, 10);
  assert.equal(reviewIsDue(now - 10 * GAP, now - 1, now, true), false);
  assert.equal(reviewIsDue(now - 10 * GAP, NaN, now, true), true);
  assert.equal(reviewIsDue(0, 0, now, true), false);
  assert.equal(reviewIsDue(now - GAP, now + GAP, now, true), false);
});

test('mail opens a draft with the correct recipient and encoded localized subject', () => {
  const subject = 'まいにちJLPT ご要望 & 改善?';
  const url = new URL(feedbackMailUrl(subject));
  assert.equal(url.protocol, 'mailto:');
  assert.equal(url.pathname, FEEDBACK_EMAIL);
  assert.equal(url.searchParams.get('subject'), subject);
});


test('home visits, foreground return and unfinished sessions do not prompt even after four days', () => {
  const installed = Date.UTC(2026, 10, 1);
  const now = installed + 10 * GAP;
  assert.equal(reviewIsDue(installed, 0, now, false), false);
  assert.equal(reviewIsDue(installed, 0, now, true), true);
  assert.equal(reviewIsDue(installed, now, now + 1, true), false);
});
