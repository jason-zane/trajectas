import {
  integrationJsonResponse,
  withIntegrationApiRoute,
} from '@/lib/integrations/auth'
import { parseUuidParam } from '@/lib/integrations/request'
import { getIntegrationCampaign } from '@/lib/integrations/service'

export const runtime = 'nodejs'

type CampaignRouteContext = {
  params: Promise<{ campaignId: string }>
}

export async function GET(request: Request, context: CampaignRouteContext) {
  return withIntegrationApiRoute(
    request,
    {
      scopes: ['campaigns:read'],
    },
    async (authContext) => {
      const { campaignId } = await context.params
      const campaign = await getIntegrationCampaign(
        authContext,
        parseUuidParam(campaignId, 'campaignId')
      )
      return integrationJsonResponse(campaign)
    }
  )
}
