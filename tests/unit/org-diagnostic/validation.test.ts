import { describe, it, expect } from 'vitest'
import {
  validateTrackInstrumentForCampaignKind,
  validateRespondentTypeMatchesTrack,
  validateRolePinTarget,
  validateRoleRepCampaignTrackCount,
} from '@/lib/org-diagnostic/validation'

describe('validateTrackInstrumentForCampaignKind', () => {
  it('allows OPS in a baseline campaign', () => {
    expect(validateTrackInstrumentForCampaignKind('baseline', 'OPS')).toEqual({ ok: true })
  })

  it('allows LCQ in a baseline campaign', () => {
    expect(validateTrackInstrumentForCampaignKind('baseline', 'LCQ')).toEqual({ ok: true })
  })

  it('rejects REP in a baseline campaign', () => {
    const result = validateTrackInstrumentForCampaignKind('baseline', 'REP')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/baseline/i)
      expect(result.error).toMatch(/REP/)
    }
  })

  it('allows REP in a role_rep campaign', () => {
    expect(validateTrackInstrumentForCampaignKind('role_rep', 'REP')).toEqual({ ok: true })
  })

  it('rejects OPS in a role_rep campaign', () => {
    const result = validateTrackInstrumentForCampaignKind('role_rep', 'OPS')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/role_rep/i)
      expect(result.error).toMatch(/OPS/)
    }
  })

  it('rejects LCQ in a role_rep campaign', () => {
    const result = validateTrackInstrumentForCampaignKind('role_rep', 'LCQ')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/role_rep/i)
      expect(result.error).toMatch(/LCQ/)
    }
  })
})

describe('validateRespondentTypeMatchesTrack', () => {
  it('allows employee on OPS track', () => {
    expect(validateRespondentTypeMatchesTrack('employee', 'OPS')).toEqual({ ok: true })
  })

  it('allows senior_leader on LCQ track', () => {
    expect(validateRespondentTypeMatchesTrack('senior_leader', 'LCQ')).toEqual({ ok: true })
  })

  it('allows hiring_manager on REP track', () => {
    expect(validateRespondentTypeMatchesTrack('hiring_manager', 'REP')).toEqual({ ok: true })
  })

  it('allows team_member on REP track', () => {
    expect(validateRespondentTypeMatchesTrack('team_member', 'REP')).toEqual({ ok: true })
  })

  it('rejects employee on LCQ track', () => {
    const result = validateRespondentTypeMatchesTrack('employee', 'LCQ')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/employee.*OPS/i)
  })

  it('rejects senior_leader on OPS track', () => {
    const result = validateRespondentTypeMatchesTrack('senior_leader', 'OPS')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/senior_leader.*LCQ/i)
  })

  it('rejects hiring_manager on OPS track', () => {
    const result = validateRespondentTypeMatchesTrack('hiring_manager', 'OPS')
    expect(result.ok).toBe(false)
  })
})

describe('validateRolePinTarget', () => {
  it('allows pin when client matches and snapshot is baseline', () => {
    expect(
      validateRolePinTarget(
        { clientId: 'c1', kind: 'baseline' },
        { clientId: 'c1' },
      ),
    ).toEqual({ ok: true })
  })

  it('rejects pin when snapshot belongs to a different client', () => {
    const result = validateRolePinTarget(
      { clientId: 'c2', kind: 'baseline' },
      { clientId: 'c1' },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/client/i)
  })

  it('rejects pin to a role-kind snapshot', () => {
    const result = validateRolePinTarget(
      { clientId: 'c1', kind: 'role' },
      { clientId: 'c1' },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/baseline/i)
  })
})

describe('validateRoleRepCampaignTrackCount', () => {
  it('allows exactly one track', () => {
    expect(validateRoleRepCampaignTrackCount(1)).toEqual({ ok: true })
  })

  it('rejects zero tracks', () => {
    const result = validateRoleRepCampaignTrackCount(0)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/exactly one/i)
  })

  it('rejects more than one track', () => {
    const result = validateRoleRepCampaignTrackCount(2)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/exactly one/i)
  })
})
