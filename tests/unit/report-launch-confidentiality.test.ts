import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { access, admin, audit } = vi.hoisted(() => ({ access: vi.fn(), admin: vi.fn(), audit: vi.fn() }))
vi.mock('@/lib/auth/authorization', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/auth/authorization')>()
  return { ...actual, requireParticipantAccess: access }
})
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: admin }))
vi.mock('@/lib/auth/support-sessions', () => ({ logAuditEvent: audit }))

import { launchParticipantExport, launchParticipantReport } from '@/lib/auth/report-launch'

beforeEach(() => {
  vi.clearAllMocks()
  access.mockResolvedValue({
    confidentialityMode: 'aggregate_only',
    scope: { isPlatformAdmin: false, clientAdminIds: ['own-client'], partnerAdminIds: ['own-partner'] },
    clientId: 'own-client', partnerId: 'own-partner',
  })
})

describe('staff participant report launch confidentiality', () => {
  for (const surface of ['partner', 'client'] as const) {
    for (const [label, launch] of [['view', launchParticipantReport], ['export', launchParticipantExport]] as const) {
      it(`denies aggregate-only ${surface} ${label} before reading any bearer token`, async () => {
        const request = new NextRequest(`https://${surface}.trajectas.com/reports/participants/participant-id`)
        const response = await launch(request, surface, 'participant-id')
        expect(response.status).toBe(307)
        expect(response.headers.get('location')).not.toContain('/assess/')
        expect(admin).not.toHaveBeenCalled()
        expect(audit).not.toHaveBeenCalled()
      })
    }
  }
})
