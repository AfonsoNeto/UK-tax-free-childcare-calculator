import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { ChildStore } from '../js/ChildStore.js';

function memoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key)
  };
}

test('a fresh browser gets a default child', () => {
  const store = new ChildStore(memoryStorage());
  const { children, activeChildId } = store.load();
  assert.deepEqual(children, [{ id: 'child-1', name: 'Child 1' }]);
  assert.equal(activeChildId, 'child-1');
  assert.equal(store.getActiveChild().id, 'child-1');
});

test('legacy single-child data migrates into Child 1 on first load', () => {
  const storage = memoryStorage({
    'tfc-history': '{"version":2,"months":{"2026-01":{"totalMonthlyCost":80000,"govContribution":16000,"userPays":64000,"savedAt":"2026-01-01T00:00:00.000Z"}}}',
    'tfc-period-anchor': '11',
    'tfc-leftover': '5000',
    'tfc-input-mode': 'monthly'
  });
  const store = new ChildStore(storage);
  const { children, activeChildId } = store.load();

  assert.deepEqual(children, [{ id: 'child-1', name: 'Child 1' }]);
  assert.equal(activeChildId, 'child-1');
  // Legacy keys are moved to per-child keys
  assert.notEqual(storage.getItem('tfc-history:child-1'), null);
  assert.equal(storage.getItem('tfc-history'), null);
  assert.equal(storage.getItem('tfc-period-anchor:child-1'), '11');
  assert.equal(storage.getItem('tfc-leftover:child-1'), '5000');
  assert.equal(storage.getItem('tfc-input-mode:child-1'), 'monthly');
});

test('addChild appends and switches to the new child', () => {
  const store = new ChildStore(memoryStorage());
  const added = store.addChild('Ada');
  const { children, activeChildId } = store.load();
  assert.equal(children.length, 2);
  assert.equal(children[1].name, 'Ada');
  assert.equal(activeChildId, added.id);
});

test('addChild falls back to a generated name', () => {
  const store = new ChildStore(memoryStorage());
  const added = store.addChild('   ');
  assert.equal(added.name, 'Child 2');
});

test('renameChild updates the name and rejects empties and unknown ids', () => {
  const store = new ChildStore(memoryStorage());
  store.renameChild('child-1', 'Bo');
  assert.equal(store.getActiveChild().name, 'Bo');
  assert.throws(() => store.renameChild('child-1', '  '));
  assert.throws(() => store.renameChild('nope', 'X'));
});

test('removeChild keeps at least one child and cleans up data keys', () => {
  const storage = memoryStorage();
  const store = new ChildStore(storage);
  assert.throws(() => store.removeChild('child-1')); // only child

  const added = store.addChild('Ada');
  storage.setItem(`tfc-history:${added.id}`, '{}');
  const nextActive = store.removeChild(added.id);
  assert.equal(nextActive, 'child-1');
  assert.equal(store.load().children.length, 1);
  assert.equal(storage.getItem(`tfc-history:${added.id}`), null);

  assert.throws(() => store.removeChild('nope'));
});

test('removeChild of the active child falls back to the first remaining', () => {
  const store = new ChildStore(memoryStorage());
  const added = store.addChild('Ada');
  const nextActive = store.removeChild('child-1');
  assert.equal(nextActive, added.id);
  assert.equal(store.getActiveChild().id, added.id);
});

test('setActiveChild rejects unknown ids', () => {
  const store = new ChildStore(memoryStorage());
  assert.throws(() => store.setActiveChild('nope'));
});

test('ensureChild returns existing children and registers new ones', () => {
  const store = new ChildStore(memoryStorage());
  const existing = store.ensureChild({ id: 'child-1', name: 'Ignored' });
  assert.deepEqual(existing, { child: { id: 'child-1', name: 'Child 1' }, created: false });

  const created = store.ensureChild({ id: 'from-file', name: 'Imported Kid' });
  assert.equal(created.created, true);
  assert.equal(created.child.id, 'from-file');
  assert.equal(store.load().children.length, 2);
});

test('exportChildKey exposes the per-child history key', () => {
  const store = new ChildStore(memoryStorage());
  assert.equal(store.exportChildKey('child-1'), 'tfc-history:child-1');
});
