import { describe, expect, it } from 'vitest'

import { demoCredentialPresets } from './configKeys'

function modelIds(presetId: string): string[] {
  const preset = demoCredentialPresets.find((candidate) => candidate.id === presetId)
  const model = preset?.schema.properties.model as {
    default?: string
    oneOf?: Array<{ const: string }>
  } | undefined
  return model?.oneOf?.map((option) => option.const) ?? []
}

describe('demo credential catalog', () => {
  it('covers the current OpenAI and Anthropic forms instead of falling back to Custom', () => {
    expect(modelIds('codex-api')).toEqual([
      'gpt-5.6',
      'gpt-5.6-terra',
      'gpt-5.6-luna',
      'gpt-5.5',
      'gpt-5.4',
    ])
    expect(modelIds('claude-api')).toEqual([
      'claude-fable-5',
      'claude-opus-4-8',
      'claude-sonnet-5',
      'claude-haiku-4-5',
      'claude-sonnet-4-6',
    ])
  })
})
