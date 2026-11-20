import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { formatGBP } from '../js/format.js';

test('formatGBP renders pence as pounds with thousands separators', () => {
  assert.equal(formatGBP(109200), '£1,092.00');
  assert.equal(formatGBP(21840), '£218.40');
  assert.equal(formatGBP(1234567), '£12,345.67');
});

test('formatGBP handles zero and sub-pound amounts', () => {
  assert.equal(formatGBP(0), '£0.00');
  assert.equal(formatGBP(5), '£0.05');
});
