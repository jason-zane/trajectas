import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getComparisonMatrix = vi.fn()

vi.mock('@/app/actions/comparison', () => ({
  getComparisonMatrix: (req: unknown) => getComparisonMatrix(req),
}))

import { POST } from '@/app/api/comparison/export/route'

const VALID_BODY = {
  entries: [{ campaignParticipantId: '11111111-1111-4111-8111-111111111111' }],
  assessmentIds: ['22222222-2222-4222-8222-222222222222'],
  granularity: 'factors_or_constructs' as const,
}

const EMPTY_RESULT = { columns: [], rows: [] }

describe('POST /api/comparison/export', () => {
  beforeEach(() => {
    getComparisonMatrix.mockReset().mockResolvedValue(EMPTY_RESULT)
  })
  afterEach(() => vi.clearAllMocks())

  it('rejects an invalid body with 400', async () => {
    const res = await POST(
      new Request('http://localhost/x', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: 'not-an-array' }),
      }),
    )
    expect(res.status).toBe(400)
    expect(getComparisonMatrix).not.toHaveBeenCalled()
  })

  it('returns text/csv with attachment headers and a header-row body', async () => {
    const res = await POST(
      new Request('http://localhost/x', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...VALID_BODY, campaignSlug: 'leadership-q2' }),
      }),
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/csv')
    const cd = res.headers.get('content-disposition') ?? ''
    expect(cd).toContain('attachment;')
    expect(cd).toMatch(/filename="trajectas-comparison-leadership-q2-\d{8}\.csv"/)
    const body = await res.text()
    expect(body.split('\n')[0]).toBe(
      'Participant,Email,Date,Attempt #,Assessment,Session Status',
    )
  })

  it('uses the participants filename when no campaignSlug is supplied', async () => {
    const res = await POST(
      new Request('http://localhost/x', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_BODY),
      }),
    )
    const cd = res.headers.get('content-disposition') ?? ''
    expect(cd).toMatch(/filename="trajectas-comparison-participants-\d{8}\.csv"/)
  })

  it('forwards the request body fields to getComparisonMatrix', async () => {
    await POST(
      new Request('http://localhost/x', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_BODY),
      }),
    )
    expect(getComparisonMatrix).toHaveBeenCalledWith({
      entries: VALID_BODY.entries,
      assessmentIds: VALID_BODY.assessmentIds,
      granularity: VALID_BODY.granularity,
    })
  })
})
