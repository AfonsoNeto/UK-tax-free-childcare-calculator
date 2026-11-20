import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { Settings } from '../js/Settings.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key)
  };
}

test('getPeriodAnchorMonth defaults to January', () => {
  const settings = new Settings(memoryStorage());
  assert.equal(settings.getPeriodAnchorMonth(), 1);
});

test('setPeriodAnchorMonth persists and reads back', () => {
  const storage = memoryStorage();
  const settings = new Settings(storage);
  settings.setPeriodAnchorMonth(11);
  assert.equal(settings.getPeriodAnchorMonth(), 11);
  assert.equal(storage.getItem('tfc-period-anchor'), '11');
});

test('getPeriodAnchorMonth tolerates corrupt values', () => {
  const storage = memoryStorage();
  storage.setItem('tfc-period-anchor', 'not a number');
  const settings = new Settings(storage);
  assert.equal(settings.getPeriodAnchorMonth(), 1);

  storage.setItem('tfc-period-anchor', '13');
  assert.equal(settings.getPeriodAnchorMonth(), 1);

  storage.setItem('tfc-period-anchor', '0');
  assert.equal(settings.getPeriodAnchorMonth(), 1);
});

test('setPeriodAnchorMonth rejects invalid months', () => {
  const settings = new Settings(memoryStorage());
  assert.throws(() => settings.setPeriodAnchorMonth(0));
  assert.throws(() => settings.setPeriodAnchorMonth(13));
  assert.throws(() => settings.setPeriodAnchorMonth(3.5));
});
