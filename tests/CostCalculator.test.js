import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { CostCalculator } from '../js/CostCalculator.js';

// History entry stand-in for projection tests; all values are integer pence.
function entry(overrides = {}) {
  return { totalMonthlyCost: 90000, govContribution: 18000, userPays: 72000, dayRates: null, savedAt: '2026-01-01T00:00:00.000Z', ...overrides };
}

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

test('calculate computes the transfer needed when the account has a leftover balance', () => {
  const results = CostCalculator.calculate({
    year: 2026,
    month: 11,
    govContributionSoFar: 0,
    currentDayRates: {},
    totalMonthlyCost: 80000,
    leftoverBalance: 20000
  });
  // £100 of the invoice is covered by the balance; £600 still needs deposit + top-up
  assert.equal(results.leftToCover, 60000);
  assert.equal(results.transferToAccount, 48000);
  assert.equal(results.actualGovContribution, 12000);
  assert.equal(results.balanceAfterPayment, 0);
  // userPays keeps its meaning: the user's share of the whole invoice
  assert.equal(results.userPays, 68000);
});

test('calculate respects the period cap when transferring with a leftover balance', () => {
  const results = CostCalculator.calculate({
    year: 2026,
    month: 11,
    govContributionSoFar: 45000,
    currentDayRates: {},
    totalMonthlyCost: 80000,
    leftoverBalance: 10000
  });
  // £700 still to cover, but only £50 of top-up remains
  assert.equal(results.transferToAccount, 65000);
  assert.equal(results.actualGovContribution, 5000);
  assert.equal(results.balanceAfterPayment, 0);
});

test('calculate reports zero transfer when the balance covers the invoice', () => {
  const results = CostCalculator.calculate({
    year: 2026,
    month: 11,
    govContributionSoFar: 0,
    currentDayRates: {},
    totalMonthlyCost: 80000,
    leftoverBalance: 90000
  });
  assert.equal(results.transferToAccount, 0);
  assert.equal(results.actualGovContribution, 0);
  assert.equal(results.balanceAfterPayment, 10000);
  assert.equal(results.userPays, 80000);
});

test('calculate without a leftover keeps transferToAccount equal to userPays', () => {
  const results = CostCalculator.calculate({
    year: 2026,
    month: 11,
    govContributionSoFar: 0,
    currentDayRates: {},
    totalMonthlyCost: 80000
  });
  assert.equal(results.transferToAccount, 64000);
  assert.equal(results.userPays, 64000);
  assert.equal(results.balanceAfterPayment, 0);
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
  assert.equal(optimization.periodName, 'October - December 2026');
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

test('calculateOptimization honours the configured period anchor', () => {
  // With periods starting in November, December is the second month of Nov-Jan
  const optimization = CostCalculator.calculateOptimization({
    year: 2026,
    month: 12,
    currentDayRates: {},
    totalMonthlyCost: 80000
  }, 11);
  assert.equal(optimization.periodName, 'November - January 2027');
  assert.equal(optimization.totalQuarterlyCost, 240000);
  assert.equal(optimization.onTrack, false);
  assert.equal(optimization.shortfall, 10000);
  // December and January remain, so the shortfall splits over two months
  assert.equal(optimization.extraForCurrentMonth, 4000);
  assert.match(optimization.monthlyBreakdown, /in December/);
  assert.match(optimization.monthlyBreakdown, /in January/);
});

test('calculateOptimization uses saved months for the past months of the period', () => {
  const history = { '2026-10': entry(), '2026-11': entry({ totalMonthlyCost: 95000 }) };
  // November selected: October is past (uses saved £900), November is the
  // selected month (uses the live £800 even though it was saved as £950),
  // December is projected (£800).
  const optimization = CostCalculator.calculateOptimization({
    year: 2026,
    month: 11,
    currentDayRates: {},
    totalMonthlyCost: 80000
  }, 1, history);
  assert.equal(optimization.totalQuarterlyCost, 90000 + 80000 + 80000);
});

test('calculateOptimization projects past months that have no history entry', () => {
  const optimization = CostCalculator.calculateOptimization({
    year: 2026,
    month: 11,
    currentDayRates: {},
    totalMonthlyCost: 80000
  }, 1, {});
  assert.equal(optimization.totalQuarterlyCost, 240000);
});

test('calculateOptimization ignores saved months outside the period or in the future', () => {
  const history = {
    '2026-11': entry({ totalMonthlyCost: 95000 }), // future relative to October
    '2026-09': entry({ totalMonthlyCost: 70000 })  // outside the Oct-Dec period
  };
  const optimization = CostCalculator.calculateOptimization({
    year: 2026,
    month: 10,
    currentDayRates: {},
    totalMonthlyCost: 80000
  }, 1, history);
  assert.equal(optimization.totalQuarterlyCost, 240000);
});
