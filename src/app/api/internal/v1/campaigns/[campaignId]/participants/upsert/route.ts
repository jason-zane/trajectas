import {
  integrationJsonResponse,
  withIntegrationApiRoute,
} from '@/lib/integrations/auth'
import {
  parseIntegrationRequestBody,
  parseUuidParam,
} from '@/lib/integrations/request'
import { upsertIntegrationParticipantSchema } from '@/lib/integrations/schema'
import { upsertIntegrationParticipant } from '@/lib/integrations/service'

export const runtime = 'nodejs'

type CampaignParticipantsRouteContext = {
  params: Promise<{ campaignId: string }>
}

export async function POST(request: Request, context: CampaignParticipantsRouteContext) {
  return withIntegrationApiRoute(
    request,
    {
      scopes: ['participants:write'],
      enableIdempotency: true,
    },
    async (authContext) => {
      const { campaignId } = await context.params
      const input = await parseIntegrationRequestBody(request, upsertIntegrationParticipantSchema)
      const participant = await upsertIntegrationParticipant(
        authContext,
        parseUuidParam(campaignId, 'campaignId'),
        input
      )
      return integrationJsonResponse(participant, participant.created ? 201 : 200)
    }
  )
}
