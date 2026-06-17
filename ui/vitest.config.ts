/**
 * Vitest config for the UI package.
 *
 * Scope: pure-function specs colocated with the source file (e.g.
 * `src/live/activity-bar-top-order.test.ts`). These specs MUST NOT
 * pull in jsdom, React, or DOM globals -- they're fast, dependency-
 * free unit tests of helper logic. Any future spec that needs jsdom
 * (drag-and-drop integration, click handlers) should live in a
 * sibling file with a per-file `@vitest-environment jsdom` directive
 * rather than flipping this global config.
 *
 * Why a dedicated config (and not `vitest run` in the root script):
 * the root monorepo's `pnpm test` runs `tests/` (Node-side) and
 * reports pre-existing failures unrelated to this work. A scoped
 * config here keeps the UI tests isolated -- `pnpm -F open-alice-ui
 * test` runs only this config's include glob, no spillover.
 */
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // Keep it tight: pure-function tests, no setup/teardown.
    setupFiles: [],
    css: false,
    pool: 'threads',
    reporters: ['default'],
    dangerouslyIgnoreUnhandledErrors: false,
  },
})
