// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { ACKNOWLEDGED_RESPONSE_RETENTION_MS, getResponseDb, getResponsesForSession, markSynced, pruneAcknowledgedResponses, putResponse } from '@/lib/assess/response-store'

describe('browser response retention', () => {
  beforeEach(async () => { await getResponseDb().responses.clear() })
  const input = { sessionId: 'session', itemId: 'item', sectionId: 'section', value: 5, data: { answer: 'private-answer' }, responseTimeMs: 123 }
  it('removes acknowledged answer content without breaking revision allocation', async () => {
    const row = await putResponse(input)
    await markSynced(input.sessionId, [row])
    expect(await getResponseDb().responses.get(['session', 'item']))
      .toMatchObject({ synced: 1, value: 0, data: {}, revision: 1 })
    expect(JSON.stringify(await getResponseDb().responses.toArray())).not.toContain('private-answer')
    expect((await putResponse(input)).revision).toBe(2)
  })
  it('does not wipe a newer unsent answer when a stale ACK arrives', async () => {
    const old = await putResponse(input)
    const current = await putResponse({ ...input, value: 4 })
    await markSynced(input.sessionId, [old])
    expect(await getResponseDb().responses.get(['session', 'item'])).toMatchObject({ synced: 0, value: 4, revision: current.revision })
  })
  it('expires old acknowledged sessions but retains unsent work and active revisions', async () => {
    const now = Date.now(), old = now - ACKNOWLEDGED_RESPONSE_RETENTION_MS - 1
    for (const sessionId of ['expired', 'pending', 'mixed']) {
      const row = await putResponse({ ...input, sessionId })
      await markSynced(sessionId, [row])
      await getResponseDb().responses.update([sessionId, 'item'], { updatedAt: old })
    }
    await putResponse({ ...input, sessionId: 'pending', itemId: 'unsent' })
    await putResponse({ ...input, sessionId: 'mixed', itemId: 'recent' })
    expect(await pruneAcknowledgedResponses(now)).toBe(1)
    expect(await getResponseDb().responses.where('sessionId').equals('expired').count()).toBe(0)
    expect(await getResponseDb().responses.where('sessionId').equals('pending').count()).toBe(2)
    expect((await getResponsesForSession('pending')).get('unsent')?.value).toBe(5)
  })
})
