import {
  integrationJsonResponse,
  withIntegrationApiRoute,
} from '@/lib/integrations/auth'
import { parseUuidParam } from '@/lib/integrations/request'
import { getIntegrationParticipantReports } from '@/lib/integrations/service'

export const runtime = 'nodejs'

type ParticipantReportsRouteContext = {
  params: Promise<{ participantId: string }>
}

export async function GET(request: Request, context: ParticipantReportsRouteContext) {
  return withIntegrationApiRoute(
    request,
    {
      scopes: ['reports:read'],
    },
    async (authContext) => {
      const { participantId } = await context.params
      const reports = await getIntegrationParticipantReports(
        authContext,
        parseUuidParam(participantId, 'participantId')
      )
      return integrationJsonResponse({ reports })
    }
  )
}
