import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminScope, isUnconfinedPlatformAdmin } from '@/lib/auth/authorization'
import { availabilityIssue, type ManagedCapability, type ModelChannel } from '@/lib/library/model-management'

export async function requireModelManager() {
  const scope = await requireAdminScope()
  if (!scope.isPlatformAdmin || !isUnconfinedPlatformAdmin(scope)) throw new Error('Open the platform workspace to manage the core model.')
  return scope
}
export async function getManagedCapabilities(): Promise<ManagedCapability[]> {
  await requireModelManager()
  const db = createAdminClient()
  const [factors, categories] = await Promise.all([
    db.from('factors').select('id,slug,name,definition,primary_category_id,readiness,is_active,is_match_eligible,is_assessment_eligible,is_public_visible').is('client_id', null).is('deleted_at', null).order('name'),
    db.from('library_categories').select('id,name'),
  ])
  if (factors.error || categories.error) throw new Error('Unable to load model controls. Check that the capability channel migration has been applied.')
  const names = new Map((categories.data ?? []).map(c => [c.id, c.name]))
  return (factors.data ?? []).map(f => ({ id: f.id, slug: f.slug, name: f.name, definition: f.definition ?? '', category: names.get(f.primary_category_id) ?? 'Uncategorised', readiness: f.readiness, active: f.is_active, matching: f.is_match_eligible, assessment: f.is_assessment_eligible, public: f.is_public_visible }))
}
export async function setCapabilityChannel(ids: string[], channel: ModelChannel, enabled: boolean) {
  await requireModelManager()
  const rows = await getManagedCapabilities()
  const selected = rows.filter(row => ids.includes(row.id))
  if (selected.length !== ids.length) throw new Error('Some capabilities are no longer available. Refresh and try again.')
  if (enabled) {
    const blocked = selected.find(row => availabilityIssue(row, channel))
    if (blocked) throw new Error(`${blocked.name}: ${availabilityIssue(blocked, channel)}`)
  }
  const db = createAdminClient()
  const { error } = await db.rpc('set_capability_channel', { p_ids: ids, p_channel: channel, p_enabled: enabled })
  if (error) throw new Error('Could not save availability. The library may have changed; refresh and try again.')
}

/** Existing selections can be retained; disabled capabilities cannot be newly added. */
export async function assessmentSelectionIssue(ids: string[], assessmentId?: string): Promise<string | null> {
  const db = createAdminClient()
  let existing = new Set<string>()
  if (assessmentId) {
    const result = await db.from('assessment_factors').select('factor_id').eq('assessment_id', assessmentId)
    if (result.error) return 'Unable to check existing capability selections.'
    existing = new Set((result.data ?? []).map(row => row.factor_id))
  }
  const added = [...new Set(ids)].filter(id => !existing.has(id))
  if (!added.length) return null
  const { data, error } = await db.from('factors').select('id').in('id', added).eq('is_active', true).eq('is_assessment_eligible', true).neq('readiness', 'draft').is('deleted_at', null)
  return error || data?.length !== added.length ? 'One or more capabilities are unavailable for new assessment selections. Refresh the library and choose again.' : null
}
