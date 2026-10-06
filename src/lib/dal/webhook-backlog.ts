import 'server-only'
import { z } from 'zod'
import { AuthorizationError, canManageClient, requireClientAccess } from '@/lib/auth/authorization'
import { requireWorkspaceFeature } from '@/lib/features/access'
import { getIntegrationClientFeatures } from '@/lib/dal/workspace-features'
import { createAdminClient } from '@/lib/supabase/admin'
import { postgresUuid } from '@/lib/validations/uuid'
export type WebhookBacklogReview = { deliveryEnabled: boolean; hasMore: boolean; events: { id: string; eventType: string; createdAt: string; heldAt: string | null; attempts: number }[] }
async function requireBacklogManager(clientId: string) {
  postgresUuid().parse(clientId)
  await requireWorkspaceFeature('integrationManagement')
  const access = await requireClientAccess(clientId)
  if (!canManageClient(access.scope,access.clientId) || !access.scope.actor?.id) throw new AuthorizationError('You do not have permission to review this client’s webhook backlog.')
  return access.scope.actor.id
}
/** Metadata only: payloads, endpoint URLs, signatures and credentials never reach this DTO. */
export async function getWebhookBacklogReview(clientId: string): Promise<WebhookBacklogReview> {
  await requireBacklogManager(clientId)
  const { data,error } = await createAdminClient().from('integration_events_outbox')
    .select('id,event_type,created_at,held_at,attempts').eq('client_id',clientId)
    .eq('requires_review',true).eq('status','failed').is('dispatched_at',null).lt('attempts',5)
    .order('created_at',{ascending:true}).order('id',{ascending:true}).limit(101)
  if (error) throw new Error('Unable to load saved webhook events.')
  return { deliveryEnabled:(await getIntegrationClientFeatures(clientId)).webhookDelivery, hasMore:(data?.length??0)>100,
    events:(data??[]).slice(0,100).map(row=>({ id:String(row.id),eventType:String(row.event_type),createdAt:String(row.created_at),heldAt:row.held_at?String(row.held_at):null,attempts:Number(row.attempts) })) }
}
export async function releaseReviewedWebhookBacklog(clientId: string,idsInput: unknown): Promise<number> {
  const actor = await requireBacklogManager(clientId)
  await requireWorkspaceFeature('webhookDelivery')
  if (!(await getIntegrationClientFeatures(clientId)).webhookDelivery) throw new AuthorizationError('Enable client webhook delivery before releasing saved events.')
  const ids = z.array(postgresUuid()).min(1).max(100).refine(ids=>new Set(ids).size===ids.length).parse(idsInput)
  const { data,error } = await createAdminClient().rpc('release_reviewed_webhook_events',{p_client_id:clientId,p_actor:actor,p_ids:ids})
  if (error) throw new Error(error.message)
  if (typeof data!=='number' || data!==ids.length) throw new Error('Unable to confirm saved webhook release.')
  return data
}
