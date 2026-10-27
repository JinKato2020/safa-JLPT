import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

// Asset-only modules can be tested without React Native; use paths as asset IDs.
const require = createRequire(import.meta.url);
require.extensions['.jpg'] = (module, filename) => { module.exports = filename; };

test('autumn rewards rotate all five scenes in the selected daylight, including boundary hours', async () => {
  const { AFTER_STUDY_IMAGES, AFTER_STUDY_BY_DAYLIGHT, pickAfterStudyImage } = await import('../afterStudyArt');
  assert.equal(new Set(AFTER_STUDY_IMAGES).size, 10);
  for (const [hour, period] of [[5, 'night'], [6, 'day'], [17, 'day'], [18, 'night']] as const) {
    const now = new Date(2026, 9, 28, hour).getTime();
    const images = Array.from({ length: 5 }, (_, i) => pickAfterStudyImage(i, now));
    assert.deepEqual(images, AFTER_STUDY_BY_DAYLIGHT[period]);
    assert.equal(pickAfterStudyImage(5, now), images[0]);
    assert.equal(pickAfterStudyImage(9, now), images[4]);
    assert.equal(pickAfterStudyImage(2, now), pickAfterStudyImage(2, now));
  }
});

test('development daylight override selects the same period as tab and map backgrounds', async () => {
  const { AFTER_STUDY_BY_DAYLIGHT, pickAfterStudyImage } = await import('../afterStudyArt');
  const noon = new Date(2026, 9, 28, 12).getTime();
  assert.equal(pickAfterStudyImage(0, noon, 'night'), AFTER_STUDY_BY_DAYLIGHT.night[0]);
  assert.equal(pickAfterStudyImage(0, noon, 'day'), AFTER_STUDY_BY_DAYLIGHT.day[0]);
});
