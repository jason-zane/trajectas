// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRpc = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ rpc: mockRpc }),
}))

const { POST } = await import('@/app/api/assess/save-batch/route')

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'
const VALID_UUID_2 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/assess/save-batch', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('POST /api/assess/save-batch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with saved count and echoed idempotency keys on success', async () => {
    mockRpc.mockResolvedValue({ data: 2, error: null })

    const res = await POST(
      makeRequest({
        token: 'test-token',
        sessionId: VALID_UUID,
        saves: [
          {
            itemId: VALID_UUID_2,
            responseValue: 3,
            responseData: { foo: 'bar' },
            idempotencyKey: 'idem-1',
          },
          {
            itemId: VALID_UUID,
            responseValue: 5,
            idempotencyKey: 'idem-2',
          },
        ],
      }),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({
      success: true,
      saved: 2,
      idempotencyKeys: ['idem-1', 'idem-2'],
    })

    expect(mockRpc).toHaveBeenCalledWith('save_responses_batch_for_session', {
      p_access_token: 'test-token',
      p_session_id: VALID_UUID,
      p_saves: [
        {
          itemId: VALID_UUID_2,
          responseValue: 3,
          responseData: { foo: 'bar' },
          responseTimeMs: null,
        },
        {
          itemId: VALID_UUID,
          responseValue: 5,
          responseData: {},
          responseTimeMs: null,
        },
      ],
    })
  })

  it('returns 400 when input is malformed', async () => {
    const res = await POST(makeRequest({ token: 'test-token' }))
    expect(res.status).toBe(400)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('returns 400 when saves array is empty', async () => {
    const res = await POST(
      makeRequest({ token: 'test-token', sessionId: VALID_UUID, saves: [] }),
    )
    expect(res.status).toBe(400)
  })

  it('returns 403 when the RPC indicates a failed ownership check (negative count)', async () => {
    mockRpc.mockResolvedValue({ data: -1, error: null })

    const res = await POST(
      makeRequest({
        token: 'bad-token',
        sessionId: VALID_UUID,
        saves: [{ itemId: VALID_UUID_2, responseValue: 1, idempotencyKey: 'k' }],
      }),
    )

    expect(res.status).toBe(403)
  })

  it('returns 500 when the RPC throws', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'db down' } })

    const res = await POST(
      makeRequest({
        token: 'test-token',
        sessionId: VALID_UUID,
        saves: [{ itemId: VALID_UUID_2, responseValue: 1, idempotencyKey: 'k' }],
      }),
    )

    expect(res.status).toBe(500)
  })
})
