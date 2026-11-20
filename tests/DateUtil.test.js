import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { DateUtil } from '../js/DateUtil.js';

test('getQuarterInfo returns the calendar quarter of the month', () => {
  const q1 = DateUtil.getQuarterInfo(2026, 1);
  assert.equal(q1.quarter, 0);
  assert.deepEqual(q1.months, [0, 1, 2]); // 0-indexed months
  assert.equal(q1.periodName, 'January - March');

  const sameQuarter = DateUtil.getQuarterInfo(2026, 3);
  assert.deepEqual(sameQuarter.months, [0, 1, 2]);

  const q2 = DateUtil.getQuarterInfo(2026, 4);
  assert.equal(q2.quarter, 1);
  assert.deepEqual(q2.months, [3, 4, 5]);
  assert.equal(q2.periodName, 'April - June');

  const q4 = DateUtil.getQuarterInfo(2026, 12);
  assert.equal(q4.quarter, 3);
  assert.deepEqual(q4.months, [9, 10, 11]);
  assert.equal(q4.periodName, 'October - December');
});

test('getDaysInMonth handles month lengths and leap years', () => {
  assert.equal(DateUtil.getDaysInMonth(2026, 2), 28);
  assert.equal(DateUtil.getDaysInMonth(2024, 2), 29);
  assert.equal(DateUtil.getDaysInMonth(2000, 2), 29);
  assert.equal(DateUtil.getDaysInMonth(1900, 2), 28);
  assert.equal(DateUtil.getDaysInMonth(2026, 11), 30);
  assert.equal(DateUtil.getDaysInMonth(2026, 12), 31);
});
