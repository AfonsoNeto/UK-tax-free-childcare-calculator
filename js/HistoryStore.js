import { DateUtil } from './DateUtil.js';

const STORAGE_KEY = 'tfc-history';
const STORAGE_VERSION = 2;
const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function monthKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function defaultStorage() {
  return window.localStorage;
}

function isValidEntry(entry) {
  return Boolean(entry)
    && typeof entry === 'object'
    && Number.isInteger(Number(entry.totalMonthlyCost)) && Number(entry.totalMonthlyCost) >= 0
    && Number.isInteger(Number(entry.govContribution)) && Number(entry.govContribution) >= 0
    && Number.isInteger(Number(entry.userPays)) && Number(entry.userPays) >= 0;
}

function normalizeEntry(entry) {
  return {
    totalMonthlyCost: Number(entry.totalMonthlyCost),
    govContribution: Number(entry.govContribution),
    userPays: Number(entry.userPays),
    transferAmount: Number.isInteger(Number(entry.transferAmount)) ? Number(entry.transferAmount) : null,
    leftoverBefore: Number.isInteger(Number(entry.leftoverBefore)) ? Number(entry.leftoverBefore) : null,
    dayRates: entry.dayRates && typeof entry.dayRates === 'object' ? entry.dayRates : null,
    savedAt: typeof entry.savedAt === 'string' ? entry.savedAt : ''
  };
}

// v1 stored pounds as decimals; v2 stores integer pence. Entry-level
// validation happens after migration, when the values are final.
function normalizeMonthEntries(parsed, fromV1) {
  const history = {};
  const scale = fromV1 ? 100 : 1;
  for (const [key, entry] of Object.entries(parsed)) {
    if (!MONTH_KEY_PATTERN.test(key) || !entry || typeof entry !== 'object') {
      continue;
    }
    const candidate = normalizeEntry({
      totalMonthlyCost: Number(entry.totalMonthlyCost) * scale,
      govContribution: Number(entry.govContribution) * scale,
      userPays: Number(entry.userPays) * scale,
      transferAmount: fromV1 ? Math.round(Number(entry.transferAmount) * 100) : entry.transferAmount,
      leftoverBefore: fromV1 ? Math.round(Number(entry.leftoverBefore) * 100) : entry.leftoverBefore,
      dayRates: entry.dayRates,
      savedAt: entry.savedAt
    });
    if (fromV1 && candidate.dayRates) {
      candidate.dayRates = Object.fromEntries(
        Object.entries(candidate.dayRates).map(([day, rate]) => [day, Math.round(Number(rate) * 100)])
      );
    }
    if (isValidEntry(candidate)) {
      history[key] = candidate;
    }
  }
  return history;
}

function isValidHistoryObject(parsed) {
  return Boolean(parsed) && typeof parsed === 'object' && !Array.isArray(parsed);
}

// Returns the months object of a parsed payload in the v2 (pence) shape,
// or null if the payload is not usable history data.
function toMonthEntries(parsed) {
  if (!isValidHistoryObject(parsed)) {
    return null;
  }
  if (parsed.version === STORAGE_VERSION) {
    return isValidHistoryObject(parsed.months) ? normalizeMonthEntries(parsed.months, false) : {};
  }
  if (parsed.version !== undefined) {
    return null; // unknown future version
  }
  // v1: bare object of month entries in pounds
  return normalizeMonthEntries(parsed, true);
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
      const months = toMonthEntries(JSON.parse(raw));
      return months || {};
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
  // top-up period that fall before the given month, to prefill the input.
  periodGovContributionBefore(year, month, anchorMonth = 1) {
    const history = this.load();
    const selectedKey = monthKey(year, month);
    return DateUtil.getPeriodInfo(year, month, anchorMonth).months
      .map(m => monthKey(m.year, m.month))
      .filter(key => key < selectedKey)
      .reduce((sum, key) => (history[key] ? sum + history[key].govContribution : sum), 0);
  }

  // Merge a JSON export into the stored history; the newest savedAt wins.
  // Accepts both the v1 (bare month object, pounds) and v2 (versioned
  // wrapper, pence) formats. Invalid months/entries are skipped.
  // Returns { imported, total }.
  importJSON(text) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('not valid JSON');
    }
    const incoming = toMonthEntries(parsed);
    if (!incoming) {
      throw new Error('expected an object keyed by month');
    }
    const history = this.load();
    let imported = 0;
    for (const [key, entry] of Object.entries(incoming)) {
      const existing = history[key];
      if (!existing || (entry.savedAt || '') > existing.savedAt) {
        history[key] = entry;
        imported++;
      }
    }
    this.persist(history);
    return { imported, total: Object.keys(history).length };
  }

  exportJSON() {
    return JSON.stringify({ version: STORAGE_VERSION, months: this.load() }, null, 2);
  }

  persist(history) {
    this.storage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, months: history }));
  }
}
