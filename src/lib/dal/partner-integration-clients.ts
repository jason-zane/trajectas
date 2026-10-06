import 'server-only'
import { z } from 'zod'
import { AuthorizationError, canManageClient, requirePartnerAccess } from '@/lib/auth/authorization'
import { requireWorkspaceFeature } from '@/lib/features/access'
import { createAdminClient } from '@/lib/supabase/admin'
import { postgresUuid } from '@/lib/validations/uuid'

export type PartnerIntegrationClient = { id: string; name: string; slug: string }

async function requireIntegrationScope(partnerId: string) {
  postgresUuid().parse(partnerId)
  await requireWorkspaceFeature('integrationManagement')
  return (await requirePartnerAccess(partnerId)).scope
}

/** Minimal selector for existing client managers; does not unlock the client directory. */
export async function listPartnerIntegrationClients(partnerId: string, pageInput = 0) {
  const page = z.number().int().min(0).max(10000).parse(pageInput)
  const scope = await requireIntegrationScope(partnerId)
  if (!scope.managedClientIds.length) return { clients: [] as PartnerIntegrationClient[], hasMore: false }
  const { data, error } = await createAdminClient().from('clients')
    .select('id,name,slug').eq('partner_id', partnerId).in('id', scope.managedClientIds)
    .is('deleted_at', null).order('id', { ascending: true }).range(page * 100, page * 100 + 100)
  if (error) throw new Error('Unable to load integration clients.')
  return { clients: (data ?? []).slice(0, 100).map(row => ({ id: String(row.id), name: String(row.name), slug: String(row.slug) })), hasMore: (data?.length ?? 0) > 100 }
}

export async function getPartnerIntegrationClient(partnerId: string, slugInput: string): Promise<PartnerIntegrationClient> {
  const slug = z.string().min(2).max(200).regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/).parse(slugInput)
  const scope = await requireIntegrationScope(partnerId)
  if (!scope.managedClientIds.length) throw new AuthorizationError('Client not found or inaccessible.')
  const { data, error } = await createAdminClient().from('clients')
    .select('id,name,slug').eq('partner_id', partnerId).in('id', scope.managedClientIds)
    .eq('slug', slug).is('deleted_at', null).maybeSingle()
  if (error) throw new Error('Unable to load integration client.')
  if (!data || !canManageClient(scope, String(data.id))) throw new AuthorizationError('Client not found or inaccessible.')
  return { id: String(data.id), name: String(data.name), slug: String(data.slug) }
}
