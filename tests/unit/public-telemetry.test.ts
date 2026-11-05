import { describe, expect, it } from 'vitest'
import { filterPublicTelemetryEvent } from '@/lib/observability/public-telemetry'

describe('public telemetry boundary', () => {
  it('strips every query and fragment from eligible public URLs', () => {
    expect(filterPublicTelemetryEvent({ type: 'pageview', url: 'https://trajectas.com/?email=private@example.test#token' }))
      .toEqual({ type: 'pageview', url: 'https://trajectas.com/' })
  })
  it.each([
    'https://assess.trajectas.com/assess/private-token',
    'https://client.trajectas.com/', 'https://admin.trajectas.com/',
    'https://trajectas.com/assess/private-token', 'https://trajectas.com/reports/private-id',
    'https://trajectas.com/build/private-token', 'https://trajectas.com/role-builder',
    'https://trajectas.com/new-private-feature', 'https://trajectas.com.evil.test/',
    'https://user:password@trajectas.com/', 'http://trajectas.com/', '/assess/token',
  ])('drops private or unrecognised URL %s after navigation', url => {
    expect(filterPublicTelemetryEvent({ type: 'pageview', url })).toBeNull()
    expect(filterPublicTelemetryEvent({ type: 'vital', url, route: '/[private]' })).toBeNull()
  })
  it('does not forward private referrers or arbitrary custom event payloads', () => {
    const event = { type: 'pageview', url: 'https://trajectas.com/contact' }
    expect(filterPublicTelemetryEvent(event, 'https://trajectas.com/assess/private-token')).toBeNull()
    expect(filterPublicTelemetryEvent(event, 'https://example.test/person/name')).toBeNull()
    expect(filterPublicTelemetryEvent({ ...event, type: 'event', name: 'participant@example.test' })).toBeNull()
  })
  it('replaces a Speed Insights route with the approved static path', () => {
    expect(filterPublicTelemetryEvent({ type: 'vital', url: 'https://www.trajectas.com/for-teams?private=value', route: '/private' }))
      .toMatchObject({ url: 'https://www.trajectas.com/for-teams', route: '/for-teams' })
  })
})
