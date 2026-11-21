import { DAYS_OF_WEEK, MONTH_NAMES, MAX_GOV_CONTRIBUTION_PER_PERIOD } from './config.js';
import { formatGBP } from './format.js';

export class UI {
  constructor() {
    this.monthYearInput = document.getElementById('month-year');
    this.govContributionInput = document.getElementById('gov-contribution');
    this.allowanceNote = document.getElementById('allowance-note');
    this.periodAnchorSelect = document.getElementById('period-anchor');
    this.settingsSection = document.getElementById('settings-section');
    this.daysGroup = document.getElementById('days-group');
    this.daysContainer = document.getElementById('days-container');
    this.monthlyTotalGroup = document.getElementById('monthly-total-group');
    this.monthlyTotalInput = document.getElementById('monthly-total');
    this.leftoverBalanceInput = document.getElementById('leftover-balance');
    this.useLastRatesButton = document.getElementById('use-last-rates');
    this.useLastTotalButton = document.getElementById('use-last-total');
    this.modeRadios = document.querySelectorAll('input[name="input-mode"]');
    this.saveMonthButton = document.getElementById('save-month');
    this.historySection = document.getElementById('history-section');
    this.historyTableContainer = document.getElementById('history-table-container');
    this.exportHistoryButton = document.getElementById('export-history');
    this.importHistoryButton = document.getElementById('import-history');
    this.importFileInput = document.getElementById('import-file');
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
    const savedMode = localStorage.getItem('tfc-input-mode');
    if (savedMode === 'monthly' || savedMode === 'daily') {
      this.setMode(savedMode);
    }
    this.populateDays();
    this.populatePeriodAnchor();
  }

  populatePeriodAnchor() {
    MONTH_NAMES.forEach((name, index) => {
      const option = document.createElement('option');
      option.value = String(index + 1);
      option.textContent = name;
      this.periodAnchorSelect.appendChild(option);
    });
  }

  setPeriodAnchor(month) {
    this.periodAnchorSelect.value = String(month);
  }

  getPeriodAnchor() {
    return Number(this.periodAnchorSelect.value) || 1;
  }

  renderAllowance(remainingPence) {
    if (remainingPence >= MAX_GOV_CONTRIBUTION_PER_PERIOD) {
      this.allowanceNote.textContent = `Full ${formatGBP(MAX_GOV_CONTRIBUTION_PER_PERIOD)} government top-up available in this period`;
    } else if (remainingPence > 0) {
      this.allowanceNote.textContent = `${formatGBP(remainingPence)} government top-up left in this period`;
    } else {
      this.allowanceNote.textContent = `Period allowance of ${formatGBP(MAX_GOV_CONTRIBUTION_PER_PERIOD)} already claimed`;
    }
  }

  getMode() {
    const checked = document.querySelector('input[name="input-mode"]:checked');
    return checked ? checked.value : 'daily';
  }

  setMode(mode) {
    const radio = document.querySelector(`input[name="input-mode"][value="${mode}"]`);
    if (radio) {
      radio.checked = true;
    }
    this.applyMode();
  }

  applyMode() {
    const isMonthly = this.getMode() === 'monthly';
    this.monthlyTotalGroup.classList.toggle('hidden', !isMonthly);
    this.daysGroup.classList.toggle('hidden', isMonthly);
    localStorage.setItem('tfc-input-mode', this.getMode());
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

  // User-facing inputs are in pounds; convert to the integer pence used internally.
  static poundsToPence(value) {
    return Math.round((parseFloat(value) || 0) * 100);
  }

  getInputs() {
    const [year, month] = this.monthYearInput.value.split('-').map(Number);
    const govContributionSoFar = UI.poundsToPence(this.govContributionInput.value);
    const leftoverBalance = UI.poundsToPence(this.leftoverBalanceInput.value);

    const currentDayRates = {};
    let totalMonthlyCost = 0;
    let hasInputs = false;

    if (this.getMode() === 'monthly') {
      totalMonthlyCost = UI.poundsToPence(this.monthlyTotalInput.value);
      hasInputs = totalMonthlyCost > 0;
    } else {
      DAYS_OF_WEEK.forEach(day => {
        const dayCheckbox = document.getElementById(`${day.toLowerCase()}-check`);
        if (dayCheckbox.checked) {
          const dayRateInput = document.getElementById(`${day.toLowerCase()}-rate`);
          const dailyRate = UI.poundsToPence(dayRateInput.value);
          if (dailyRate > 0) {
            currentDayRates[day] = dailyRate;
            hasInputs = true;
          }
        }
      });
    }

    return { year, month, govContributionSoFar, currentDayRates, totalMonthlyCost, leftoverBalance, hasInputs };
  }

  toggleRateInput(checkbox, focus = true) {
    const rateInputDiv = checkbox.closest('div').nextElementSibling;
    const rateInput = rateInputDiv.querySelector('input');
    if (checkbox.checked) {
      rateInputDiv.classList.remove('hidden');
      rateInput.disabled = false;
      if (focus) {
        rateInput.focus();
      }
    } else {
      rateInputDiv.classList.add('hidden');
      rateInput.disabled = true;
      rateInput.value = '';
    }
  }

  setMonth(monthKey) {
    this.monthYearInput.value = monthKey;
  }

  // Restore the day checkboxes and rate inputs from a saved dayRates object.
  setDayRates(dayRates) {
    DAYS_OF_WEEK.forEach(day => {
      const checkbox = document.getElementById(`${day.toLowerCase()}-check`);
      const rateInput = document.getElementById(`${day.toLowerCase()}-rate`);
      const hasRate = Boolean(dayRates[day]);
      if (checkbox.checked !== hasRate) {
        checkbox.checked = hasRate;
        this.toggleRateInput(checkbox, false);
      }
      rateInput.value = hasRate ? dayRates[day] / 100 : '';
    });
  }

  setMonthlyTotal(totalPence) {
    this.monthlyTotalInput.value = totalPence / 100;
  }

  renderHistory(history) {
    const entries = Object.entries(history).sort((a, b) => b[0].localeCompare(a[0]));
    this.useLastRatesButton.classList.toggle('hidden', !entries.some(([, entry]) => entry.dayRates && Object.keys(entry.dayRates).length > 0));
    this.useLastTotalButton.classList.toggle('hidden', !entries.some(([, entry]) => entry.totalMonthlyCost > 0));
    if (entries.length === 0) {
      this.historyTableContainer.innerHTML = '<p class="text-sm text-gray-500 text-center py-2">No saved months yet. Calculate a month and click &quot;Save this month&quot;.</p>';
      return;
    }
    const rows = entries.map(([key, entry]) => {
      const [year, month] = key.split('-').map(Number);
      const label = `${MONTH_NAMES[month - 1]} ${year}`;
      return `
        <tr data-month="${key}">
          <td>${label}</td>
          <td class="num">${formatGBP(entry.totalMonthlyCost)}</td>
          <td class="num">${formatGBP(entry.govContribution)}</td>
          <td class="num">${formatGBP(entry.userPays)}</td>
          <td class="actions">
            <button type="button" class="btn btn-small btn-secondary" data-action="load" data-month="${key}">Load</button>
            <button type="button" class="btn btn-small btn-danger" data-action="delete" data-month="${key}">Delete</button>
          </td>
        </tr>`;
    }).join('');
    this.historyTableContainer.innerHTML = `
      <table class="history-table">
        <thead>
          <tr>
            <th>Month</th>
            <th class="num">Total Cost</th>
            <th class="num">Gov Contribution</th>
            <th class="num">You Pay</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  displayResults(results, extraForCurrentMonth) {
    const { totalMonthlyCost, actualGovContribution, userPays, transferToAccount, balanceAfterPayment, leftoverBalance } = results;
    const hasLeftover = leftoverBalance > 0;
    const maximizedUserPays = userPays + extraForCurrentMonth;

    const leftoverRows = hasLeftover ? `
      <div class="result-item">
        <span class="result-label" title="The amount to pay into your TFC account now, so the balance plus the government top-up covers this month's invoice.">Transfer to Account</span>
        <span class="result-value transfer">${formatGBP(transferToAccount)}</span>
      </div>
      <div class="result-item">
        <span class="result-label">Balance After Paying</span>
        <span class="result-value">${formatGBP(balanceAfterPayment)}</span>
      </div>
    ` : '';

    const maximizedRow = hasLeftover ? '' : `
      <div class="result-item">
        <span class="result-label" title="This is your monthly payment plus any extra needed to get the full £500 government top-up for the quarter.">You Pay (Maximized Benefit)</span>
        <span class="result-value user-pays">${formatGBP(maximizedUserPays)}</span>
      </div>
    `;

    this.resultsBreakdown.innerHTML = `
      <div class="result-item">
        <span class="result-label">Total Monthly Cost</span>
        <span class="result-value total">${formatGBP(totalMonthlyCost)}</span>
      </div>
      <div class="result-item">
        <span class="result-label">Government Contribution</span>
        <span class="result-value gov-pays">${formatGBP(actualGovContribution)}</span>
      </div>
      <div class="result-item">
        <span class="result-label">You Pay</span>
        <span class="result-value user-pays">${formatGBP(userPays)}</span>
      </div>
      ${leftoverRows}
      ${maximizedRow}
    `;
  }

  displayOptimization(optimization) {
    if (optimization.onTrack) {
      this.optimizationDetails.innerHTML = `
        For the <strong>${optimization.periodName}</strong> period, your estimated cost is <strong>${formatGBP(optimization.totalQuarterlyCost)}</strong>.
        You're on track to receive the full <strong>£500</strong> government top-up!
      `;
    } else {
      this.optimizationDetails.innerHTML = `
        For <strong>${optimization.periodName}</strong>, your cost is <strong>${formatGBP(optimization.totalQuarterlyCost)}</strong>. To get the full £500 top-up, you could contribute an extra ${optimization.monthlyBreakdown}.
        This would unlock an additional <strong>${formatGBP(optimization.extraGovTopUp)}</strong> from the government.
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
