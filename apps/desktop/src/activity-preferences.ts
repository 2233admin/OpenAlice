import { readFileSync, statSync } from 'node:fs'
import { writeFile, rename } from 'node:fs/promises'
import { z } from 'zod'
import { DEFAULT_ACTIVITY_PREFERENCES, type ActivityPreferences } from './activity-policy.js'
const decision = z.enum(['show', 'hide']).optional()
export const preferencesSchema = z.object({
  version: z.literal(1), defaultsVersion: z.number().int().min(0).max(1), enabled: z.boolean(),
  preset: z.enum(['action', 'important', 'all']),
  overrides: z.object({ completion: decision, failure: decision, action: decision, news: decision, progress: decision }).strict(),
  main: z.boolean(), pet: z.boolean(), brief: z.boolean(), pausedUntil: z.number().finite().nonnegative().max(8.64e15),
}).strict()
/** Versioned defaults are policy references, never materialized event values. Explicit overrides always win. */
export function migrateActivityPreferences(input: unknown): ActivityPreferences {
  return { ...preferencesSchema.parse(input), defaultsVersion: DEFAULT_ACTIVITY_PREFERENCES.defaultsVersion }
}
export function createActivityPreferenceStore(path: string) {
  let current = structuredClone(DEFAULT_ACTIVITY_PREFERENCES)
  try { if (statSync(path).size < 16_384) current = migrateActivityPreferences(JSON.parse(readFileSync(path, 'utf8'))) } catch { /* Invalid disk state: official defaults. */ }
  let queue = Promise.resolve()
  const persist = async (value: ActivityPreferences) => {
    await writeFile(path + '.tmp', JSON.stringify(value), { mode: 0o600 })
    await rename(path + '.tmp', path)
    current = value
    return structuredClone(current)
  }
  const enqueue = (fn: () => Promise<ActivityPreferences>) => { const next = queue.then(fn); queue = next.then(() => {}, () => {}); return next }
  return {
    get: () => structuredClone(current),
    update(input: unknown) {
      const patch = preferencesSchema.omit({ version: true, defaultsVersion: true }).partial().parse(input)
      return enqueue(() => persist(preferencesSchema.parse({ ...current, ...patch })))
    },
    reset: () => enqueue(() => persist(structuredClone(DEFAULT_ACTIVITY_PREFERENCES))),
  }
}
