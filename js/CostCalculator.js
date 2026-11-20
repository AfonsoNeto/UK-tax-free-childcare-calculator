import { DAYS_OF_WEEK, GOV_TOP_UP_PERCENTAGE, MAX_GOV_CONTRIBUTION_PER_PERIOD, REQUIRED_TOTAL_COST_FOR_MAX_BENEFIT, MONTH_NAMES } from './config.js';
import { DateUtil } from './DateUtil.js';

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

  static calculate(inputs) {
    const { year, month, govContributionSoFar } = inputs;

    const totalMonthlyCost = this.resolveMonthlyTotal(inputs, year, month);

    const potentialGovContribution = totalMonthlyCost * GOV_TOP_UP_PERCENTAGE;
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
      optimization.userContributionShortfall = optimization.shortfall * (1 - GOV_TOP_UP_PERCENTAGE);
      optimization.extraGovTopUp = optimization.shortfall * GOV_TOP_UP_PERCENTAGE;

      const currentMonthIndex = month - 1;
      const remainingMonthsInQuarter = quarterInfo.months.filter(m => m >= currentMonthIndex);
      
      if (remainingMonthsInQuarter.length > 0) {
        const extraPerMonth = optimization.userContributionShortfall / remainingMonthsInQuarter.length;
        optimization.extraForCurrentMonth = extraPerMonth;
        optimization.monthlyBreakdown = remainingMonthsInQuarter.map(mIndex => 
          `<strong>£${extraPerMonth.toFixed(2)}</strong> in ${MONTH_NAMES[mIndex]}`
        ).join(', ');
      }
    }
    return optimization;
  }
}
