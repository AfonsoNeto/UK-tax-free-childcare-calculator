import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { CostCalculator } from '../js/CostCalculator.js';

test('calculateMonthlyCost sums the rates of the selected nursery days', () => {
  // November 2026: 5 Mondays and 4 Tuesdays
  assert.equal(CostCalculator.calculateMonthlyCost(2026, 11, { Monday: 20, Tuesday: 15 }), 160);
  // February 2026: exactly 4 of each weekday
  assert.equal(
    CostCalculator.calculateMonthlyCost(2026, 2, { Monday: 20, Tuesday: 20, Wednesday: 20, Thursday: 20, Friday: 20 }),
    400
  );
  assert.equal(CostCalculator.calculateMonthlyCost(2026, 11, {}), 0);
});

test('calculate applies the 20% government top-up', () => {
  const results = CostCalculator.calculate({
    year: 2026,
    month: 11,
    govContributionSoFar: 0,
    currentDayRates: { Monday: 20, Tuesday: 15 },
    totalMonthlyCost: 0
  });
  assert.equal(results.totalMonthlyCost, 160);
  assert.equal(results.actualGovContribution, 32);
  assert.equal(results.userPays, 128);
});

test('calculate caps the contribution at the remaining quarterly allowance', () => {
  const capped = CostCalculator.calculate({
    year: 2026,
    month: 11,
    govContributionSoFar: 450,
    currentDayRates: {},
    totalMonthlyCost: 800
  });
  assert.equal(capped.actualGovContribution, 50);
  assert.equal(capped.userPays, 750);

  const exhausted = CostCalculator.calculate({
    year: 2026,
    month: 11,
    govContributionSoFar: 500,
    currentDayRates: {},
    totalMonthlyCost: 800
  });
  assert.equal(exhausted.actualGovContribution, 0);
  assert.equal(exhausted.userPays, 800);
});

test('calculate uses the monthly total directly in monthly-total mode', () => {
  const results = CostCalculator.calculate({
    year: 2026,
    month: 11,
    govContributionSoFar: 0,
    currentDayRates: {},
    totalMonthlyCost: 800
  });
  assert.equal(results.totalMonthlyCost, 800);
  assert.equal(results.actualGovContribution, 160);
  assert.equal(results.userPays, 640);
});

test('calculateOptimization reports an on-track quarter', () => {
  const optimization = CostCalculator.calculateOptimization({
    year: 2026,
    month: 11,
    currentDayRates: {},
    totalMonthlyCost: 900
  });
  assert.equal(optimization.periodName, 'October - December');
  assert.equal(optimization.totalQuarterlyCost, 2700);
  assert.equal(optimization.onTrack, true);
  assert.equal(optimization.shortfall, 0);
  assert.equal(optimization.extraForCurrentMonth, 0);
});

test('calculateOptimization splits the shortfall over the remaining months of the quarter', () => {
  const optimization = CostCalculator.calculateOptimization({
    year: 2026,
    month: 11,
    currentDayRates: {},
    totalMonthlyCost: 800
  });
  // Quarter: 3 x 800 = 2400, shortfall 100 -> user share 80 over November + December
  assert.equal(optimization.totalQuarterlyCost, 2400);
  assert.equal(optimization.onTrack, false);
  assert.equal(optimization.shortfall, 100);
  assert.equal(optimization.userContributionShortfall, 80);
  assert.equal(optimization.extraGovTopUp, 20);
  assert.ok(Math.abs(optimization.extraForCurrentMonth - 40) < 1e-9);
  assert.match(optimization.monthlyBreakdown, /<strong>£40\.00<\/strong> in November/);
  assert.match(optimization.monthlyBreakdown, /<strong>£40\.00<\/strong> in December/);
});

test('calculateOptimization uses the daily rates in daily mode', () => {
  // Q4 2026 with Monday-only £25: Oct, Nov and Dec have 4, 5 and 4 Mondays -> 325
  const optimization = CostCalculator.calculateOptimization({
    year: 2026,
    month: 12,
    currentDayRates: { Monday: 25 },
    totalMonthlyCost: 0
  });
  assert.equal(optimization.totalQuarterlyCost, 325);
  assert.equal(optimization.shortfall, 2500 - 325);
  // December is the last month of the quarter, so the whole user shortfall lands on it
  assert.ok(Math.abs(optimization.extraForCurrentMonth - (2500 - 325) * 0.8) < 1e-9);
});
