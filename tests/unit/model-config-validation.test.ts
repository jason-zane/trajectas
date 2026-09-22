import { describe, expect, it } from 'vitest'
import { isJevModelId } from '@/lib/ai/model-ids'
import {
  applyModelToAllPurposesSchema,
  updateModelForPurposeSchema,
} from '@/lib/validations/model-config'

describe('isJevModelId', () => {
  it('is true for a typesafe/ id', () => {
    expect(isJevModelId('typesafe/jev-1.13')).toBe(true)
  })

  it('is true for a ~typesafe/ id', () => {
    expect(isJevModelId('~typesafe/jev-1.13')).toBe(true)
  })

  it('is false for a non-decision model id', () => {
    expect(isJevModelId('anthropic/claude-sonnet-4-5')).toBe(false)
  })

  it('is false for an empty string', () => {
    expect(isJevModelId('')).toBe(false)
  })
})

describe('updateModelForPurposeSchema', () => {
  it('accepts a Jev id for competency_matching', () => {
    const result = updateModelForPurposeSchema.safeParse({
      purpose: 'competency_matching',
      modelId: 'typesafe/jev-1.13',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a Jev id for any other purpose', () => {
    const result = updateModelForPurposeSchema.safeParse({
      purpose: 'brief_extraction',
      modelId: 'typesafe/jev-1.13',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        'Decision models can only be used for competency matching.',
      )
    }
  })

  it('accepts a non-Jev id for any purpose', () => {
    const result = updateModelForPurposeSchema.safeParse({
      purpose: 'brief_extraction',
      modelId: 'anthropic/claude-sonnet-4-5',
    })
    expect(result.success).toBe(true)
  })
})

describe('applyModelToAllPurposesSchema', () => {
  it('rejects a Jev id', () => {
    const result = applyModelToAllPurposesSchema.safeParse({
      modelId: 'typesafe/jev-1.13',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        'Decision models cannot be applied to all purposes.',
      )
    }
  })

  it('accepts a non-Jev id', () => {
    const result = applyModelToAllPurposesSchema.safeParse({
      modelId: 'anthropic/claude-sonnet-4-5',
    })
    expect(result.success).toBe(true)
  })
})
