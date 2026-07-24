import { describe, expect, it } from 'vitest'

import {
  GOOGLE_GENERATIVE_AI_BASE,
  LEGACY_GOOGLE_OPENAI_BASE,
  migrateGoogleNativeCredentials,
} from './0023_google_native_credentials/index.js'

describe('0023 Google native credentials', () => {
  it('rewrites only the old built-in Google OpenAI wire', () => {
    const raw = {
      profiles: { default: { backend: 'agent-sdk' } },
      credentials: {
        'google-1': {
          vendor: 'google',
          authType: 'api-key',
          apiKey: 'secret',
          lastModel: 'gemini-account-choice',
          wires: { 'openai-chat': LEGACY_GOOGLE_OPENAI_BASE },
        },
        'google-gateway': {
          vendor: 'google',
          authType: 'api-key',
          wires: { 'openai-chat': 'https://gateway.example/v1' },
        },
        'openai-1': {
          vendor: 'openai',
          authType: 'api-key',
          wires: { 'openai-chat': LEGACY_GOOGLE_OPENAI_BASE },
        },
      },
    }

    const result = migrateGoogleNativeCredentials(raw)
    expect(result.updated).toBe(true)
    expect(result.value).toEqual({
      ...raw,
      credentials: {
        ...raw.credentials,
        'google-1': {
          ...raw.credentials['google-1'],
          wires: { 'google-generative-ai': GOOGLE_GENERATIVE_AI_BASE },
        },
      },
    })
  })

  it('upgrades the legacy flat endpoint shape', () => {
    const result = migrateGoogleNativeCredentials({
      credentials: {
        gemini: {
          vendor: 'google',
          authType: 'api-key',
          baseUrl: LEGACY_GOOGLE_OPENAI_BASE,
          wireShape: 'openai-chat',
        },
      },
    })
    expect(result).toEqual({
      updated: true,
      value: {
        credentials: {
          gemini: {
            vendor: 'google',
            authType: 'api-key',
            wires: { 'google-generative-ai': GOOGLE_GENERATIVE_AI_BASE },
          },
        },
      },
    })
  })

  it('is idempotent after migration', () => {
    const native = {
      credentials: {
        gemini: {
          vendor: 'google',
          authType: 'api-key',
          wires: { 'google-generative-ai': GOOGLE_GENERATIVE_AI_BASE },
        },
      },
    }
    expect(migrateGoogleNativeCredentials(native)).toEqual({ value: native, updated: false })
  })
})
