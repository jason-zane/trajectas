import { describe, expect, it } from 'vitest'
import { getTimeOfDayGreeting } from '@/lib/experience/time-greeting'

describe('getTimeOfDayGreeting', () => {
  it('returns "Good morning" before noon', () => {
    const morning = new Date(2026, 0, 1, 9, 0) // 9 AM
    expect(getTimeOfDayGreeting(morning)).toBe('Good morning')

    const late_morning = new Date(2026, 0, 1, 11, 59) // 11:59 AM
    expect(getTimeOfDayGreeting(late_morning)).toBe('Good morning')
  })

  it('returns "Good afternoon" from noon to 5 PM', () => {
    const noon = new Date(2026, 0, 1, 12, 0) // 12 PM
    expect(getTimeOfDayGreeting(noon)).toBe('Good afternoon')

    const afternoon = new Date(2026, 0, 1, 15, 0) // 3 PM
    expect(getTimeOfDayGreeting(afternoon)).toBe('Good afternoon')

    const late_afternoon = new Date(2026, 0, 1, 16, 59) // 4:59 PM
    expect(getTimeOfDayGreeting(late_afternoon)).toBe('Good afternoon')
  })

  it('returns "Good evening" at 5 PM and later', () => {
    const early_evening = new Date(2026, 0, 1, 17, 0) // 5 PM
    expect(getTimeOfDayGreeting(early_evening)).toBe('Good evening')

    const evening = new Date(2026, 0, 1, 20, 0) // 8 PM
    expect(getTimeOfDayGreeting(evening)).toBe('Good evening')

    const late_evening = new Date(2026, 0, 1, 23, 59) // 11:59 PM
    expect(getTimeOfDayGreeting(late_evening)).toBe('Good evening')
  })
})
