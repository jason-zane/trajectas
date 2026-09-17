import { describe, expect, it, afterEach } from 'vitest'
import {
  PUBLIC_BUILDS_TIERS,
  PUBLIC_BUILDS_ITEMS_PER_FACTOR,
  getPublicBuildsMode,
  getPublicBuildsDailyCap,
} from '@/lib/public-builds/constants'

describe('public-builds constants', () => {
  const original = {
    mode: process.env.PUBLIC_BUILDS_MODE,
    cap: process.env.PUBLIC_BUILDS_DAILY_CAP,
  }

  afterEach(() => {
    process.env.PUBLIC_BUILDS_MODE = original.mode
    process.env.PUBLIC_BUILDS_DAILY_CAP = original.cap
  })

  it('fixes items per capability at 6', () => {
    expect(PUBLIC_BUILDS_ITEMS_PER_FACTOR).toBe(6)
  })

  it('sizes tiers at 4 / 6 / 8 capabilities', () => {
    expect(PUBLIC_BUILDS_TIERS.essentials.capabilities).toBe(4)
    expect(PUBLIC_BUILDS_TIERS.core.capabilities).toBe(6)
    expect(PUBLIC_BUILDS_TIERS.full.capabilities).toBe(8)
  })

  it('defaults to off when PUBLIC_BUILDS_MODE is unset or invalid', () => {
    delete process.env.PUBLIC_BUILDS_MODE
    expect(getPublicBuildsMode()).toBe('off')
    process.env.PUBLIC_BUILDS_MODE = 'not-a-real-mode'
    expect(getPublicBuildsMode()).toBe('off')
  })

  it('accepts closed and open modes', () => {
    process.env.PUBLIC_BUILDS_MODE = 'closed'
    expect(getPublicBuildsMode()).toBe('closed')
    process.env.PUBLIC_BUILDS_MODE = 'open'
    expect(getPublicBuildsMode()).toBe('open')
  })

  it('defaults the daily cap to 100 when unset or invalid', () => {
    delete process.env.PUBLIC_BUILDS_DAILY_CAP
    expect(getPublicBuildsDailyCap()).toBe(100)
    process.env.PUBLIC_BUILDS_DAILY_CAP = '0'
    expect(getPublicBuildsDailyCap()).toBe(100)
    process.env.PUBLIC_BUILDS_DAILY_CAP = 'not-a-number'
    expect(getPublicBuildsDailyCap()).toBe(100)
  })

  it('reads a configured daily cap', () => {
    process.env.PUBLIC_BUILDS_DAILY_CAP = '250'
    expect(getPublicBuildsDailyCap()).toBe(250)
  })
})
