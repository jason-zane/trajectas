'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCampaignAccess } from '@/lib/auth/authorization'
import { revalidatePath } from 'next/cache'
import { throwActionError } from '@/lib/security/action-errors'

// =============================================================================
// 1. Get construct selection for a campaign-assessment
// =============================================================================

export async function getConstructSelectionForCampaignAssessment(
  campaignAssessmentId: string,
): Promise<{ isCustom: boolean; selectedConstructIds: string[] }> {
  const db = await createClient()
  const { data } = await db
    .from('campaign_assessment_constructs')
    .select('construct_id')
    .eq('campaign_assessment_id', campaignAssessmentId)

  if (!data || data.length === 0) {
    return { isCustom: false, selectedConstructIds: [] }
  }

  return {
    isCustom: true,
    selectedConstructIds: data.map((r) => r.construct_id),
  }
}

// =============================================================================
// 2. Get constructs for a construct-level assessment (grouped by dimension)
// =============================================================================

export async function getConstructsForAssessment(assessmentId: string): Promise<
  Array<{
    dimensionId: string | null
    dimensionName: string | null
    constructs: Array<{
      constructId: string
      constructName: string
      constructDescription: string | null
    }>
  }>
> {
  const db = await createClient()

  const { data: acRows, error: acError } = await db
    .from('assessment_constructs')
    .select('construct_id, dimension_id')
    .eq('assessment_id', assessmentId)

  if (acError) {
    throwActionError('getConstructsForAssessment', 'Failed to load assessment constructs.', acError)
  }

  const constructIds = (acRows ?? []).map((r) => r.construct_id)
  if (constructIds.length === 0) return []

  const { data: constructRows, error: constructError } = await db
    .from('constructs')
    .select('id, name, description')
    .in('id', constructIds)
    .is('deleted_at', null)
    .order('name')

  if (constructError) {
    throwActionError('getConstructsForAssessment', 'Failed to load constructs.', constructError)
  }

  // Build construct → dimension mapping from assessment_constructs
  const dimensionMap = new Map<string, string>()
  for (const row of acRows ?? []) {
    if (row.dimension_id) {
      dimensionMap.set(row.construct_id, row.dimension_id)
    }
  }

  // Load dimension names
  const dimIds = [...new Set(dimensionMap.values())]
  const { data: dimRows } =
    dimIds.length > 0
      ? await db.from('dimensions').select('id, name').in('id', dimIds)
      : { data: [] }

  const dimNameMap = new Map<string, string>()
  for (const d of dimRows ?? []) {
    dimNameMap.set(d.id, d.name)
  }

  // Group by dimension
  const grouped = new Map<
    string,
    {
      dimensionId: string | null
      dimensionName: string | null
      constructs: Array<{
        constructId: string
        constructName: string
        constructDescription: string | null
      }>
    }
  >()

  for (const row of constructRows ?? []) {
    const dimId = dimensionMap.get(row.id) ?? null
    const dimKey = dimId ?? '__none__'

    if (!grouped.has(dimKey)) {
      grouped.set(dimKey, {
        dimensionId: dimId,
        dimensionName: dimId ? (dimNameMap.get(dimId) ?? null) : null,
        constructs: [],
      })
    }

    grouped.get(dimKey)!.constructs.push({
      constructId: row.id,
      constructName: row.name,
      constructDescription: row.description ?? null,
    })
  }

  return Array.from(grouped.values())
}

// =============================================================================
// 3. Save construct selection
// =============================================================================

export async function saveConstructSelection(
  campaignAssessmentId: string,
  constructIds: string[],
): Promise<{ success: true }> {
  const admin = createAdminClient()
  const { data: ca, error: caError } = await admin
    .from('campaign_assessments')
    .select('campaign_id, assessment_id')
    .eq('id', campaignAssessmentId)
    .single()

  if (caError || !ca) {
    throwActionError('saveConstructSelection', 'Campaign assessment not found.', caError)
  }

  await requireCampaignAccess(ca.campaign_id)

  const { data: assessment, error: assessmentError } = await admin
    .from('assessments')
    .select('min_custom_constructs, scoring_level')
    .eq('id', ca.assessment_id)
    .single()

  if (assessmentError || !assessment) {
    throwActionError('saveConstructSelection', 'Assessment not found.', assessmentError)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((assessment as any).scoring_level !== 'construct') {
    throw new Error('This assessment does not use construct-level scoring.')
  }

  const minConstructs = assessment.min_custom_constructs
  if (minConstructs == null) {
    throw new Error('This assessment does not support construct customisation.')
  }

  if (constructIds.length < minConstructs) {
    throw new Error(
      `At least ${minConstructs} construct${minConstructs === 1 ? '' : 's'} must be selected.`,
    )
  }

  // Verify all constructIds are valid assessment_constructs for this assessment
  const { data: validConstructs, error: vcError } = await admin
    .from('assessment_constructs')
    .select('construct_id')
    .eq('assessment_id', ca.assessment_id)
    .in('construct_id', constructIds)

  if (vcError) {
    throwActionError('saveConstructSelection', 'Failed to validate constructs.', vcError)
  }

  const validConstructIds = new Set((validConstructs ?? []).map((r) => r.construct_id))
  const invalid = constructIds.filter((id) => !validConstructIds.has(id))
  if (invalid.length > 0) {
    throw new Error(`Invalid construct IDs: ${invalid.join(', ')}`)
  }

  // Delete existing + insert new rows
  const { error: deleteError } = await admin
    .from('campaign_assessment_constructs')
    .delete()
    .eq('campaign_assessment_id', campaignAssessmentId)

  if (deleteError) {
    throwActionError('saveConstructSelection', 'Failed to clear existing selection.', deleteError)
  }

  const inserts = constructIds.map((constructId) => ({
    campaign_assessment_id: campaignAssessmentId,
    construct_id: constructId,
  }))

  const { error: insertError } = await admin
    .from('campaign_assessment_constructs')
    .insert(inserts)

  if (insertError) {
    throwActionError('saveConstructSelection', 'Failed to save construct selection.', insertError)
  }

  revalidatePath(`/campaigns`)
  return { success: true }
}

// =============================================================================
// 4. Clear construct selection
// =============================================================================

export async function clearConstructSelection(
  campaignAssessmentId: string,
): Promise<{ success: true }> {
  const admin = createAdminClient()

  const { data: ca, error: caError } = await admin
    .from('campaign_assessments')
    .select('campaign_id')
    .eq('id', campaignAssessmentId)
    .single()

  if (caError || !ca) {
    throwActionError('clearConstructSelection', 'Campaign assessment not found.', caError)
  }

  await requireCampaignAccess(ca.campaign_id)

  const { error: deleteError } = await admin
    .from('campaign_assessment_constructs')
    .delete()
    .eq('campaign_assessment_id', campaignAssessmentId)

  if (deleteError) {
    throwActionError('clearConstructSelection', 'Failed to clear construct selection.', deleteError)
  }

  revalidatePath(`/campaigns`)
  return { success: true }
}
