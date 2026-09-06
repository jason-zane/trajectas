// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { getResponseDb, getResponsesForSession, markSynced, putResponse } from '@/lib/assess/response-store'

describe('durable response revisions', () => {
  beforeEach(async () => { await getResponseDb().responses.clear() })
  const input = { sessionId: 'session', itemId: 'item', sectionId: 'section', value: 1 }
  it('allocates increasing revisions for simultaneous browser-tab writes', async () => {
    const writes = await Promise.all([putResponse(input), putResponse(input), putResponse(input)])
    expect(writes.map(row => row.revision).sort()).toEqual([1, 2, 3])
  })
  it('continues from authoritative server revision after browser storage loss', async () => {
    expect((await putResponse({ ...input, serverRevision: 20 })).revision).toBe(21)
  })
  it('does not overlay acknowledged stale browser values on fresh server state', async () => {
    const row = await putResponse(input)
    await markSynced(input.sessionId, [row])
    expect((await getResponsesForSession(input.sessionId)).size).toBe(0)
    await putResponse({ ...input, value: 5 })
    expect((await getResponsesForSession(input.sessionId)).get('item')?.value).toBe(5)
  })
})
