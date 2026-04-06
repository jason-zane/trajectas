import {
  integrationJsonResponse,
  withIntegrationApiRoute,
} from '@/lib/integrations/auth'
import { parseIntegrationRequestBody } from '@/lib/integrations/request'
import { createIntegrationCampaignSchema } from '@/lib/integrations/schema'
import { createIntegrationCampaign } from '@/lib/integrations/service'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  return withIntegrationApiRoute(
    request,
    {
      scopes: ['campaigns:write'],
      enableIdempotency: true,
    },
    async (context) => {
      const input = await parseIntegrationRequestBody(request, createIntegrationCampaignSchema)
      const campaign = await createIntegrationCampaign(context, input)
      return integrationJsonResponse(campaign, 201)
    }
  )
}
