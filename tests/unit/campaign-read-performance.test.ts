import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function run(scenario: string) {
  const output = execFileSync(process.execPath, [
    '--conditions=react-server', resolve('tests/fixtures/campaign-reads-rsc.mjs'), scenario,
  ], { encoding: 'utf8' })
  return JSON.parse(output.trim())
}

describe('campaign reads inside real React server renders', () => {
  it('retains the campaign-viewing denial before the cached scoped read', () => {
    const result = run('feature-denied')
    expect(result.results).toEqual([{ denied: true }])
    expect(result.calls).toMatchObject({ lists: 0, links: 0, scopes: 0 })
  })
  it('shares the dashboard campaign read and preserves the six displayed campaigns', () => {
    const result = run('dashboard')
    expect(result.calls).toMatchObject({ lists: 1, links: 1, linkRows: 120, access: 1, scopes: 1 })
    expect(result.results[0].allCount).toBe(60)
    expect(result.results[0].operational.map((c: { id: string }) => c.id)).toEqual([
      'campaign-58', 'campaign-54', 'campaign-50', 'campaign-46', 'campaign-42', 'campaign-38',
    ])
    expect(result.results[0].operational.every((c: { linkIds: string[] }) => c.linkIds.length === 2)).toBe(true)
  })

  it('retains the full campaign list and links when no limit is requested', () => {
    const result = run('unlimited')
    expect(result.results).toEqual([{ count: 60, links: 120 }])
  })

  it('does not retain a cached result across renders by different actors', () => {
    const result = run('request-isolation')
    expect(result.calls.lists).toBe(2)
    expect(result.results).toEqual([{ actors: ['actor-a', 'actor-a'] }, { actors: ['actor-b', 'actor-b'] }])
  })

  it('resolves a new tenant/support context on each render with the same implicit cache key', () => {
    const result = run('context-isolation')
    expect(result.calls.lists).toBe(2)
    expect(result.results).toEqual([
      { clients: ['client-a', 'client-a'] }, { clients: ['client-b', 'client-b'] },
    ])
    expect(result.capturedScopes).toEqual([
      { effectiveClientId: 'client-a', scopedCampaignIds: null },
      { effectiveClientId: 'client-b', scopedCampaignIds: null },
    ])
  })

  it('keeps different client keys separate within one render', () => {
    const result = run('client-isolation')
    expect(result.calls.lists).toBe(2)
    expect(result.results).toEqual([{ clients: ['client-a', 'client-b'] }])
  })

  it('retains scope resolution and effective client selection', () => {
    const result = run('scope')
    expect(result.capturedScopes).toEqual([
      { effectiveClientId: 'client-b', scopedCampaignIds: null },
      { effectiveClientId: 'client-a', scopedCampaignIds: null },
    ])
  })

  it('passes an empty workspace scope through rather than treating it as unrestricted', () => {
    const result = run('empty-scope')
    expect(result.capturedScopes).toEqual([{ effectiveClientId: null, scopedCampaignIds: [] }])
    expect(result.results).toEqual([{ count: 0 }])
  })

  it('preserves the campaign IDs supplied by a confined workspace', () => {
    const result = run('limited-scope')
    expect(result.capturedScopes).toEqual([{ effectiveClientId: null, scopedCampaignIds: ['campaign-58'] }])
  })

  it('preserves the empty-list result', () => {
    const result = run('empty')
    expect(result.calls.lists).toBe(1)
    expect(result.results).toEqual([{ allCount: 0, operational: [] }])
  })

  it('still denies the operational read before either data query', () => {
    const result = run('denied')
    expect(result.results).toEqual([{ denied: true }])
    expect(result.calls).toMatchObject({ lists: 0, links: 0, access: 1 })
  })
})
