import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'
import codspeedPlugin from '@codspeed/vitest-plugin'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Mirror the workspace aliases from vitest.config.ts so benchmarks can import
// directly from `src/*` and the workspace packages' `src/*` entry points
// without a prior `dist/` build.
const workspaceAliases = {
  '@': resolve(__dirname, './src'),
  '@traderalice/ibkr': resolve(__dirname, './packages/ibkr/src/index.ts'),
  '@traderalice/opentypebb/server': resolve(__dirname, './packages/opentypebb/src/server.ts'),
  '@traderalice/opentypebb': resolve(__dirname, './packages/opentypebb/src/index.ts'),
  '@traderalice/uta-protocol': resolve(__dirname, './packages/uta-protocol/src/index.ts'),
}

export default defineConfig({
  plugins: [codspeedPlugin()],
  resolve: {
    alias: workspaceAliases,
  },
  test: {
    environment: 'node',
    include: ['benchmarks/**/*.bench.ts'],
  },
})
