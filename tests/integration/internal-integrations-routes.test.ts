import { beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({
  withIntegrationApiRoute: vi.fn(),
  withInternalIntegrationWorkerRoute: vi.fn(),
  integrationJsonResponse: vi.fn(),
}))

const service = vi.hoisted(() => ({
  createIntegrationCampaign: vi.fn(),
  getIntegrationCampaign: vi.fn(),
  upsertIntegrationParticipant: vi.fn(),
  createIntegrationLaunch: vi.fn(),
  getIntegrationLaunch: vi.fn(),
  getIntegrationParticipantResultSummary: vi.fn(),
  getIntegrationParticipantReports: vi.fn(),
}))

const webhooks = vi.hoisted(() => ({
  dispatchPendingIntegrationEvents: vi.fn(),
}))

vi.mock('@/lib/integrations/auth', () => ({
  withIntegrationApiRoute: auth.withIntegrationApiRoute,
  withInternalIntegrationWorkerRoute: auth.withInternalIntegrationWorkerRoute,
  integrationJsonResponse: auth.integrationJsonResponse,
}))

vi.mock('@/lib/integrations/service', () => ({
  createIntegrationCampaign: service.createIntegrationCampaign,
  getIntegrationCampaign: service.getIntegrationCampaign,
  upsertIntegrationParticipant: service.upsertIntegrationParticipant,
  createIntegrationLaunch: service.createIntegrationLaunch,
  getIntegrationLaunch: service.getIntegrationLaunch,
  getIntegrationParticipantResultSummary: service.getIntegrationParticipantResultSummary,
  getIntegrationParticipantReports: service.getIntegrationParticipantReports,
}))

vi.mock('@/lib/integrations/webhooks', () => ({
  dispatchPendingIntegrationEvents: webhooks.dispatchPendingIntegrationEvents,
}))

import { POST as createCampaignPOST } from '@/app/api/internal/v1/campaigns/route'
import { POST as upsertParticipantPOST } from '@/app/api/internal/v1/campaigns/[campaignId]/participants/upsert/route'
import { GET as participantReportsGET } from '@/app/api/internal/v1/participants/[participantId]/reports/route'
import { POST as dispatchWebhooksPOST } from '@/app/api/internal/v1/webhooks/dispatch/route'

const integrationContext = {
  requestId: 'req-1',
  clientId: '00000000-0000-0000-0000-000000000001',
  connectionId: '00000000-0000-0000-0000-000000000002',
  connectionProvider: 'trajectas_internal',
  credentialId: '00000000-0000-0000-0000-000000000003',
  credentialLabel: 'Internal API',
  scopes: [
    'campaigns:read',
    'campaigns:write',
    'participants:read',
    'participants:write',
    'launches:read',
    'launches:write',
    'results:read',
    'reports:read',
  ],
} as const

const workerContext = {
  requestId: 'req-worker-1',
} as const

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store',
    },
  })
}

describe('internal integrations API routes', () => {
  beforeEach(() => {
    auth.integrationJsonResponse.mockImplementation(jsonResponse)
    auth.withIntegrationApiRoute.mockImplementation(
      async (_request, _options, handler) => handler(integrationContext)
    )
    auth.withInternalIntegrationWorkerRoute.mockImplementation(
      async (_request, handler) => handler(workerContext)
    )

    service.createIntegrationCampaign.mockReset()
    service.getIntegrationCampaign.mockReset()
    service.upsertIntegrationParticipant.mockReset()
    service.createIntegrationLaunch.mockReset()
    service.getIntegrationLaunch.mockReset()
    service.getIntegrationParticipantResultSummary.mockReset()
    service.getIntegrationParticipantReports.mockReset()
    webhooks.dispatchPendingIntegrationEvents.mockReset()
  })

  it('creates campaigns with schema defaults applied', async () => {
    service.createIntegrationCampaign.mockResolvedValueOnce({
      campaign: { id: 'campaign-1', title: 'Operations Hiring' },
      assessments: [],
      reportConfig: null,
    })

    const response = await createCampaignPOST(
      new Request('http://localhost/api/internal/v1/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Operations Hiring',
          slug: 'operations-hiring',
        }),
      })
    )

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({
      campaign: { id: 'campaign-1', title: 'Operations Hiring' },
      assessments: [],
      reportConfig: null,
    })
    expect(service.createIntegrationCampaign).toHaveBeenCalledWith(
      integrationContext,
      expect.objectContaining({
        title: 'Operations Hiring',
        slug: 'operations-hiring',
        status: 'draft',
        allowResume: true,
        showProgress: true,
        randomizeAssessmentOrder: false,
      })
    )
  })

  it('upserts participants and returns 201 for newly created records', async () => {
    const campaignId = '11111111-1111-4111-8111-111111111111'
    service.upsertIntegrationParticipant.mockResolvedValueOnce({
      participant: { id: 'participant-1', email: 'candidate@example.com' },
      campaign: { id: campaignId, title: 'Operations Hiring' },
      assessmentUrl: 'https://assess.example.test/assess/token-1',
      created: true,
    })

    const response = await upsertParticipantPOST(
      new Request(`http://localhost/api/internal/v1/campaigns/${campaignId}/participants/upsert`, {
        method: 'POST',
        body: JSON.stringify({
          email: 'candidate@example.com',
          firstName: 'Casey',
        }),
      }),
      {
        params: Promise.resolve({ campaignId }),
      }
    )

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({
      participant: { id: 'participant-1', email: 'candidate@example.com' },
      campaign: { id: campaignId, title: 'Operations Hiring' },
      assessmentUrl: 'https://assess.example.test/assess/token-1',
      created: true,
    })
    expect(service.upsertIntegrationParticipant).toHaveBeenCalledWith(
      integrationContext,
      campaignId,
      {
        email: 'candidate@example.com',
        firstName: 'Casey',
      }
    )
  })

  it('wraps participant reports in a stable response envelope', async () => {
    const participantId = '22222222-2222-4222-8222-222222222222'
    service.getIntegrationParticipantReports.mockResolvedValueOnce([
      { id: 'snapshot-1' },
    ])

    const response = await participantReportsGET(
      new Request(`http://localhost/api/internal/v1/participants/${participantId}/reports`),
      {
        params: Promise.resolve({ participantId }),
      }
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      reports: [{ id: 'snapshot-1', audienceType: 'hr_manager' }],
    })
    expect(service.getIntegrationParticipantReports).toHaveBeenCalledWith(
      integrationContext,
      participantId
    )
  })

  it('dispatches pending webhooks with the schema default batch size', async () => {
    webhooks.dispatchPendingIntegrationEvents.mockResolvedValueOnce({
      processed: 2,
      delivered: 2,
    })

    const response = await dispatchWebhooksPOST(
      new Request('http://localhost/api/internal/v1/webhooks/dispatch', {
        method: 'POST',
        body: JSON.stringify({}),
      })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      processed: 2,
      delivered: 2,
    })
    expect(webhooks.dispatchPendingIntegrationEvents).toHaveBeenCalledWith(25)
  })
})
