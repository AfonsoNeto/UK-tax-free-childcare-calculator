const PERIOD_ANCHOR_KEY = 'tfc-period-anchor';

function defaultStorage() {
  return window.localStorage;
}

// Small wrapper around localStorage for user preferences. The storage
// backend is injectable so tests can run without a DOM.
export class Settings {
  constructor(storage = defaultStorage()) {
    this.storage = storage;
  }

  // Month of the year (1-12) in which the 3-month top-up period cycle
  // starts. January by default, matching calendar quarters.
  getPeriodAnchorMonth() {
    const raw = Number(this.storage.getItem(PERIOD_ANCHOR_KEY));
    return Number.isInteger(raw) && raw >= 1 && raw <= 12 ? raw : 1;
  }

  setPeriodAnchorMonth(month) {
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new Error(`Invalid period anchor month: ${month}`);
    }
    this.storage.setItem(PERIOD_ANCHOR_KEY, String(month));
  }
}
