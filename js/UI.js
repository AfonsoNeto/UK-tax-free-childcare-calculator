import { DAYS_OF_WEEK } from './config.js';

export class UI {
  constructor() {
    this.monthYearInput = document.getElementById('month-year');
    this.govContributionInput = document.getElementById('gov-contribution');
    this.daysContainer = document.getElementById('days-container');
    this.resultsContainer = document.getElementById('results-container');
    this.resultsBreakdown = document.getElementById('results-breakdown');
    this.optimizationContainer = document.getElementById('optimization-container');
    this.optimizationDetails = document.getElementById('optimization-details');
  }

  init() {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    this.monthYearInput.value = `${year}-${month}`;
    this.populateDays();
  }

  populateDays() {
    DAYS_OF_WEEK.forEach(day => {
      const dayId = day.toLowerCase();
      const element = document.createElement('div');
      element.className = 'flex items-center justify-between bg-gray-50 p-3 rounded-md';
      element.innerHTML = `
        <div class="flex items-center">
          <input type="checkbox" id="${dayId}-check" name="day" value="${day}" class="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500">
          <label for="${dayId}-check" class="ml-3 text-sm font-medium text-gray-700">${day}</label>
        </div>
        <div class="relative day-rate-input hidden">
          <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 text-sm">£</span>
          <input type="number" id="${dayId}-rate" class="input pl-7 w-28 text-sm" placeholder="Rate" min="0" step="0.01" disabled>
        </div>
      `;
      this.daysContainer.appendChild(element);
    });
  }

  getInputs() {
    const [year, month] = this.monthYearInput.value.split('-').map(Number);
    const govContributionSoFar = parseFloat(this.govContributionInput.value) || 0;
    
    const currentDayRates = {};
    let hasInputs = false;
    DAYS_OF_WEEK.forEach(day => {
      const dayCheckbox = document.getElementById(`${day.toLowerCase()}-check`);
      if (dayCheckbox.checked) {
        const dayRateInput = document.getElementById(`${day.toLowerCase()}-rate`);
        const dailyRate = parseFloat(dayRateInput.value) || 0;
        if (dailyRate > 0) {
          currentDayRates[day] = dailyRate;
          hasInputs = true;
        }
      }
    });

    return { year, month, govContributionSoFar, currentDayRates, hasInputs };
  }

  toggleRateInput(checkbox) {
    const rateInputDiv = checkbox.closest('div').nextElementSibling;
    const rateInput = rateInputDiv.querySelector('input');
    if (checkbox.checked) {
      rateInputDiv.classList.remove('hidden');
      rateInput.disabled = false;
      rateInput.focus();
    } else {
      rateInputDiv.classList.add('hidden');
      rateInput.disabled = true;
      rateInput.value = '';
    }
  }

  displayResults(results, extraForCurrentMonth) {
    const { totalMonthlyCost, actualGovContribution, userPays } = results;
    const maximizedUserPays = userPays + extraForCurrentMonth;
    this.resultsBreakdown.innerHTML = `
      <div class="result-item">
        <span class="result-label">Total Monthly Cost</span>
        <span class="result-value total">£${totalMonthlyCost.toFixed(2)}</span>
      </div>
      <div class="result-item">
        <span class="result-label">Government Contribution</span>
        <span class="result-value gov-pays">£${actualGovContribution.toFixed(2)}</span>
      </div>
      <div class="result-item">
        <span class="result-label">You Pay</span>
        <span class="result-value user-pays">£${userPays.toFixed(2)}</span>
      </div>
      <div class="result-item">
        <span class="result-label" title="This is your monthly payment plus any extra needed to get the full £500 government top-up for the quarter.">You Pay (Maximized Benefit)</span>
        <span class="result-value user-pays">£${maximizedUserPays.toFixed(2)}</span>
      </div>
    `;
  }

  displayOptimization(optimization) {
    if (optimization.onTrack) {
      this.optimizationDetails.innerHTML = `
        For the <strong>${optimization.periodName}</strong> period, your estimated cost is <strong>£${optimization.totalQuarterlyCost.toFixed(2)}</strong>.
        You're on track to receive the full <strong>£500</strong> government top-up!
      `;
    } else {
      this.optimizationDetails.innerHTML = `
        For <strong>${optimization.periodName}</strong>, your cost is <strong>£${optimization.totalQuarterlyCost.toFixed(2)}</strong>. To get the full £500 top-up, you could contribute an extra ${optimization.monthlyBreakdown}.
        This would unlock an additional <strong>£${optimization.extraGovTopUp.toFixed(2)}</strong> from the government.
      `;
    }
  }

  showResults() {
    this.resultsContainer.classList.remove('hidden');
    this.optimizationContainer.classList.remove('hidden');
  }

  hideResults() {
    this.resultsContainer.classList.add('hidden');
    this.optimizationContainer.classList.add('hidden');
  }
}
