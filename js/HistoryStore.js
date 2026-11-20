import { DateUtil } from './DateUtil.js';

const STORAGE_KEY = 'tfc-history';
const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function defaultStorage() {
  return window.localStorage;
}

function isValidEntry(entry) {
  return Boolean(entry)
    && typeof entry === 'object'
    && Number.isFinite(Number(entry.totalMonthlyCost)) && Number(entry.totalMonthlyCost) >= 0
    && Number.isFinite(Number(entry.govContribution)) && Number(entry.govContribution) >= 0
    && Number.isFinite(Number(entry.userPays)) && Number(entry.userPays) >= 0;
}

function normalizeEntry(entry) {
  return {
    totalMonthlyCost: Number(entry.totalMonthlyCost),
    govContribution: Number(entry.govContribution),
    userPays: Number(entry.userPays),
    dayRates: entry.dayRates && typeof entry.dayRates === 'object' ? entry.dayRates : null,
    savedAt: typeof entry.savedAt === 'string' ? entry.savedAt : ''
  };
}

// Keeps one entry per calculated month, persisted to a JSON blob in localStorage.
// The storage backend is injectable so tests can run without a DOM.
export class HistoryStore {
  constructor(storage = defaultStorage()) {
    this.storage = storage;
  }

  load() {
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) {
        return {};
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {};
      }
      const history = {};
      for (const [key, entry] of Object.entries(parsed)) {
        if (MONTH_KEY_PATTERN.test(key) && isValidEntry(entry)) {
          history[key] = normalizeEntry(entry);
        }
      }
      return history;
    } catch {
      return {};
    }
  }

  saveEntry(monthKey, entry) {
    if (!MONTH_KEY_PATTERN.test(monthKey)) {
      throw new Error(`Invalid month key: ${monthKey}`);
    }
    if (!isValidEntry(entry)) {
      throw new Error('Invalid history entry');
    }
    const history = this.load();
    history[monthKey] = { ...normalizeEntry(entry), savedAt: new Date().toISOString() };
    this.persist(history);
    return history[monthKey];
  }

  removeEntry(monthKey) {
    const history = this.load();
    delete history[monthKey];
    this.persist(history);
  }

  // Sum of the government contributions saved for the months of the same
  // quarter that fall before the given month, to prefill the input.
  quarterGovContributionBefore(year, month) {
    const history = this.load();
    const quarterMonths = DateUtil.getQuarterInfo(year, month).months;
    return quarterMonths
      .filter(m => m + 1 < month)
      .reduce((sum, m) => {
        const entry = history[`${year}-${String(m + 1).padStart(2, '0')}`];
        return entry ? sum + entry.govContribution : sum;
      }, 0);
  }

  // Merge a JSON export into the stored history; the newest savedAt wins.
  // Invalid months/entries are skipped. Returns { imported, total }.
  importJSON(text) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('not valid JSON');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('expected an object keyed by month');
    }
    const history = this.load();
    let imported = 0;
    for (const [key, entry] of Object.entries(parsed)) {
      if (!MONTH_KEY_PATTERN.test(key) || !isValidEntry(entry)) {
        continue;
      }
      const existing = history[key];
      if (!existing || (entry.savedAt || '') > existing.savedAt) {
        history[key] = normalizeEntry(entry);
        imported++;
      }
    }
    this.persist(history);
    return { imported, total: Object.keys(history).length };
  }

  exportJSON() {
    return JSON.stringify(this.load(), null, 2);
  }

  persist(history) {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(history));
  }
}
