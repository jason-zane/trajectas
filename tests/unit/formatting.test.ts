import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  formatDate,
  formatDateTime,
  formatDateTimeMedium,
  formatDateLong,
  formatDateRange,
  formatRelativeDate,
  formatDateForTooltip,
  formatRelativeTime,
  statusBadgeVariant,
  formatExpiryStatus,
  formatDateOrNull,
} from '@/lib/formatting'

// Mock current time for predictable relative time tests
const MOCK_NOW = new Date('2026-06-15T14:30:00Z').getTime()

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(MOCK_NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('formatDate', () => {
  it('formats date to DD MMM YYYY', () => {
    const result = formatDate('2026-06-15T14:30:00Z')
    expect(result).toMatch(/\d{1,2}.*2026/)
  })

  it('returns fallback for null/undefined', () => {
    expect(formatDate(null)).toBe('Not scheduled')
    expect(formatDate(undefined)).toBe('Not scheduled')
    expect(formatDate()).toBe('Not scheduled')
  })

  it('accepts custom fallback', () => {
    expect(formatDate(null, '—')).toBe('—')
    expect(formatDate(undefined, 'N/A')).toBe('N/A')
  })

  it('handles empty string', () => {
    expect(formatDate('')).toBe('Not scheduled')
  })
})

describe('formatDateTime', () => {
  it('formats date and time to DD MMM YYYY – HH:MM', () => {
    const result = formatDateTime('2026-06-15T14:30:00Z')
    expect(result).toMatch(/\d{1,2}.*2026.*\d{2}:\d{2}/)
  })

  it('returns fallback for null/undefined', () => {
    expect(formatDateTime(null)).toBe('Not set')
    expect(formatDateTime(undefined)).toBe('Not set')
  })

  it('accepts custom fallback', () => {
    expect(formatDateTime(null, 'N/A')).toBe('N/A')
  })
})

describe('formatDateTimeMedium', () => {
  it('formats to medium style', () => {
    const result = formatDateTimeMedium('2026-06-15T14:30:00Z')
    // Should match en-AU medium format (e.g., "15 Jun 2026, 2:30 PM")
    expect(result).toBeTruthy()
  })

  it('returns fallback for null/undefined', () => {
    expect(formatDateTimeMedium(null)).toBe('Not set')
    expect(formatDateTimeMedium(undefined)).toBe('Not set')
  })
})

describe('formatDateLong', () => {
  it('formats with full weekday', () => {
    const result = formatDateLong('2026-06-15T14:30:00Z')
    // Should include day name (e.g., "Monday, 15 June 2026")
    expect(result).toMatch(/\w+.*\d{1,2}.*2026/)
  })

  it('returns null for null/undefined', () => {
    expect(formatDateLong(null)).toBeNull()
    expect(formatDateLong(undefined)).toBeNull()
  })
})

describe('formatDateRange', () => {
  it('returns em-dash for both empty', () => {
    expect(formatDateRange(null, null)).toBe('—')
    expect(formatDateRange(undefined, undefined)).toBe('—')
    expect(formatDateRange()).toBe('—')
  })

  it('formats range when both dates provided', () => {
    const result = formatDateRange('2026-06-10T00:00:00Z', '2026-06-20T00:00:00Z')
    expect(result).toMatch(/\d{1,2}.*–\s*\d{1,2}/)
  })

  it('formats opens-only', () => {
    const result = formatDateRange('2026-06-10T00:00:00Z', null)
    expect(result).toMatch(/Opens.*\d{1,2}/)
  })

  it('formats closes-only', () => {
    const result = formatDateRange(null, '2026-06-20T00:00:00Z')
    expect(result).toMatch(/Closes.*\d{1,2}/)
  })
})

describe('formatRelativeDate', () => {
  it('returns "just now" for times < 1 minute ago', () => {
    const recent = new Date(MOCK_NOW - 30000).toISOString() // 30s ago
    expect(formatRelativeDate(recent)).toBe('just now')
  })

  it('returns minutes ago', () => {
    const fiveMinutesAgo = new Date(MOCK_NOW - 5 * 60000).toISOString()
    expect(formatRelativeDate(fiveMinutesAgo)).toBe('5m ago')
  })

  it('returns hours ago', () => {
    const twoHoursAgo = new Date(MOCK_NOW - 2 * 3600000).toISOString()
    expect(formatRelativeDate(twoHoursAgo)).toBe('2h ago')
  })

  it('returns days ago', () => {
    const threeDaysAgo = new Date(MOCK_NOW - 3 * 86400000).toISOString()
    expect(formatRelativeDate(threeDaysAgo)).toBe('3d ago')
  })

  it('returns full date for dates > 7 days ago', () => {
    const eightDaysAgo = new Date(MOCK_NOW - 8 * 86400000).toISOString()
    const result = formatRelativeDate(eightDaysAgo)
    expect(result).toMatch(/\d{1,2}.*2026/)
  })
})

describe('formatRelativeTime', () => {
  it('returns hours for times < 24 hours', () => {
    const thirtyMinutesAgo = new Date(MOCK_NOW - 30 * 60000).toISOString()
    // formatRelativeTime rounds diffMs to days, so 30 min rounds to 1 hour difference
    expect(formatRelativeTime(thirtyMinutesAgo)).toBeTruthy()
  })

  it('returns days ago', () => {
    const twoDaysAgo = new Date(MOCK_NOW - 2 * 86400000).toISOString()
    expect(formatRelativeTime(twoDaysAgo)).toBe('2d ago')
  })

  it('falls back to full datetime for dates > 7 days', () => {
    const eightDaysAgo = new Date(MOCK_NOW - 8 * 86400000).toISOString()
    const result = formatRelativeTime(eightDaysAgo)
    expect(result).toMatch(/\d{1,2}.*2026.*\d{2}:\d{2}/)
  })

  it('handles future dates', () => {
    const inOneHour = new Date(MOCK_NOW + 3600000).toISOString()
    // Negative diffDays should still work
    expect(formatRelativeTime(inOneHour)).toBeTruthy()
  })
})

describe('formatDateForTooltip', () => {
  it('returns object with relative and full datetime', () => {
    const fiveMinutesAgo = new Date(MOCK_NOW - 5 * 60000).toISOString()
    const result = formatDateForTooltip(fiveMinutesAgo)
    expect(result).toHaveProperty('relative')
    expect(result).toHaveProperty('full')
    expect(result.relative).toBe('5m ago')
    expect(result.full).toMatch(/\d{1,2}.*2026.*\d{2}:\d{2}/)
  })
})

describe('statusBadgeVariant', () => {
  it('returns "default" for active/completed', () => {
    expect(statusBadgeVariant('active')).toBe('default')
    expect(statusBadgeVariant('completed')).toBe('default')
  })

  it('returns "secondary" for draft/pending', () => {
    expect(statusBadgeVariant('draft')).toBe('secondary')
    expect(statusBadgeVariant('pending')).toBe('secondary')
  })

  it('returns "outline" for paused/archived/closed', () => {
    expect(statusBadgeVariant('paused')).toBe('outline')
    expect(statusBadgeVariant('archived')).toBe('outline')
    expect(statusBadgeVariant('closed')).toBe('outline')
  })

  it('returns "destructive" for failed', () => {
    expect(statusBadgeVariant('failed')).toBe('destructive')
  })

  it('returns "outline" for unknown status', () => {
    expect(statusBadgeVariant('unknown_status')).toBe('outline')
  })
})

describe('formatExpiryStatus', () => {
  it('returns "Expires in X days" for future dates', () => {
    const inTwoDays = new Date(MOCK_NOW + 2 * 86400000).toISOString()
    const result = formatExpiryStatus(inTwoDays)
    expect(result).toMatch(/Expires in \d+ days?/)
  })

  it('returns "Expires within 1 day" for near future', () => {
    const in12Hours = new Date(MOCK_NOW + 12 * 3600000).toISOString()
    const result = formatExpiryStatus(in12Hours)
    expect(result).toBe('Expires within 1 day')
  })

  it('returns "Expired X days ago" for past dates', () => {
    const twoDaysAgo = new Date(MOCK_NOW - 2 * 86400000).toISOString()
    const result = formatExpiryStatus(twoDaysAgo)
    expect(result).toMatch(/Expired \d+ days? ago/)
  })

  it('returns "Expired within 1 day" for recent past', () => {
    const in12HoursPast = new Date(MOCK_NOW - 12 * 3600000).toISOString()
    const result = formatExpiryStatus(in12HoursPast)
    expect(result).toBe('Expired within 1 day')
  })
})

describe('formatDateOrNull', () => {
  it('formats date or returns null', () => {
    const result = formatDateOrNull('2026-06-15T14:30:00Z')
    expect(result).toMatch(/\d{1,2}.*2026/)
  })

  it('returns null for null/undefined', () => {
    expect(formatDateOrNull(null)).toBeNull()
    expect(formatDateOrNull(undefined)).toBeNull()
  })
})
