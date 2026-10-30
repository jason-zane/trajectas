import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { resolveAuthorizedScope, requireAssessmentAccess, requireCampaignAccess, resolveTenantClientFilter, requireAdminScope, canManageCampaign } from '@/lib/auth/authorization'
import type { ReferenceOption, ReferenceStatus } from '@/lib/norms/types'
import { parseReferenceRefresh } from '@/lib/norms/refresh'
import { createHash } from 'node:crypto'

function matchesSupportedForm(row: Record<string, unknown>, form: { instrument_id: string; definition: Record<string, unknown> } | null | undefined) {
  return Boolean(form && form.instrument_id === 'ipip-neo-120-johnson-2014' && row.instrument_id === form.instrument_id && row.form_version === form.definition.formVersion && row.itemset_sha256 === form.definition.itemsetSha256 && row.scoring_version === 'ipip-neo-120-raw-v1' && row.method_version === 'weighted-empirical-midrank-v1')
}

function mapReference(row: Record<string, unknown>, isDefault = false, assessments: ReferenceOption['assessments'] = []): ReferenceOption {
  const data = JSON.parse(String(row.artifact_text))
  return {
    id: String(row.id), name: String(row.name), version: String(row.version), groupKey: String(row.group_key),
    instrumentId: String(row.instrument_id), formVersion: String(row.form_version), scoringVersion: String(row.scoring_version),
    family: String(row.family), status: row.status as ReferenceStatus, rawN: data.rawN, effectiveN: data.kishEffectiveN,
    ageBoundsInclusive: data.ageBoundsInclusive, countryLabels: data.countryLabels, weighting: data.weighting,
    methodVersion: String(row.method_version), provenance: row.provenance as ReferenceOption['provenance'],
    isDefault, scopeClientId: row.scope_client_id as string | null, reviewEvidence: (row.review_evidence ?? {}) as Record<string, string>,
    assessments,
  }
}

/** Platform maintenance only. A refresh cannot mutate the published population,
 * scoring contract, approvals, defaults or any delivered interpretation. */
export async function createNormReferenceVersion(input: { priorId: string; id: string; version: string; artifact: string; sourceUrl: string; attribution: string; collectionPeriod: string; notes: string }) {
  const scope = await requireAdminScope()
  if (!scope.actor?.id || resolveTenantClientFilter(scope) !== null) throw new Error('Reference maintenance requires the platform workspace')
  const db = createAdminClient()
  const prior = await db.from('norm_reference_versions').select('*').eq('id', input.priorId).single()
  if (prior.error || !prior.data) throw new Error('Reference not found')
  const data = parseReferenceRefresh(input.artifact)
  const old = JSON.parse(prior.data.artifact_text)
  if (data.id !== old.id || data.weighting !== old.weighting || JSON.stringify(data.ageBoundsInclusive) !== JSON.stringify(old.ageBoundsInclusive)
    || JSON.stringify(data.countryLabels) !== JSON.stringify(old.countryLabels)) throw new Error('A refresh must retain the group definition, age range, country selection and weighting. Create a separate population for a changed definition.')
  const artifact = JSON.stringify(data)
  const hash = createHash('sha256').update(artifact).digest('hex')
  const { data: id, error } = await db.rpc('create_norm_reference_version', {
    p_prior_id: input.priorId, p_id: input.id, p_version: input.version, p_artifact: artifact, p_hash: hash,
    p_provenance: { population: prior.data.provenance.population, collectionPeriod: input.collectionPeriod, previousVersionId: input.priorId, sourceUrl: input.sourceUrl, attribution: input.attribution,
      refreshNotes: input.notes, reuseStatus: 'pending-review', preparedBy: scope.actor.id, preparedAt: new Date().toISOString() },
  })
  if (error || !id) throw new Error(error?.message ?? 'Unable to create the reference version')
  return String(id)
}

/** Workspace-scoped metadata only; source distributions never flow to UI props. */
export async function listNormReferences(assessmentId?: string, maintenance = false): Promise<ReferenceOption[]> {
  const scope = maintenance ? await requireAdminScope() : await resolveAuthorizedScope()
  if (assessmentId) await requireAssessmentAccess(assessmentId)
  const db = createAdminClient()
  let query = db.from('norm_reference_versions').select('*').order('name')
  const clientIds = resolveTenantClientFilter(scope)
  if (clientIds !== null) query = clientIds.length ? query.or(`scope_client_id.is.null,scope_client_id.in.(${clientIds.join(',')})`) : query.is('scope_client_id', null)
  if (!maintenance) query = query.in('status', ['active', 'superseded'])
  type Assignment = { reference_version_id: string; is_default: boolean; assessments: { id: string; title: string } | { id: string; title: string }[] | null }
  let assignments: Assignment[] | null = null
  if (assessmentId) {
    const result = await db.from('assessment_norm_references').select('reference_version_id,is_default,assessments(id,title)').eq('assessment_id', assessmentId)
    if (result.error) throw new Error('Unable to load assessment references')
    assignments = result.data ?? []
    if (!assignments.length) return []
    query = query.in('id', assignments.map(a => a.reference_version_id))
  }
  const { data, error } = await query
  if (error) throw new Error('Unable to load reference groups')
  // Only the unrestricted platform maintenance workspace can discover other
  // assessments through shared reference groups. Scoped reads use the already
  // authorized assessment ID above; shared groups must not disclose tenant titles.
  if (maintenance && !assessmentId && clientIds === null && data?.length) {
    const result = await db.from('assessment_norm_references').select('reference_version_id,is_default,assessments!inner(id,title)').in('reference_version_id', data.map(r => r.id)).is('assessments.deleted_at', null)
    if (result.error) throw new Error('Unable to load reference assessment assignments')
    assignments = result.data ?? []
  }
  const form = assessmentId ? await db.from('standardized_assessment_forms').select('instrument_id,definition').eq('assessment_id', assessmentId).maybeSingle() : null
  if (form?.error) throw new Error('Unable to load the assessment scoring contract')
  return (data ?? []).filter(row => !assessmentId || matchesSupportedForm(row, form?.data)).map(row => {
    const links = assignments?.filter(a => a.reference_version_id === row.id) ?? []
    const assessments = links.flatMap(link => {
      const assessment = Array.isArray(link.assessments) ? link.assessments[0] : link.assessments
      return assessment ? [{ id: assessment.id, title: assessment.title, isDefault: link.is_default }] : []
    })
    return mapReference(row, links.some(a => a.is_default), assessments)
  })
}

/** Campaign access admits shared assessments without granting library-write access. */
export async function getCampaignReferenceSettings(campaignId: string) {
  const access = await requireCampaignAccess(campaignId)
  const db = createAdminClient()
  const [campaign, links, versions, attempts] = await Promise.all([
    db.from('campaigns').select('status').eq('id', campaignId).single(),
    db.from('campaign_assessments').select('id,assessment_id,reference_version_id,assessments(title)').eq('campaign_id', campaignId).is('deleted_at', null),
    db.from('norm_reference_versions').select('*').in('status', ['active', 'superseded']).or(access.clientId ? `scope_client_id.is.null,scope_client_id.eq.${access.clientId}` : 'scope_client_id.is.null'),
    db.from('participant_sessions').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId),
  ])
  if (campaign.error || links.error || versions.error || attempts.error) throw new Error('Unable to load campaign references')
  const ids = (links.data ?? []).map(r => r.assessment_id)
  const forms = ids.length ? await db.from('standardized_assessment_forms').select('assessment_id,instrument_id,definition').in('assessment_id', ids) : { data: [], error: null }
  if (forms.error) throw new Error('Unable to load assessment scoring contracts')
  const assignments = ids.length ? await db.from('assessment_norm_references').select('assessment_id,reference_version_id,is_default').in('assessment_id', ids) : { data: [], error: null }
  if (assignments.error) throw new Error('Unable to load compatible reference groups')
  return {
    status: campaign.data.status as string,
    canManage: canManageCampaign(access.scope, access.partnerId, access.clientId),
    locked: campaign.data.status !== 'draft' || (attempts.count ?? 0) > 0,
    assessments: (links.data ?? []).map(row => ({
      campaignAssessmentId: row.id as string, assessmentId: row.assessment_id as string,
      title: String((Array.isArray(row.assessments) ? row.assessments[0] : row.assessments)?.title ?? 'Assessment'),
      referenceVersionId: row.reference_version_id as string | null,
      references: (versions.data ?? []).filter(v => matchesSupportedForm(v, forms.data?.find(f => f.assessment_id === row.assessment_id)) && assignments.data?.some(a => a.assessment_id === row.assessment_id && a.reference_version_id === v.id)).map(v => {
        const isDefault = assignments.data?.find(a => a.assessment_id === row.assessment_id && a.reference_version_id === v.id)?.is_default ?? false
        const assessment = Array.isArray(row.assessments) ? row.assessments[0] : row.assessments
        return mapReference(v, isDefault, [{ id: row.assessment_id, title: assessment?.title ?? 'Assessment', isDefault }])
      }),
    })),
  }
}

export async function getAssessmentReferenceDefault(assessmentId: string, clientId: string | null): Promise<string | null> {
  const db = createAdminClient()
  const { data, error } = await db.from('assessment_norm_references').select('reference_version_id,norm_reference_versions(status,scope_client_id)').eq('assessment_id', assessmentId).eq('is_default', true).maybeSingle()
  if (error) throw new Error('Unable to load the assessment reference default')
  if (!data) return null
  const ref = Array.isArray(data.norm_reference_versions) ? data.norm_reference_versions[0] : data.norm_reference_versions
  if (ref?.status !== 'active' || (ref.scope_client_id && ref.scope_client_id !== clientId)) return null
  return data.reference_version_id
}
