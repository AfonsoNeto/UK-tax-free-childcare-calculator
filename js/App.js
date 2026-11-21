import { UI } from './UI.js';
import { CostCalculator } from './CostCalculator.js';
import { ThemeSwitcher } from './ThemeSwitcher.js';
import { HistoryStore, findLatestRates, findLatestMonthlyTotal } from './HistoryStore.js';
import { Settings } from './Settings.js';
import { MAX_GOV_CONTRIBUTION_PER_PERIOD } from './config.js';
import { formatGBP } from './format.js';

export class App {
  constructor() {
    this.ui = new UI();
    this.calculator = CostCalculator;
    this.themeSwitcher = new ThemeSwitcher();
    this.historyStore = new HistoryStore();
    this.settings = new Settings();
    this.editingMonth = null;
  }

  init() {
    document.addEventListener('DOMContentLoaded', () => {
      this.ui.init();
      this.ui.setPeriodAnchor(this.settings.getPeriodAnchorMonth());
      this.ui.leftoverBalanceInput.value = (this.settings.getLeftoverBalance() / 100).toFixed(2);
      this.addEventListeners();
      this.renderHistory();
      this.prefillGovContribution();
      this.calculate();
      this.themeSwitcher.init();
    });
  }

  addEventListeners() {
    this.ui.monthYearInput.addEventListener('change', () => {
      this.prefillGovContribution();
      this.calculate();
    });
    this.ui.govContributionInput.addEventListener('input', () => this.calculate());
    this.ui.leftoverBalanceInput.addEventListener('input', () => {
      this.settings.setLeftoverBalance(UI.poundsToPence(this.ui.leftoverBalanceInput.value));
      this.calculate();
    });
    this.ui.periodAnchorSelect.addEventListener('change', () => {
      this.settings.setPeriodAnchorMonth(this.ui.getPeriodAnchor());
      this.prefillGovContribution();
      this.calculate();
    });
    this.ui.monthlyTotalInput.addEventListener('input', () => this.calculate());
    this.ui.modeRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        this.ui.applyMode();
        this.calculate();
      });
    });
    this.ui.daysContainer.addEventListener('change', (e) => {
      if (e.target.type === 'checkbox') {
        this.ui.toggleRateInput(e.target);
      }
      this.calculate();
    });
    this.ui.daysContainer.addEventListener('input', (e) => {
      if (e.target.type === 'number') {
        this.calculate();
      }
    });
    this.ui.saveMonthButton.addEventListener('click', () => this.saveMonth());
    this.ui.useLastRatesButton.addEventListener('click', () => this.applyLastSavedRates());
    this.ui.useLastTotalButton.addEventListener('click', () => this.applyLastSavedTotal());
    this.ui.exportHistoryButton.addEventListener('click', () => this.exportHistory());
    this.ui.importHistoryButton.addEventListener('click', () => this.ui.importFileInput.click());
    this.ui.importFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        this.importHistory(file);
      }
      e.target.value = '';
    });
    this.ui.historyTableContainer.addEventListener('click', (e) => {
      const button = e.target.closest('button[data-action]');
      if (!button) {
        return;
      }
      if (button.dataset.action === 'load') {
        this.loadMonth(button.dataset.month);
      } else if (button.dataset.action === 'delete') {
        this.deleteMonth(button.dataset.month);
      } else if (button.dataset.action === 'edit') {
        this.editMonth(button.dataset.month);
      } else if (button.dataset.action === 'save-edit') {
        this.saveMonthEdit(button.dataset.month);
      } else if (button.dataset.action === 'cancel-edit') {
        this.editingMonth = null;
        this.renderHistory();
      }
    });
    this.ui.historyTableContainer.addEventListener('input', (e) => {
      if (!e.target.classList.contains('actual-paid-input')) {
        return;
      }
      // The actual top-up is exactly 25% of what was paid in — show it live.
      const pence = UI.poundsToPence(e.target.value);
      const display = e.target.closest('tr').querySelector('.auto-topup-value');
      const topUp = CostCalculator.deriveGovTopUp(pence);
      display.textContent = topUp != null ? formatGBP(topUp) : '—';
    });
  }

  calculate() {
    const inputs = this.ui.getInputs();

    if (!inputs.year || !inputs.month || !inputs.hasInputs) {
      this.ui.hideResults();
      return;
    }

    const results = this.calculator.calculate(inputs);
    const optimization = this.calculator.calculateOptimization(inputs, this.ui.getPeriodAnchor(), this.historyStore.load());

    this.ui.showResults();
    this.ui.displayResults(results, optimization.extraForCurrentMonth);
    this.ui.displayOptimization(optimization);
  }

  prefillGovContribution() {
    const [year, month] = this.ui.monthYearInput.value.split('-').map(Number);
    if (!year || !month) {
      return;
    }
    const anchorMonth = this.ui.getPeriodAnchor();
    const contributionSoFar = this.historyStore.periodGovContributionBefore(year, month, anchorMonth);
    this.ui.govContributionInput.value = (contributionSoFar / 100).toFixed(2);
    this.ui.renderAllowance(MAX_GOV_CONTRIBUTION_PER_PERIOD - contributionSoFar);
  }

  monthKey(year, month) {
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  saveMonth() {
    const inputs = this.ui.getInputs();
    if (!inputs.year || !inputs.month || !inputs.hasInputs) {
      return;
    }
    const results = this.calculator.calculate(inputs);
    this.historyStore.saveEntry(this.monthKey(inputs.year, inputs.month), {
      totalMonthlyCost: results.totalMonthlyCost,
      govContribution: results.actualGovContribution,
      userPays: results.userPays,
      transferAmount: results.transferToAccount,
      leftoverBefore: inputs.leftoverBalance,
      dayRates: inputs.totalMonthlyCost > 0 ? null : inputs.currentDayRates
    });
    this.renderHistory();
  }

  loadMonth(monthKey) {
    const entry = this.historyStore.load()[monthKey];
    if (!entry) {
      return;
    }
    this.ui.setMonth(monthKey);
    if (entry.dayRates && Object.keys(entry.dayRates).length > 0) {
      this.ui.setMode('daily');
      this.ui.setDayRates(entry.dayRates);
    } else {
      this.ui.setMode('monthly');
      this.ui.monthlyTotalInput.value = entry.totalMonthlyCost / 100;
    }
    this.prefillGovContribution();
    this.calculate();
  }

  // Prefill the form from the most relevant saved month so the daily
  // rate (or invoice total) never needs digging out.
  applyLastSavedRates() {
    const [year, month] = this.ui.monthYearInput.value.split('-').map(Number);
    if (!year || !month) {
      return;
    }
    const found = findLatestRates(this.historyStore.load(), this.monthKey(year, month));
    if (!found) {
      return;
    }
    this.ui.setDayRates(found.entry.dayRates);
    this.calculate();
  }

  applyLastSavedTotal() {
    const [year, month] = this.ui.monthYearInput.value.split('-').map(Number);
    if (!year || !month) {
      return;
    }
    const found = findLatestMonthlyTotal(this.historyStore.load(), this.monthKey(year, month));
    if (!found) {
      return;
    }
    this.ui.setMonthlyTotal(found.entry.totalMonthlyCost);
    this.calculate();
  }

  deleteMonth(monthKey) {
    if (!confirm(`Delete the saved entry for ${monthKey}?`)) {
      return;
    }
    this.historyStore.removeEntry(monthKey);
    this.renderHistory();
    this.prefillGovContribution();
    this.calculate();
  }

  renderHistory() {
    this.ui.renderHistory(this.historyStore.load(), this.editingMonth);
  }

  editMonth(monthKey) {
    this.editingMonth = monthKey;
    this.renderHistory();
  }

  // Apply the inline-edit form of a history row: estimates may be corrected
  // and the actual deposit recorded. The actual top-up is always derived
  // from what was paid in, never entered by hand.
  saveMonthEdit(monthKey) {
    const row = this.ui.historyTableContainer.querySelector(`tr[data-month="${monthKey}"]`);
    if (!row) {
      return;
    }
    const field = name => UI.poundsToPence(row.querySelector(`[data-field="${name}"]`).value);
    const actualUserPaid = field('actualUserPaid');
    try {
      this.historyStore.updateEntry(monthKey, {
        totalMonthlyCost: field('totalMonthlyCost'),
        govContribution: field('govContribution'),
        userPays: field('userPays'),
        actualUserPaid: actualUserPaid > 0 ? actualUserPaid : null,
        actualGovTopUp: CostCalculator.deriveGovTopUp(actualUserPaid)
      });
      this.editingMonth = null;
      this.renderHistory();
      this.prefillGovContribution();
      this.calculate();
    } catch (err) {
      alert(`Could not update the entry: ${err.message}`);
    }
  }

  exportHistory() {
    const blob = new Blob([this.historyStore.exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tfc-history.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  importHistory(file) {
    file.text().then(text => {
      try {
        this.historyStore.importJSON(text);
        this.renderHistory();
        this.prefillGovContribution();
        this.calculate();
      } catch (err) {
        alert(`Could not import history: ${err.message}`);
      }
    });
  }
}
