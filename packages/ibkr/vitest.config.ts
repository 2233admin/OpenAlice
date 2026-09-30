import { fileURLToPath } from 'node:url'
import { collectionWideTestInputs } from '../../scripts/test-collection-inputs.mjs'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    forceRerunTriggers: collectionWideTestInputs(fileURLToPath(new URL('../../', import.meta.url))),
    include: ['tests/**/*.spec.ts'],
    exclude: ['tests/**/*.e2e.spec.ts'],
  },
})
