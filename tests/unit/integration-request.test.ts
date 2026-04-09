import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import {
  parseIntegrationRequestBody,
  parseUuidParam,
} from '@/lib/integrations/request'

describe('integration request helpers', () => {
  it('rejects malformed JSON bodies with a stable integration error', async () => {
    await expect(
      parseIntegrationRequestBody(
        new Request('http://localhost/api/internal/v1/campaigns', {
          method: 'POST',
          body: '{"title"',
        }),
        z.object({
          title: z.string(),
        })
      )
    ).rejects.toMatchObject({
      status: 400,
      code: 'invalid_json',
    })
  })

  it('rejects invalid UUID path parameters with a stable integration error', () => {
    expect(() => parseUuidParam('not-a-uuid', 'participantId')).toThrowError(
      'participantId must be a valid UUID.'
    )
  })
})
