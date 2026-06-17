// Minimal localStorage shim for the node test environment. zustand's persist
// middleware (used by the workspace store) calls getItem on creation and
// setItem on every setState; node has no localStorage, so provide one.
const store = new Map<string, string>()
const shim: Storage = {
  getItem: (k) => (store.has(k) ? store.get(k)! : null),
  setItem: (k, v) => void store.set(k, String(v)),
  removeItem: (k) => void store.delete(k),
  clear: () => store.clear(),
  key: (i) => Array.from(store.keys())[i] ?? null,
  get length() {
    return store.size
  },
}
globalThis.localStorage = shim
