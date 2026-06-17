import { defineConfig } from 'vitest/config'

// Node env + a localStorage shim (setup file). jsdom's localStorage is null
// under the default opaque origin, which breaks zustand's persist middleware;
// shimming in node sidesteps the origin quirk entirely.
export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
  },
})
