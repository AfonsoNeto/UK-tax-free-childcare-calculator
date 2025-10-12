import { UI } from './UI.js';
import { CostCalculator } from './CostCalculator.js';

export class App {
  constructor() {
    this.ui = new UI();
    this.calculator = CostCalculator;
  }

  init() {
    document.addEventListener('DOMContentLoaded', () => {
      this.ui.init();
      this.addEventListeners();
      this.calculate();
    });
  }

  addEventListeners() {
    this.ui.monthYearInput.addEventListener('change', () => this.calculate());
    this.ui.govContributionInput.addEventListener('input', () => this.calculate());
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
  }

  calculate() {
    const inputs = this.ui.getInputs();
    
    if (!inputs.year || !inputs.month || !inputs.hasInputs) {
      this.ui.hideResults();
      return;
    }

    const results = this.calculator.calculate(inputs);
    const optimization = this.calculator.calculateOptimization(inputs);

    this.ui.showResults();
    this.ui.displayResults(results, optimization.extraForCurrentMonth);
    this.ui.displayOptimization(optimization);
  }
}
