import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ReferenceStatus } from '@/lib/norms/types'

/** Internal metadata read only. Call after authorizing these exact snapshots
 * through staff scope or a verified snapshot/participant token. It does not
 * authorize report access and never returns source distributions. */
export async function getReferenceStatusesForAuthorizedSnapshots(snapshots: Array<{ referenceVersionId?: string | null }>): Promise<Record<string, ReferenceStatus>> {
  const ids = [...new Set(snapshots.flatMap(s => s.referenceVersionId ? [s.referenceVersionId] : []))]
  if (!ids.length) return {}
  const { data, error } = await createAdminClient().from('norm_reference_versions').select('id,status').in('id', ids)
  if (error) throw new Error('Unable to verify the current reference status')
  return Object.fromEntries((data ?? []).map(r => [r.id, r.status as ReferenceStatus]))
}
