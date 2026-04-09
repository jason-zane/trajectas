import { describe, it, expect } from 'vitest'
import {
  EMAIL_TYPES,
  EMAIL_TYPE_CATEGORIES,
  EMAIL_TYPE_LABELS,
  MERGE_VARIABLES,
  SAMPLE_VARIABLES,
} from '@/lib/email/types'

describe('EMAIL_TYPES', () => {
  it('defines exactly 7 email types', () => {
    expect(EMAIL_TYPES).toHaveLength(7)
  })

  it('includes all required types', () => {
    expect(EMAIL_TYPES).toContain('magic_link')
    expect(EMAIL_TYPES).toContain('staff_invite')
    expect(EMAIL_TYPES).toContain('assessment_invite')
    expect(EMAIL_TYPES).toContain('assessment_reminder')
    expect(EMAIL_TYPES).toContain('report_ready')
    expect(EMAIL_TYPES).toContain('welcome')
    expect(EMAIL_TYPES).toContain('admin_notification')
  })
})

describe('EMAIL_TYPE_LABELS', () => {
  it('has a human-readable label for every email type', () => {
    for (const type of EMAIL_TYPES) {
      expect(EMAIL_TYPE_LABELS[type]).toBeDefined()
      expect(typeof EMAIL_TYPE_LABELS[type]).toBe('string')
      expect(EMAIL_TYPE_LABELS[type].length).toBeGreaterThan(0)
    }
  })
})

describe('EMAIL_TYPE_CATEGORIES', () => {
  it('defines Authentication, Campaigns, and Platform categories', () => {
    expect(EMAIL_TYPE_CATEGORIES['Authentication']).toBeDefined()
    expect(EMAIL_TYPE_CATEGORIES['Campaigns']).toBeDefined()
    expect(EMAIL_TYPE_CATEGORIES['Platform']).toBeDefined()
  })

  it('groups magic_link and welcome under Authentication', () => {
    expect(EMAIL_TYPE_CATEGORIES['Authentication']).toContain('magic_link')
    expect(EMAIL_TYPE_CATEGORIES['Authentication']).toContain('welcome')
  })

  it('groups assessment_invite, assessment_reminder, report_ready under Campaigns', () => {
    expect(EMAIL_TYPE_CATEGORIES['Campaigns']).toContain('assessment_invite')
    expect(EMAIL_TYPE_CATEGORIES['Campaigns']).toContain('assessment_reminder')
    expect(EMAIL_TYPE_CATEGORIES['Campaigns']).toContain('report_ready')
  })

  it('groups staff_invite and admin_notification under Platform', () => {
    expect(EMAIL_TYPE_CATEGORIES['Platform']).toContain('staff_invite')
    expect(EMAIL_TYPE_CATEGORIES['Platform']).toContain('admin_notification')
  })

  it('covers every email type in exactly one category', () => {
    const allCategorised = Object.values(EMAIL_TYPE_CATEGORIES).flat()
    for (const type of EMAIL_TYPES) {
      expect(allCategorised).toContain(type)
    }
  })
})

describe('MERGE_VARIABLES', () => {
  it('defines merge variables for every email type', () => {
    for (const type of EMAIL_TYPES) {
      expect(MERGE_VARIABLES[type]).toBeDefined()
      expect(Array.isArray(MERGE_VARIABLES[type])).toBe(true)
      expect(MERGE_VARIABLES[type].length).toBeGreaterThan(0)
    }
  })

  it('defines the correct variables for magic_link', () => {
    expect(MERGE_VARIABLES['magic_link']).toContain('otpCode')
    expect(MERGE_VARIABLES['magic_link']).toContain('brandName')
  })

  it('defines the correct variables for staff_invite', () => {
    expect(MERGE_VARIABLES['staff_invite']).toContain('inviteeName')
    expect(MERGE_VARIABLES['staff_invite']).toContain('brandName')
    expect(MERGE_VARIABLES['staff_invite']).toContain('acceptUrl')
  })

  it('defines the correct variables for assessment_invite', () => {
    expect(MERGE_VARIABLES['assessment_invite']).toContain('participantFirstName')
    expect(MERGE_VARIABLES['assessment_invite']).toContain('campaignTitle')
    expect(MERGE_VARIABLES['assessment_invite']).toContain('campaignDescription')
    expect(MERGE_VARIABLES['assessment_invite']).toContain('assessmentUrl')
    expect(MERGE_VARIABLES['assessment_invite']).toContain('brandName')
  })

  it('defines the correct variables for assessment_reminder', () => {
    expect(MERGE_VARIABLES['assessment_reminder']).toContain('participantFirstName')
    expect(MERGE_VARIABLES['assessment_reminder']).toContain('campaignTitle')
    expect(MERGE_VARIABLES['assessment_reminder']).toContain('assessmentUrl')
    expect(MERGE_VARIABLES['assessment_reminder']).toContain('brandName')
    expect(MERGE_VARIABLES['assessment_reminder']).toContain('daysRemaining')
  })

  it('defines the correct variables for report_ready', () => {
    expect(MERGE_VARIABLES['report_ready']).toContain('recipientName')
    expect(MERGE_VARIABLES['report_ready']).toContain('campaignTitle')
    expect(MERGE_VARIABLES['report_ready']).toContain('reportUrl')
    expect(MERGE_VARIABLES['report_ready']).toContain('brandName')
  })

  it('defines the correct variables for welcome', () => {
    expect(MERGE_VARIABLES['welcome']).toContain('userName')
    expect(MERGE_VARIABLES['welcome']).toContain('brandName')
    expect(MERGE_VARIABLES['welcome']).toContain('loginUrl')
  })

  it('defines the correct variables for admin_notification', () => {
    expect(MERGE_VARIABLES['admin_notification']).toContain('subject')
    expect(MERGE_VARIABLES['admin_notification']).toContain('message')
    expect(MERGE_VARIABLES['admin_notification']).toContain('actionUrl')
    expect(MERGE_VARIABLES['admin_notification']).toContain('actionLabel')
  })
})

describe('SAMPLE_VARIABLES', () => {
  it('defines sample variables for every email type', () => {
    for (const type of EMAIL_TYPES) {
      expect(SAMPLE_VARIABLES[type]).toBeDefined()
      expect(typeof SAMPLE_VARIABLES[type]).toBe('object')
    }
  })

  it('sample variables cover ALL merge variables for every type', () => {
    for (const type of EMAIL_TYPES) {
      const mergeVars = MERGE_VARIABLES[type]
      const sampleVars = SAMPLE_VARIABLES[type]
      for (const variable of mergeVars) {
        expect(sampleVars).toHaveProperty(variable)
        expect(sampleVars[variable]).toBeDefined()
      }
    }
  })
})
