import {
  integrationJsonResponse,
  withIntegrationApiRoute,
} from '@/lib/integrations/auth'
import { parseUuidParam } from '@/lib/integrations/request'
import { getIntegrationParticipantResultSummary } from '@/lib/integrations/service'

export const runtime = 'nodejs'

type ParticipantSummaryRouteContext = {
  params: Promise<{ participantId: string }>
}

export async function GET(request: Request, context: ParticipantSummaryRouteContext) {
  return withIntegrationApiRoute(
    request,
    {
      scopes: ['results:read'],
    },
    async (authContext) => {
      const { participantId } = await context.params
      const result = await getIntegrationParticipantResultSummary(
        authContext,
        parseUuidParam(participantId, 'participantId')
      )
      return integrationJsonResponse(result)
    }
  )
}
