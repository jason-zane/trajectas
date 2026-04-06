import {
  integrationJsonResponse,
  withIntegrationApiRoute,
} from '@/lib/integrations/auth'
import { parseUuidParam } from '@/lib/integrations/request'
import { getIntegrationLaunch } from '@/lib/integrations/service'

export const runtime = 'nodejs'

type LaunchRouteContext = {
  params: Promise<{ launchId: string }>
}

export async function GET(request: Request, context: LaunchRouteContext) {
  return withIntegrationApiRoute(
    request,
    {
      scopes: ['launches:read'],
    },
    async (authContext) => {
      const { launchId } = await context.params
      const launch = await getIntegrationLaunch(authContext, parseUuidParam(launchId, 'launchId'))
      return integrationJsonResponse({ launch })
    }
  )
}
