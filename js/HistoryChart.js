import { MONTH_NAMES } from './config.js';
import { formatGBP } from './format.js';

// Chronological chart data for the saved months.
export function buildChartData(history) {
  return Object.keys(history).sort().map(key => {
    const [year, month] = key.split('-').map(Number);
    const entry = history[key];
    return {
      key,
      label: `${MONTH_NAMES[month - 1].slice(0, 3)} ${String(year).slice(-2)}`,
      total: entry.totalMonthlyCost,
      gov: entry.govContribution,
      user: entry.totalMonthlyCost - entry.govContribution
    };
  });
}

// Minimal stacked-bar SVG: the user's share and the government's
// contribution per month, with a tooltip per bar. Pure string output,
// styled through CSS classes so the dark theme can recolor it.
export function renderChartSVG(data) {
  if (data.length === 0) {
    return '';
  }

  const width = Math.max(data.length * 56, 280);
  const height = 170;
  const baseline = height - 26;
  const maxHeight = baseline - 14;
  const barWidth = 30;
  const slot = width / data.length;
  const scale = maxHeight / Math.max(...data.map(d => d.total), 1);

  const bars = data.map((d, i) => {
    const x = i * slot + (slot - barWidth) / 2;
    const totalHeight = Math.max(d.total * scale, 2);
    const govHeight = Math.max(d.gov * scale, 1);
    const userHeight = Math.max(totalHeight - govHeight, 1);
    const labelX = i * slot + slot / 2;
    return `
      <g>
        <title>${d.label.replace(' 20', ' ')}: ${formatGBP(d.total)} total (${formatGBP(d.gov)} from the government)</title>
        <rect class="chart-user" x="${x}" y="${baseline - userHeight - govHeight}" width="${barWidth}" height="${userHeight}" rx="2"></rect>
        <rect class="chart-gov" x="${x}" y="${baseline - totalHeight}" width="${barWidth}" height="${govHeight}" rx="2"></rect>
        <text class="chart-label" x="${labelX}" y="${height - 10}" text-anchor="middle">${d.label}</text>
      </g>`;
  }).join('');

  return `<svg class="history-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Monthly childcare costs, stacked by payer" preserveAspectRatio="xMidYMid meet">${bars}</svg>`;
}
