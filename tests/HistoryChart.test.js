import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildChartData, renderChartSVG } from '../js/HistoryChart.js';

function entry(total, gov) {
  return { totalMonthlyCost: total, govContribution: gov, userPays: total - gov, dayRates: null, savedAt: '2026-01-01T00:00:00.000Z' };
}

test('buildChartData lists months chronologically with derived shares', () => {
  const data = buildChartData({
    '2026-11': entry(109200, 21840),
    '2026-09': entry(114400, 22880),
    '2026-10': entry(114400, 22880)
  });

  assert.deepEqual(data.map(d => d.key), ['2026-09', '2026-10', '2026-11']);
  assert.deepEqual(data.map(d => d.label), ['Sep 26', 'Oct 26', 'Nov 26']);
  assert.equal(data[2].total, 109200);
  assert.equal(data[2].gov, 21840);
  assert.equal(data[2].user, 87360);
});

test('buildChartData handles an empty history', () => {
  assert.deepEqual(buildChartData({}), []);
});

test('renderChartSVG emits a stacked bar per month with tooltips', () => {
  const svg = renderChartSVG(buildChartData({
    '2026-11': entry(109200, 21840)
  }));

  assert.match(svg, /<svg class="history-chart"/);
  assert.equal((svg.match(/chart-user/g) || []).length, 1);
  assert.equal((svg.match(/chart-gov/g) || []).length, 1);
  assert.match(svg, /Nov 26/);
  assert.match(svg, /£1,092\.00 total \(£218\.40 from the government\)/);
});

test('renderChartSVG renders nothing without data', () => {
  assert.equal(renderChartSVG([]), '');
});
