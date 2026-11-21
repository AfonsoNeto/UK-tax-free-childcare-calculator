import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { DateUtil } from '../js/DateUtil.js';

test('getPeriodInfo defaults to calendar quarters', () => {
  const q1 = DateUtil.getPeriodInfo(2026, 1);
  assert.deepEqual(q1.months, [{ year: 2026, month: 1 }, { year: 2026, month: 2 }, { year: 2026, month: 3 }]);
  assert.equal(q1.periodName, 'January - March 2026');

  const sameQuarter = DateUtil.getPeriodInfo(2026, 3);
  assert.deepEqual(sameQuarter.months, [{ year: 2026, month: 1 }, { year: 2026, month: 2 }, { year: 2026, month: 3 }]);

  const q2 = DateUtil.getPeriodInfo(2026, 4);
  assert.deepEqual(q2.months, [{ year: 2026, month: 4 }, { year: 2026, month: 5 }, { year: 2026, month: 6 }]);
  assert.equal(q2.periodName, 'April - June 2026');

  const q4 = DateUtil.getPeriodInfo(2026, 12);
  assert.deepEqual(q4.months, [{ year: 2026, month: 10 }, { year: 2026, month: 11 }, { year: 2026, month: 12 }]);
  assert.equal(q4.periodName, 'October - December 2026');
});

test('getPeriodInfo anchors periods to the account month', () => {
  // With a November anchor, November opens a Nov-Jan period that wraps the year
  const anchorNovember = DateUtil.getPeriodInfo(2026, 11, 11);
  assert.deepEqual(anchorNovember.months, [{ year: 2026, month: 11 }, { year: 2026, month: 12 }, { year: 2027, month: 1 }]);
  assert.equal(anchorNovember.periodName, 'November - January 2027');

  // December is the second month of the November period
  const december = DateUtil.getPeriodInfo(2026, 12, 11);
  assert.deepEqual(december.months, [{ year: 2026, month: 11 }, { year: 2026, month: 12 }, { year: 2027, month: 1 }]);

  // January belongs to the period that started in November of the previous year
  const january = DateUtil.getPeriodInfo(2026, 1, 11);
  assert.deepEqual(january.months, [{ year: 2025, month: 11 }, { year: 2025, month: 12 }, { year: 2026, month: 1 }]);
  assert.equal(january.periodName, 'November - January 2026');

  // February opens the next period
  const february = DateUtil.getPeriodInfo(2027, 2, 11);
  assert.deepEqual(february.months, [{ year: 2027, month: 2 }, { year: 2027, month: 3 }, { year: 2027, month: 4 }]);
  assert.equal(february.periodName, 'February - April 2027');
});

test('getPeriodInfo puts the selected month at its offset in the period', () => {
  const firstMonth = DateUtil.getPeriodInfo(2026, 11, 11);
  assert.equal(firstMonth.months.findIndex(m => m.year === 2026 && m.month === 11), 0);
  const midPeriod = DateUtil.getPeriodInfo(2026, 12, 11);
  assert.equal(midPeriod.months.findIndex(m => m.year === 2026 && m.month === 12), 1);
  const lastMonth = DateUtil.getPeriodInfo(2026, 1, 11);
  assert.equal(lastMonth.months.findIndex(m => m.year === 2026 && m.month === 1), 2);
});

test('getDaysInMonth handles month lengths and leap years', () => {
  assert.equal(DateUtil.getDaysInMonth(2026, 2), 28);
  assert.equal(DateUtil.getDaysInMonth(2024, 2), 29);
  assert.equal(DateUtil.getDaysInMonth(2000, 2), 29);
  assert.equal(DateUtil.getDaysInMonth(1900, 2), 28);
  assert.equal(DateUtil.getDaysInMonth(2026, 11), 30);
  assert.equal(DateUtil.getDaysInMonth(2026, 12), 31);
});
