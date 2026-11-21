import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { HistoryStore } from '../js/HistoryStore.js';

// Minimal localStorage stand-in so the store can be tested without a DOM.
function memoryStorage() {
  const map = new Map();
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key)
  };
}

// All money values are integer pence.
function entry(overrides = {}) {
  return { totalMonthlyCost: 80000, govContribution: 16000, userPays: 64000, dayRates: null, ...overrides };
}

test('saveEntry and load round-trip an entry', () => {
  const store = new HistoryStore(memoryStorage());
  store.saveEntry('2026-01', entry());
  const history = store.load();
  assert.equal(history['2026-01'].totalMonthlyCost, 80000);
  assert.equal(history['2026-01'].govContribution, 16000);
  assert.equal(history['2026-01'].userPays, 64000);
  assert.ok(history['2026-01'].savedAt);
});

test('persisted storage uses the versioned pence format', () => {
  const storage = memoryStorage();
  const store = new HistoryStore(storage);
  store.saveEntry('2026-01', entry());
  const parsed = JSON.parse(storage.getItem('tfc-history'));
  assert.equal(parsed.version, 2);
  assert.equal(parsed.months['2026-01'].totalMonthlyCost, 80000);
});

test('saveEntry overwrites an existing month instead of duplicating it', () => {
  const store = new HistoryStore(memoryStorage());
  store.saveEntry('2026-01', entry());
  store.saveEntry('2026-01', entry({ totalMonthlyCost: 90000, govContribution: 18000, userPays: 72000 }));
  const history = store.load();
  assert.equal(Object.keys(history).length, 1);
  assert.equal(history['2026-01'].totalMonthlyCost, 90000);
});

test('saveEntry rejects invalid month keys and entries', () => {
  const store = new HistoryStore(memoryStorage());
  assert.throws(() => store.saveEntry('2026-13', entry()));
  assert.throws(() => store.saveEntry('jan-2026', entry()));
  assert.throws(() => store.saveEntry('2026-01', { totalMonthlyCost: 'oops' }));
  assert.throws(() => store.saveEntry('2026-01', entry({ totalMonthlyCost: 800.5 })));
});

test('removeEntry deletes a month', () => {
  const store = new HistoryStore(memoryStorage());
  store.saveEntry('2026-01', entry());
  store.removeEntry('2026-01');
  assert.deepEqual(store.load(), {});
});

test('periodGovContributionBefore sums earlier months of the same period', () => {
  const store = new HistoryStore(memoryStorage());
  store.saveEntry('2026-01', entry({ govContribution: 16000 }));
  store.saveEntry('2026-02', entry({ govContribution: 14000 }));
  store.saveEntry('2026-04', entry({ govContribution: 18000 }));
  store.saveEntry('2025-12', entry({ govContribution: 5000 }));

  // Calendar quarters (default anchor)
  assert.equal(store.periodGovContributionBefore(2026, 1), 0);     // nothing before January
  assert.equal(store.periodGovContributionBefore(2026, 2), 16000); // January only
  assert.equal(store.periodGovContributionBefore(2026, 3), 30000); // January + February
  assert.equal(store.periodGovContributionBefore(2026, 4), 0);     // new quarter
  assert.equal(store.periodGovContributionBefore(2026, 5), 18000); // April only

  // Period anchored to November wraps December into the next quarter
  assert.equal(store.periodGovContributionBefore(2026, 1, 11), 5000);  // December 2025 only
  assert.equal(store.periodGovContributionBefore(2026, 12, 11), 0);    // first month of its period
});

test('importJSON merges v2 exports, letting the newest savedAt win', () => {
  const store = new HistoryStore(memoryStorage());
  store.saveEntry('2026-01', entry({ totalMonthlyCost: 90000, govContribution: 18000, userPays: 72000 }));

  const result = store.importJSON(JSON.stringify({
    version: 2,
    months: {
      '2026-01': entry({ totalMonthlyCost: 1, govContribution: 1, userPays: 1, savedAt: '2020-01-01T00:00:00.000Z' }),
      '2026-03': entry({ savedAt: '2026-03-01T00:00:00.000Z' })
    }
  }));

  assert.deepEqual(result, { imported: 1, total: 2 });
  const history = store.load();
  assert.equal(history['2026-01'].totalMonthlyCost, 90000); // stale export lost
  assert.equal(history['2026-03'].totalMonthlyCost, 80000); // new month imported
});

test('importJSON accepts v1 exports in pounds and migrates them to pence', () => {
  const store = new HistoryStore(memoryStorage());
  const result = store.importJSON(JSON.stringify({
    '2026-03': {
      totalMonthlyCost: 800, govContribution: 160, userPays: 640,
      dayRates: { Monday: 20, Tuesday: 15.5 },
      savedAt: '2026-03-01T00:00:00.000Z'
    }
  }));

  assert.deepEqual(result, { imported: 1, total: 1 });
  const history = store.load();
  assert.equal(history['2026-03'].totalMonthlyCost, 80000);
  assert.equal(history['2026-03'].govContribution, 16000);
  assert.equal(history['2026-03'].userPays, 64000);
  assert.deepEqual(history['2026-03'].dayRates, { Monday: 2000, Tuesday: 1550 });
});

test('importJSON rejects malformed JSON and shapes', () => {
  const store = new HistoryStore(memoryStorage());
  assert.throws(() => store.importJSON('not json'));
  assert.throws(() => store.importJSON('[1, 2, 3]'));
});

test('importJSON skips invalid months and entries', () => {
  const store = new HistoryStore(memoryStorage());
  const result = store.importJSON(JSON.stringify({
    'not-a-month': entry(),
    '2026-13': entry(),
    '2026-05': { totalMonthlyCost: 'broken', govContribution: 1, userPays: 1 }
  }));
  assert.deepEqual(result, { imported: 0, total: 0 });
  assert.deepEqual(store.load(), {});
});

test('load ignores corrupt storage and unusable payloads', () => {
  const storage = memoryStorage();
  const store = new HistoryStore(storage);

  storage.setItem('tfc-history', 'not json at all');
  assert.deepEqual(store.load(), {});

  storage.setItem('tfc-history', JSON.stringify([
    { totalMonthlyCost: 80000, govContribution: 16000, userPays: 64000 }
  ]));
  assert.deepEqual(store.load(), {});

  storage.setItem('tfc-history', JSON.stringify({ version: 2, months: 'broken' }));
  assert.deepEqual(store.load(), {});

  storage.setItem('tfc-history', JSON.stringify({ version: 99, months: {} }));
  assert.deepEqual(store.load(), {});
});

test('load migrates v1 storage in pounds, including whole-pound values', () => {
  const storage = memoryStorage();
  const store = new HistoryStore(storage);
  storage.setItem('tfc-history', JSON.stringify({
    '2026-01': {
      totalMonthlyCost: 800, govContribution: 160, userPays: 640,
      dayRates: { Monday: 20 },
      savedAt: '2026-01-01T00:00:00.000Z'
    },
    '2026-02': {
      totalMonthlyCost: 340, govContribution: 68, userPays: 272,
      savedAt: '2026-02-01T00:00:00.000Z'
    },
    'not-a-month': { totalMonthlyCost: 500, govContribution: 100, userPays: 400 },
    '2026-03': { totalMonthlyCost: 'broken', govContribution: 100, userPays: 400 }
  }));

  const history = store.load();
  assert.deepEqual(Object.keys(history).sort(), ['2026-01', '2026-02']);
  assert.equal(history['2026-01'].totalMonthlyCost, 80000);
  assert.deepEqual(history['2026-01'].dayRates, { Monday: 2000 });
  assert.equal(history['2026-02'].totalMonthlyCost, 34000); // whole pounds still scale
});

test('load keeps v2 pence entries and skips invalid ones', () => {
  const storage = memoryStorage();
  const store = new HistoryStore(storage);
  storage.setItem('tfc-history', JSON.stringify({
    version: 2,
    months: {
      '2026-01': { totalMonthlyCost: '80000', govContribution: '16000', userPays: '64000', savedAt: '2026-01-01T00:00:00.000Z' },
      '2026-02': { totalMonthlyCost: 800.5, govContribution: 160, userPays: 640 }
    }
  }));

  const history = store.load();
  assert.deepEqual(Object.keys(history), ['2026-01']);
  assert.equal(history['2026-01'].totalMonthlyCost, 80000);
  assert.equal(typeof history['2026-01'].totalMonthlyCost, 'number');
});

test('exportJSON produces a v2 payload with pence', () => {
  const store = new HistoryStore(memoryStorage());
  store.saveEntry('2026-01', entry());
  const parsed = JSON.parse(store.exportJSON());
  assert.equal(parsed.version, 2);
  assert.equal(parsed.months['2026-01'].totalMonthlyCost, 80000);
  assert.equal(parsed.months['2026-01'].govContribution, 16000);
});
