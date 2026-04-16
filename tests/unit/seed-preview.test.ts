import { describe, it, expect, vi } from 'vitest'
import { PREVIEW_SAMPLE_CLIENT_ID, ensurePreviewSampleClient } from '@/lib/sample-data/seed-preview'

describe('ensurePreviewSampleClient', () => {
  it('returns the well-known client id when the row exists', async () => {
    const db = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: PREVIEW_SAMPLE_CLIENT_ID },
              error: null,
            }),
          }),
        }),
      }),
    }
    // @ts-expect-error — duck-typed client for unit test
    const id = await ensurePreviewSampleClient(db)
    expect(id).toBe(PREVIEW_SAMPLE_CLIENT_ID)
  })

  it('throws when the Sample Data client row is missing', async () => {
    const db = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    }
    await expect(
      // @ts-expect-error — duck-typed
      ensurePreviewSampleClient(db),
    ).rejects.toThrow(/migration/)
  })
})
