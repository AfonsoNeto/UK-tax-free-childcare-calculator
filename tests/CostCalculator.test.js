import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { CostCalculator } from '../js/CostCalculator.js';

// All money values are integer pence.
test('calculateMonthlyCost sums the rates of the selected nursery days', () => {
  // November 2026: 5 Mondays and 4 Tuesdays
  assert.equal(CostCalculator.calculateMonthlyCost(2026, 11, { Monday: 2000, Tuesday: 1500 }), 16000);
  // February 2026: exactly 4 of each weekday
  assert.equal(
    CostCalculator.calculateMonthlyCost(2026, 2, { Monday: 2000, Tuesday: 2000, Wednesday: 2000, Thursday: 2000, Friday: 2000 }),
    40000
  );
  assert.equal(CostCalculator.calculateMonthlyCost(2026, 11, {}), 0);
});

test('calculate applies the 20% government top-up', () => {
  const results = CostCalculator.calculate({
    year: 2026,
    month: 11,
    govContributionSoFar: 0,
    currentDayRates: { Monday: 2000, Tuesday: 1500 },
    totalMonthlyCost: 0
  });
  assert.equal(results.totalMonthlyCost, 16000);
  assert.equal(results.actualGovContribution, 3200);
  assert.equal(results.userPays, 12800);
});

test('calculate caps the contribution at the remaining quarterly allowance', () => {
  const capped = CostCalculator.calculate({
    year: 2026,
    month: 11,
    govContributionSoFar: 45000,
    currentDayRates: {},
    totalMonthlyCost: 80000
  });
  assert.equal(capped.actualGovContribution, 5000);
  assert.equal(capped.userPays, 75000);

  const exhausted = CostCalculator.calculate({
    year: 2026,
    month: 11,
    govContributionSoFar: 50000,
    currentDayRates: {},
    totalMonthlyCost: 80000
  });
  assert.equal(exhausted.actualGovContribution, 0);
  assert.equal(exhausted.userPays, 80000);
});

test('calculate uses the monthly total directly in monthly-total mode', () => {
  const results = CostCalculator.calculate({
    year: 2026,
    month: 11,
    govContributionSoFar: 0,
    currentDayRates: {},
    totalMonthlyCost: 80000
  });
  assert.equal(results.totalMonthlyCost, 80000);
  assert.equal(results.actualGovContribution, 16000);
  assert.equal(results.userPays, 64000);
});

test('govTopUp rounds to whole pence', () => {
  assert.equal(CostCalculator.govTopUp(109200), 21840);
  assert.equal(CostCalculator.govTopUp(109201), 21840);
  assert.equal(CostCalculator.govTopUp(109204), 21841);
});

test('calculateOptimization reports an on-track quarter', () => {
  const optimization = CostCalculator.calculateOptimization({
    year: 2026,
    month: 11,
    currentDayRates: {},
    totalMonthlyCost: 90000
  });
  assert.equal(optimization.periodName, 'October - December');
  assert.equal(optimization.totalQuarterlyCost, 270000);
  assert.equal(optimization.onTrack, true);
  assert.equal(optimization.shortfall, 0);
  assert.equal(optimization.extraForCurrentMonth, 0);
});

test('calculateOptimization splits the shortfall over the remaining months of the quarter', () => {
  const optimization = CostCalculator.calculateOptimization({
    year: 2026,
    month: 11,
    currentDayRates: {},
    totalMonthlyCost: 80000
  });
  // Quarter: 3 x £800 = £2,400, shortfall £100 -> gov £20, user share £80 over November + December
  assert.equal(optimization.totalQuarterlyCost, 240000);
  assert.equal(optimization.onTrack, false);
  assert.equal(optimization.shortfall, 10000);
  assert.equal(optimization.userContributionShortfall, 8000);
  assert.equal(optimization.extraGovTopUp, 2000);
  assert.ok(Math.abs(optimization.extraForCurrentMonth - 4000) < 1e-9);
  assert.match(optimization.monthlyBreakdown, /<strong>£40\.00<\/strong> in November/);
  assert.match(optimization.monthlyBreakdown, /<strong>£40\.00<\/strong> in December/);
});

test('calculateOptimization uses the daily rates in daily mode', () => {
  // Q4 2026 with Monday-only £25: Oct, Nov and Dec have 4, 5 and 4 Mondays -> £325
  const optimization = CostCalculator.calculateOptimization({
    year: 2026,
    month: 12,
    currentDayRates: { Monday: 2500 },
    totalMonthlyCost: 0
  });
  assert.equal(optimization.totalQuarterlyCost, 32500);
  assert.equal(optimization.shortfall, 250000 - 32500);
  // December is the last month of the quarter, so the whole user shortfall lands on it
  assert.ok(Math.abs(optimization.extraForCurrentMonth - (250000 - 32500) * 0.8) < 1e-9);
});
