import {
  integrationJsonResponse,
  withIntegrationApiRoute,
} from '@/lib/integrations/auth'
import {
  parseIntegrationRequestBody,
  parseUuidParam,
} from '@/lib/integrations/request'
import { createIntegrationLaunchSchema } from '@/lib/integrations/schema'
import { createIntegrationLaunch } from '@/lib/integrations/service'

export const runtime = 'nodejs'

type CampaignLaunchesRouteContext = {
  params: Promise<{ campaignId: string }>
}

export async function POST(request: Request, context: CampaignLaunchesRouteContext) {
  return withIntegrationApiRoute(
    request,
    {
      scopes: ['launches:write'],
      enableIdempotency: true,
    },
    async (authContext) => {
      const { campaignId } = await context.params
      const input = await parseIntegrationRequestBody(request, createIntegrationLaunchSchema)
      const launch = await createIntegrationLaunch(
        authContext,
        parseUuidParam(campaignId, 'campaignId'),
        input
      )
      return integrationJsonResponse({ launch }, 201)
    }
  )
}
