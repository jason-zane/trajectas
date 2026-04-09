// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRpc = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ rpc: mockRpc }),
}))

// Import after mocks
const { POST } = await import('@/app/api/assess/progress/route')

describe('POST /api/assess/progress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 when progress update succeeds', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null })

    const req = new Request('http://localhost/api/assess/progress', {
      method: 'POST',
      body: JSON.stringify({
        token: 'test-token',
        sessionId: 'session-123',
        sectionId: 'section-456',
        itemIndex: 5,
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockRpc).toHaveBeenCalledWith('update_session_progress_for_session', {
      p_access_token: 'test-token',
      p_session_id: 'session-123',
      p_current_section_id: 'section-456',
      p_current_item_index: 5,
    })
  })

  it('returns 400 when required fields are missing', async () => {
    const req = new Request('http://localhost/api/assess/progress', {
      method: 'POST',
      body: JSON.stringify({ token: 'test-token' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 403 when ownership check fails', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })

    const req = new Request('http://localhost/api/assess/progress', {
      method: 'POST',
      body: JSON.stringify({
        token: 'bad-token',
        sessionId: 'session-123',
        sectionId: 'section-456',
        itemIndex: 5,
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(403)
  })
})
