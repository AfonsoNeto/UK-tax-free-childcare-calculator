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

function entry(overrides = {}) {
  return { totalMonthlyCost: 800, govContribution: 160, userPays: 640, dayRates: null, ...overrides };
}

test('saveEntry and load round-trip an entry', () => {
  const store = new HistoryStore(memoryStorage());
  store.saveEntry('2026-01', entry());
  const history = store.load();
  assert.equal(history['2026-01'].totalMonthlyCost, 800);
  assert.equal(history['2026-01'].govContribution, 160);
  assert.equal(history['2026-01'].userPays, 640);
  assert.ok(history['2026-01'].savedAt);
});

test('saveEntry overwrites an existing month instead of duplicating it', () => {
  const store = new HistoryStore(memoryStorage());
  store.saveEntry('2026-01', entry());
  store.saveEntry('2026-01', entry({ totalMonthlyCost: 900, govContribution: 180, userPays: 720 }));
  const history = store.load();
  assert.equal(Object.keys(history).length, 1);
  assert.equal(history['2026-01'].totalMonthlyCost, 900);
});

test('saveEntry rejects invalid month keys and entries', () => {
  const store = new HistoryStore(memoryStorage());
  assert.throws(() => store.saveEntry('2026-13', entry()));
  assert.throws(() => store.saveEntry('jan-2026', entry()));
  assert.throws(() => store.saveEntry('2026-01', { totalMonthlyCost: 'oops' }));
});

test('removeEntry deletes a month', () => {
  const store = new HistoryStore(memoryStorage());
  store.saveEntry('2026-01', entry());
  store.removeEntry('2026-01');
  assert.deepEqual(store.load(), {});
});

test('quarterGovContributionBefore sums earlier months of the same quarter', () => {
  const store = new HistoryStore(memoryStorage());
  store.saveEntry('2026-01', entry({ govContribution: 160 }));
  store.saveEntry('2026-02', entry({ govContribution: 140 }));
  store.saveEntry('2026-04', entry({ govContribution: 180 }));
  store.saveEntry('2025-01', entry({ govContribution: 999 }));

  assert.equal(store.quarterGovContributionBefore(2026, 1), 0);   // nothing before January
  assert.equal(store.quarterGovContributionBefore(2026, 2), 160); // January only
  assert.equal(store.quarterGovContributionBefore(2026, 3), 300); // January + February
  assert.equal(store.quarterGovContributionBefore(2026, 4), 0);   // new quarter
  assert.equal(store.quarterGovContributionBefore(2026, 5), 180); // April only
});

test('importJSON merges exports, letting the newest savedAt win', () => {
  const store = new HistoryStore(memoryStorage());
  store.saveEntry('2026-01', entry({ totalMonthlyCost: 900, govContribution: 180, userPays: 720 }));

  const result = store.importJSON(JSON.stringify({
    '2026-01': { totalMonthlyCost: 1, govContribution: 1, userPays: 1, savedAt: '2020-01-01T00:00:00.000Z' },
    '2026-03': { totalMonthlyCost: 800, govContribution: 160, userPays: 640, savedAt: '2026-03-01T00:00:00.000Z' }
  }));

  assert.deepEqual(result, { imported: 1, total: 2 });
  const history = store.load();
  assert.equal(history['2026-01'].totalMonthlyCost, 900); // stale export lost
  assert.equal(history['2026-03'].totalMonthlyCost, 800); // new month imported
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

test('load ignores corrupt storage and invalid entries', () => {
  const storage = memoryStorage();
  const store = new HistoryStore(storage);

  storage.setItem('tfc-history', 'not json at all');
  assert.deepEqual(store.load(), {});

  storage.setItem('tfc-history', JSON.stringify([
    { totalMonthlyCost: 800, govContribution: 160, userPays: 640 }
  ]));
  assert.deepEqual(store.load(), {});

  storage.setItem('tfc-history', JSON.stringify({
    '2026-01': { totalMonthlyCost: 800, govContribution: 160, userPays: 640 },
    'not-a-month': entry(),
    '2026-02': { totalMonthlyCost: 'broken', govContribution: 160, userPays: 640 }
  }));
  assert.deepEqual(Object.keys(store.load()), ['2026-01']);
});

test('load coerces numeric fields stored as strings', () => {
  const storage = memoryStorage();
  const store = new HistoryStore(storage);
  storage.setItem('tfc-history', JSON.stringify({
    '2026-01': { totalMonthlyCost: '800', govContribution: '160', userPays: '640', savedAt: '2026-01-01T00:00:00.000Z' }
  }));
  const history = store.load();
  assert.equal(typeof history['2026-01'].totalMonthlyCost, 'number');
  assert.equal(history['2026-01'].govContribution, 160);
  assert.equal(history['2026-01'].userPays, 640);
});

test('exportJSON produces the stored history as JSON', () => {
  const store = new HistoryStore(memoryStorage());
  store.saveEntry('2026-01', entry());
  const parsed = JSON.parse(store.exportJSON());
  assert.equal(parsed['2026-01'].totalMonthlyCost, 800);
  assert.equal(parsed['2026-01'].govContribution, 160);
});
