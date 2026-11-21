const CHILDREN_KEY = 'tfc-children';

function defaultStorage() {
  return window.localStorage;
}

function childStorageKey(childId) {
  return `tfc-history:${childId}`;
}

function isValidChildrenBlob(parsed) {
  return Boolean(parsed)
    && typeof parsed === 'object'
    && Array.isArray(parsed.children)
    && parsed.children.length > 0
    && parsed.children.every(child => child && typeof child.id === 'string' && typeof child.name === 'string')
    && typeof parsed.activeChildId === 'string';
}

// Tracks the children sharing this browser and which one is active.
// Each child's history and preferences live in their own storage keys
// (`tfc-history:<id>`, `tfc-period-anchor:<id>`, ...) so the existing
// stores keep working unchanged. A browser with pre-children data is
// migrated into a single "Child 1" on first load.
export class ChildStore {
  constructor(storage = defaultStorage()) {
    this.storage = storage;
  }

  load() {
    let blob;
    try {
      const raw = this.storage.getItem(CHILDREN_KEY);
      blob = raw ? JSON.parse(raw) : null;
    } catch {
      blob = null;
    }
    if (isValidChildrenBlob(blob)) {
      return { children: blob.children, activeChildId: blob.activeChildId };
    }
    return this.migrateLegacyData();
  }

  // Single-child era: everything lived in unversioned keys.
  migrateLegacyData() {
    const children = [{ id: 'child-1', name: 'Child 1' }];
    const activeChildId = 'child-1';
    this.save(children, activeChildId);

    const legacyMoves = {
      'tfc-history': childStorageKey(activeChildId),
      'tfc-period-anchor': `tfc-period-anchor:${activeChildId}`,
      'tfc-leftover': `tfc-leftover:${activeChildId}`,
      'tfc-input-mode': `tfc-input-mode:${activeChildId}`
    };
    for (const [from, to] of Object.entries(legacyMoves)) {
      const value = this.storage.getItem(from);
      if (value !== null) {
        this.storage.setItem(to, value);
        this.storage.removeItem(from);
      }
    }
    return { children, activeChildId };
  }

  save(children, activeChildId) {
    this.storage.setItem(CHILDREN_KEY, JSON.stringify({ children, activeChildId }));
  }

  persist(children, activeChildId) {
    this.save(children, activeChildId);
    return { children, activeChildId };
  }

  getActiveChild() {
    const { children, activeChildId } = this.load();
    return children.find(child => child.id === activeChildId) || children[0];
  }

  setActiveChild(id) {
    const { children } = this.load();
    if (!children.some(child => child.id === id)) {
      throw new Error(`Unknown child: ${id}`);
    }
    this.persist(children, id);
  }

  addChild(name) {
    const trimmed = typeof name === 'string' ? name.trim() : '';
    const { children } = this.load();
    const child = { id: `child-${Date.now()}`, name: trimmed || `Child ${children.length + 1}` };
    this.persist([...children, child], child.id); // switch to the new child
    return child;
  }

  renameChild(id, name) {
    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (!trimmed) {
      throw new Error('Child name cannot be empty');
    }
    const { children, activeChildId } = this.load();
    const child = children.find(c => c.id === id);
    if (!child) {
      throw new Error(`Unknown child: ${id}`);
    }
    this.persist(children.map(c => (c.id === id ? { ...c, name: trimmed } : c)), activeChildId);
  }

  removeChild(id) {
    const { children, activeChildId } = this.load();
    if (children.length <= 1) {
      throw new Error('At least one child must remain');
    }
    if (!children.some(child => child.id === id)) {
      throw new Error(`Unknown child: ${id}`);
    }
    const remaining = children.filter(child => child.id !== id);
    const nextActive = activeChildId === id ? remaining[0].id : activeChildId;
    this.persist(remaining, nextActive);
    // Clear the removed child's data keys
    for (const key of [childStorageKey(id), `tfc-period-anchor:${id}`, `tfc-leftover:${id}`, `tfc-input-mode:${id}`]) {
      this.storage.removeItem(key);
    }
    return nextActive;
  }

  // Import support: return the existing child with that id, or register
  // a new one from the imported data (collision-free id).
  ensureChild(imported) {
    const { children, activeChildId } = this.load();
    const existing = children.find(child => child.id === imported.id);
    if (existing) {
      return { child: existing, created: false };
    }
    let id = imported.id && typeof imported.id === 'string' ? imported.id : `child-${Date.now()}`;
    while (children.some(child => child.id === id)) {
      id = `child-${Date.now()}`;
    }
    const child = { id, name: typeof imported.name === 'string' && imported.name.trim() ? imported.name.trim() : 'Child' };
    this.persist([...children, child], activeChildId);
    return { child, created: true };
  }

  exportChildKey(childId) {
    return childStorageKey(childId);
  }
}
