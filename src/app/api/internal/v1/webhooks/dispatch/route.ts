import {
  integrationJsonResponse,
  withInternalIntegrationWorkerRoute,
} from '@/lib/integrations/auth'
import { parseIntegrationRequestBody } from '@/lib/integrations/request'
import { dispatchIntegrationWebhookSchema } from '@/lib/integrations/schema'
import { dispatchPendingIntegrationEvents } from '@/lib/integrations/webhooks'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  return withInternalIntegrationWorkerRoute(request, async () => {
    const input = await parseIntegrationRequestBody(request, dispatchIntegrationWebhookSchema)
    const result = await dispatchPendingIntegrationEvents(input.limit)
    return integrationJsonResponse(result)
  })
}
