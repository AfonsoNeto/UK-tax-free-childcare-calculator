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

  static calculateOptimization(inputs) {
    const { year, month } = inputs;
    const quarterInfo = DateUtil.getQuarterInfo(year, month);

    let totalQuarterlyCost = 0;
    quarterInfo.months.forEach(monthIndex => {
      totalQuarterlyCost += this.resolveMonthlyTotal(inputs, year, monthIndex + 1);
    });

    let optimization = {
      periodName: quarterInfo.periodName,
      totalQuarterlyCost,
      onTrack: totalQuarterlyCost >= REQUIRED_TOTAL_COST_FOR_MAX_BENEFIT,
      shortfall: 0,
      userContributionShortfall: 0,
      extraGovTopUp: 0,
      extraForCurrentMonth: 0,
      monthlyBreakdown: ''
    };

    if (!optimization.onTrack) {
      optimization.shortfall = REQUIRED_TOTAL_COST_FOR_MAX_BENEFIT - totalQuarterlyCost;
      optimization.extraGovTopUp = this.govTopUp(optimization.shortfall);
      optimization.userContributionShortfall = optimization.shortfall - optimization.extraGovTopUp;

      const currentMonthIndex = month - 1;
      const remainingMonthsInQuarter = quarterInfo.months.filter(m => m >= currentMonthIndex);

      if (remainingMonthsInQuarter.length > 0) {
        const extraPerMonth = Math.round(optimization.userContributionShortfall / remainingMonthsInQuarter.length);
        optimization.extraForCurrentMonth = extraPerMonth;
        optimization.monthlyBreakdown = remainingMonthsInQuarter.map(mIndex =>
          `<strong>${formatGBP(extraPerMonth)}</strong> in ${MONTH_NAMES[mIndex]}`
        ).join(', ');
      }
    }
    return optimization;
  }
}
