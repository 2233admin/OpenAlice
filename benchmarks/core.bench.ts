import { bench, describe } from 'vitest'

import { parseDuration } from '@/core/duration.js'
import { compareVersions, getRepoSlug } from '@/core/version.js'
import { inferCredentialVendor, resolveAnthropicAuthMode } from '@/core/credential-inference.js'

// These benchmarks cover small, pure, hot-path helpers used across the
// scheduling, version-awareness and credential-inference code paths. They are
// CPU-bound and deterministic, which makes them a good fit for CodSpeed's
// simulation instrument.

describe('parseDuration', () => {
  const inputs = ['30m', '1h', '5m30s', '2h15m', '1h30m45s', '  90s  ', 'not-a-duration', '']

  bench('parse a mix of valid and invalid durations', () => {
    for (const input of inputs) {
      parseDuration(input)
    }
  })
})

describe('compareVersions', () => {
  const pairs: Array<[string, string]> = [
    ['1.2.3', '1.2.4'],
    ['2.0.0', '1.9.9'],
    ['1.0.0-beta.1', '1.0.0'],
    ['0.50.0-beta.1', '0.50.0-beta.2'],
    ['v3.4.5', '3.4.5'],
    ['10.0.0', '9.99.99'],
  ]

  bench('compare a batch of semver pairs', () => {
    for (const [a, b] of pairs) {
      compareVersions(a, b)
    }
  })
})

describe('getRepoSlug', () => {
  bench('derive repo slug from package.json repository url', () => {
    getRepoSlug()
  })
})

describe('credential inference', () => {
  const cases = [
    { agent: 'claude', baseUrl: 'https://api.z.ai/v1' },
    { agent: 'codex', baseUrl: 'https://api.minimaxi.com' },
    { agent: 'opencode', baseUrl: 'https://api.moonshot.cn' },
    { agent: 'pi', baseUrl: 'https://example.com/v1' },
    { agent: 'claude', baseUrl: 'https://api.deepseek.com' },
  ]

  bench('infer vendor + anthropic auth mode for a batch of configs', () => {
    for (const c of cases) {
      inferCredentialVendor(c)
      resolveAnthropicAuthMode({ baseUrl: c.baseUrl })
    }
  })
})
