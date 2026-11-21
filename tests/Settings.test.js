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

test('leftover balance defaults to zero and persists', () => {
  const storage = memoryStorage();
  const settings = new Settings(storage);
  assert.equal(settings.getLeftoverBalance(), 0);

  settings.setLeftoverBalance(50000);
  assert.equal(settings.getLeftoverBalance(), 50000);
  assert.equal(storage.getItem('tfc-leftover'), '50000');
});

test('getLeftoverBalance tolerates corrupt values', () => {
  const storage = memoryStorage();
  storage.setItem('tfc-leftover', 'not a number');
  const settings = new Settings(storage);
  assert.equal(settings.getLeftoverBalance(), 0);

  storage.setItem('tfc-leftover', '-100');
  assert.equal(settings.getLeftoverBalance(), 0);

  storage.setItem('tfc-leftover', '10.5');
  assert.equal(settings.getLeftoverBalance(), 0);
});

test('setLeftoverBalance rejects invalid values', () => {
  const settings = new Settings(memoryStorage());
  assert.throws(() => settings.setLeftoverBalance(-1));
  assert.throws(() => settings.setLeftoverBalance(10.5));
  assert.throws(() => settings.setLeftoverBalance('oops'));
});
