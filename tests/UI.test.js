import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { UI } from '../js/UI.js';

// The static conversion helper is DOM-free, so it is testable in Node.
test('poundsToPence converts pounds to integer pence', () => {
  assert.equal(UI.poundsToPence('1092.5'), 109250);
  assert.equal(UI.poundsToPence('52'), 5200);
  assert.equal(UI.poundsToPence('228.8'), 22880);
});

test('poundsToPence treats empty and non-numeric input as zero', () => {
  assert.equal(UI.poundsToPence(''), 0);
  assert.equal(UI.poundsToPence('abc'), 0);
  assert.equal(UI.poundsToPence(null), 0);
});

test('poundsToPence clamps negative amounts to zero', () => {
  assert.equal(UI.poundsToPence('-5'), 0);
  assert.equal(UI.poundsToPence('-0.01'), 0);
  // A negative contribution-so-far would otherwise inflate the £500 allowance
});
