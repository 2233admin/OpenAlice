/**
 * Move saved Google credentials off the OpenAI compatibility endpoint.
 *
 * Google AI Studio now creates `AQ.` authorization keys by default. They must
 * use Google's native `x-goog-api-key` authentication and are not reliably
 * accepted as Bearer tokens by the OpenAI compatibility endpoint. Only the
 * exact old built-in endpoint is rewritten; user-authored custom gateways stay
 * untouched.
 */

import type { Migration } from '../types.js'

export const LEGACY_GOOGLE_OPENAI_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai/'
export const GOOGLE_GENERATIVE_AI_BASE = 'https://generativelanguage.googleapis.com/v1beta'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function migrateCredential(value: unknown): { value: unknown; updated: boolean } {
  if (!isRecord(value) || value['vendor'] !== 'google') return { value, updated: false }

  if (isRecord(value['wires'])) {
    const wires = value['wires']
    if (wires['openai-chat'] !== LEGACY_GOOGLE_OPENAI_BASE) return { value, updated: false }
    const nextWires = { ...wires }
    delete nextWires['openai-chat']
    if (!('google-generative-ai' in nextWires)) {
      nextWires['google-generative-ai'] = GOOGLE_GENERATIVE_AI_BASE
    }
    return { value: { ...value, wires: nextWires }, updated: true }
  }

  if (value['wireShape'] === 'openai-chat' && value['baseUrl'] === LEGACY_GOOGLE_OPENAI_BASE) {
    const { baseUrl: _baseUrl, wireShape: _wireShape, ...rest } = value
    return {
      value: {
        ...rest,
        wires: { 'google-generative-ai': GOOGLE_GENERATIVE_AI_BASE },
      },
      updated: true,
    }
  }

  return { value, updated: false }
}

export function migrateGoogleNativeCredentials(raw: unknown): { value: unknown; updated: boolean } {
  if (!isRecord(raw) || !isRecord(raw['credentials'])) return { value: raw, updated: false }
  let updated = false
  const credentials = Object.fromEntries(Object.entries(raw['credentials']).map(([slug, credential]) => {
    const migrated = migrateCredential(credential)
    updated ||= migrated.updated
    return [slug, migrated.value]
  }))
  return updated
    ? { value: { ...raw, credentials }, updated: true }
    : { value: raw, updated: false }
}

export const migration: Migration = {
  id: '0023_google_native_credentials',
  appVersion: '0.81.0-beta',
  introducedAt: '2026-07-16',
  affects: ['ai-provider-manager.json'],
  summary: 'Route saved Google Gemini credentials through the native API so current AQ authorization keys work.',
  rationale: 'Google AI Studio now issues AQ authorization keys that require x-goog-api-key instead of OpenAI-compatible Bearer authentication.',
  up: async (ctx) => {
    const raw = await ctx.readJson('ai-provider-manager.json')
    if (raw === undefined) return
    const result = migrateGoogleNativeCredentials(raw)
    if (result.updated) await ctx.writeJson('ai-provider-manager.json', result.value)
  },
}
