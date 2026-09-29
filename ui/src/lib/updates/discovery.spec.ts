import { expect, it } from 'vitest'
import { isReleaseUpdate } from './discovery'
it('isolates stable and beta and handles numeric beta progression', () => {
  expect(
    isReleaseUpdate(
      { channel: 'stable', version: '0.94.1' },
      { channel: 'beta', version: '0.94.2-beta.1' },
      'stable',
    ),
  ).toBe(false)
  expect(
    isReleaseUpdate(
      { channel: 'beta', version: '0.94.2-beta.2' },
      { channel: 'beta', version: '0.94.2-beta.10' },
      'beta',
    ),
  ).toBe(true)
  expect(
    isReleaseUpdate(
      { channel: 'stable', version: '0.94.2' },
      { channel: 'beta', version: '0.94.2-beta.10' },
      'beta',
    ),
  ).toBe(false)
})
it('compares dev commit identities even when package versions are unchanged', () => {
  const current = {
    channel: 'dev' as const,
    version: '0.94.1',
    commit: 'fffffff',
  }
  expect(
    isReleaseUpdate(current, { ...current, commit: '0000001' }, 'dev'),
  ).toBe(true)
  expect(isReleaseUpdate(current, current, 'dev')).toBe(false)
  expect(
    isReleaseUpdate(current, { ...current, commit: undefined }, 'dev'),
  ).toBe(false)
})
