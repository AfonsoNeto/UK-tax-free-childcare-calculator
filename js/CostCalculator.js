import { DAYS_OF_WEEK, MAX_GOV_CONTRIBUTION_PER_PERIOD, REQUIRED_TOTAL_COST_FOR_MAX_BENEFIT, MONTH_NAMES } from './config.js';
import { formatGBP } from './format.js';
import { DateUtil } from './DateUtil.js';

// All money values are integer pence.
export class CostCalculator {
  static calculateMonthlyCost(year, month, dayRates) {
    let cost = 0;
    const daysInMonth = DateUtil.getDaysInMonth(year, month);
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month - 1, i);
      const dayIndex = date.getDay(); // Sun=0, Mon=1
      const dayName = DAYS_OF_WEEK[dayIndex - 1];
      if (dayRates[dayName]) {
        cost += dayRates[dayName];
      }
    }
    return cost;
  }

  // Monthly-total mode supplies the cost directly; otherwise derive it from the daily rates.
  static resolveMonthlyTotal(inputs, year, month) {
    if (inputs.totalMonthlyCost && inputs.totalMonthlyCost > 0) {
      return inputs.totalMonthlyCost;
    }
    return this.calculateMonthlyCost(year, month, inputs.currentDayRates);
  }

  // 20% government top-up on a deposit amount, rounded to whole pence.
  static govTopUp(pence) {
    return Math.round(pence / 5);
  }

  static calculate(inputs) {
    const { year, month, govContributionSoFar } = inputs;

    const totalMonthlyCost = this.resolveMonthlyTotal(inputs, year, month);

    const potentialGovContribution = this.govTopUp(totalMonthlyCost);
    const remainingGovAllowance = Math.max(0, MAX_GOV_CONTRIBUTION_PER_PERIOD - govContributionSoFar);
    const actualGovContribution = Math.min(potentialGovContribution, remainingGovAllowance);
    const userPays = totalMonthlyCost - actualGovContribution;

    return {
      totalMonthlyCost,
      actualGovContribution,
      userPays
    };
  }

  // The period projection uses saved totals for months that already have a
  // history entry (they reflect what actually happened) and only projects the
  // current rates for the selected month and the months after it.
  static calculateOptimization(inputs, anchorMonth = 1, history = {}) {
    const { year, month } = inputs;
    const periodInfo = DateUtil.getPeriodInfo(year, month, anchorMonth);

    let totalPeriodCost = 0;
    periodInfo.months.forEach(m => {
      const key = `${m.year}-${String(m.month).padStart(2, '0')}`;
      const isPastMonth = m.year < year || (m.year === year && m.month < month);
      const saved = isPastMonth ? history[key] : null;
      totalPeriodCost += saved ? saved.totalMonthlyCost : this.resolveMonthlyTotal(inputs, m.year, m.month);
    });

    // The selected month sits at `offset` in the chronological month list,
    // so everything from there on is projected with the current rates.
    const offset = periodInfo.months.findIndex(m => m.year === year && m.month === month);

    let optimization = {
      periodName: periodInfo.periodName,
      totalQuarterlyCost: totalPeriodCost,
      onTrack: totalPeriodCost >= REQUIRED_TOTAL_COST_FOR_MAX_BENEFIT,
      shortfall: 0,
      userContributionShortfall: 0,
      extraGovTopUp: 0,
      extraForCurrentMonth: 0,
      monthlyBreakdown: ''
    };

    if (!optimization.onTrack) {
      optimization.shortfall = REQUIRED_TOTAL_COST_FOR_MAX_BENEFIT - totalPeriodCost;
      optimization.extraGovTopUp = this.govTopUp(optimization.shortfall);
      optimization.userContributionShortfall = optimization.shortfall - optimization.extraGovTopUp;

      const remainingMonthsInPeriod = periodInfo.months.slice(offset);

      if (remainingMonthsInPeriod.length > 0) {
        const extraPerMonth = Math.round(optimization.userContributionShortfall / remainingMonthsInPeriod.length);
        optimization.extraForCurrentMonth = extraPerMonth;
        optimization.monthlyBreakdown = remainingMonthsInPeriod.map(m =>
          `<strong>${formatGBP(extraPerMonth)}</strong> in ${MONTH_NAMES[m.month - 1]}`
        ).join(', ');
      }
    }
    return optimization;
  }
}
