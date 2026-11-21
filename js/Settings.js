function defaultStorage() {
  return window.localStorage;
}

// Small wrapper around per-child localStorage preferences. All keys are
// parametrized so each child has their own values, and the storage
// backend is injectable so tests can run without a DOM.
export class Settings {
  constructor(storage = defaultStorage(), periodAnchorKey = 'tfc-period-anchor', leftoverKey = 'tfc-leftover', inputModeKey = 'tfc-input-mode') {
    this.storage = storage;
    this.periodAnchorKey = periodAnchorKey;
    this.leftoverKey = leftoverKey;
    this.inputModeKey = inputModeKey;
  }

  // Month of the year (1-12) in which the 3-month top-up period cycle
  // starts. January by default, matching calendar quarters.
  getPeriodAnchorMonth() {
    const raw = Number(this.storage.getItem(this.periodAnchorKey));
    return Number.isInteger(raw) && raw >= 1 && raw <= 12 ? raw : 1;
  }

  setPeriodAnchorMonth(month) {
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new Error(`Invalid period anchor month: ${month}`);
    }
    this.storage.setItem(this.periodAnchorKey, String(month));
  }

  // Money already sitting in the TFC account, as integer pence.
  getLeftoverBalance() {
    const raw = Number(this.storage.getItem(this.leftoverKey));
    return Number.isInteger(raw) && raw >= 0 ? raw : 0;
  }

  setLeftoverBalance(pence) {
    if (!Number.isInteger(pence) || pence < 0) {
      throw new Error(`Invalid leftover balance: ${pence}`);
    }
    this.storage.setItem(this.leftoverKey, String(pence));
  }

  // How the user prefers to enter costs: 'daily' or 'monthly'.
  getInputMode() {
    const mode = this.storage.getItem(this.inputModeKey);
    return mode === 'monthly' || mode === 'daily' ? mode : 'daily';
  }

  setInputMode(mode) {
    if (mode !== 'daily' && mode !== 'monthly') {
      throw new Error(`Invalid input mode: ${mode}`);
    }
    this.storage.setItem(this.inputModeKey, mode);
  }
}
