'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCampaignAccess } from '@/lib/auth/authorization'
import { revalidatePath } from 'next/cache'
import { throwActionError } from '@/lib/security/action-errors'
import { getItemsPerConstructForCount } from '@/app/actions/item-selection-rules'

// =============================================================================
// 1. Get factor selection for a campaign-assessment
// =============================================================================

export async function getFactorSelectionForCampaignAssessment(
  campaignAssessmentId: string,
): Promise<{ isCustom: boolean; selectedFactorIds: string[] }> {
  const db = await createClient()
  const { data } = await db
    .from('campaign_assessment_factors')
    .select('factor_id')
    .eq('campaign_assessment_id', campaignAssessmentId)

  if (!data || data.length === 0) {
    return { isCustom: false, selectedFactorIds: [] }
  }

  return {
    isCustom: true,
    selectedFactorIds: data.map((r) => r.factor_id),
  }
}

// =============================================================================
// 2. Get factors for an assessment (grouped by dimension)
// =============================================================================

export async function getFactorsForAssessment(assessmentId: string): Promise<
  Array<{
    dimensionId: string | null
    dimensionName: string | null
    factors: Array<{
      factorId: string
      factorName: string
      factorDescription: string | null
      constructCount: number
    }>
  }>
> {
  const db = await createClient()

  // Step 1: Get factor IDs for this assessment
  const { data: afRows, error: afError } = await db
    .from('assessment_factors')
    .select('factor_id')
    .eq('assessment_id', assessmentId)

  if (afError) {
    throwActionError('getFactorsForAssessment', 'Failed to load assessment factors.', afError)
  }

  const factorIds = (afRows ?? []).map((r) => r.factor_id)
  if (factorIds.length === 0) return []

  // Steps 2 & 3 are independent of each other, so issue them in parallel —
  // the whole action runs as part of the quick-launch prefetch and every
  // round-trip saved is a round-trip off the Next button's wait.
  const [
    { data: factorRows, error: factorError },
    { data: fcRows, error: fcError },
  ] = await Promise.all([
    db
      .from('factors')
      .select('id, name, description, dimension_id, dimensions(id, name)')
      .in('id', factorIds)
      .is('deleted_at', null)
      .order('name'),
    db
      .from('factor_constructs')
      .select('factor_id, construct_id')
      .in('factor_id', factorIds),
  ])

  if (factorError) {
    throwActionError('getFactorsForAssessment', 'Failed to load factors.', factorError)
  }

  if (fcError) {
    throwActionError('getFactorsForAssessment', 'Failed to load factor constructs.', fcError)
  }

  const constructCountByFactor = new Map<string, number>()
  for (const fc of fcRows ?? []) {
    constructCountByFactor.set(
      fc.factor_id,
      (constructCountByFactor.get(fc.factor_id) ?? 0) + 1,
    )
  }

  // Step 4: Group by dimension
  const grouped = new Map<
    string,
    {
      dimensionId: string | null
      dimensionName: string | null
      factors: Array<{
        factorId: string
        factorName: string
        factorDescription: string | null
        constructCount: number
      }>
    }
  >()

  for (const row of factorRows ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dim = (row as any).dimensions as { id: string; name: string } | null
    const dimKey = dim?.id ?? '__none__'

    if (!grouped.has(dimKey)) {
      grouped.set(dimKey, {
        dimensionId: dim?.id ?? null,
        dimensionName: dim?.name ?? null,
        factors: [],
      })
    }

    grouped.get(dimKey)!.factors.push({
      factorId: row.id,
      factorName: row.name,
      factorDescription: row.description ?? null,
      constructCount: constructCountByFactor.get(row.id) ?? 0,
    })
  }

  return Array.from(grouped.values())
}

// =============================================================================
// 3. Save factor selection
// =============================================================================

export async function saveFactorSelection(
  campaignAssessmentId: string,
  factorIds: string[],
): Promise<{ success: true }> {
  // Look up the campaign_assessment to get campaign_id and assessment_id
  const admin = createAdminClient()
  const { data: ca, error: caError } = await admin
    .from('campaign_assessments')
    .select('campaign_id, assessment_id')
    .eq('id', campaignAssessmentId)
    .single()

  if (caError || !ca) {
    throwActionError('saveFactorSelection', 'Campaign assessment not found.', caError)
  }

  // Auth check
  await requireCampaignAccess(ca.campaign_id)

  // Verify assessment has min_custom_factors set
  const { data: assessment, error: assessmentError } = await admin
    .from('assessments')
    .select('min_custom_factors')
    .eq('id', ca.assessment_id)
    .single()

  if (assessmentError || !assessment) {
    throwActionError('saveFactorSelection', 'Assessment not found.', assessmentError)
  }

  const minFactors = assessment.min_custom_factors
  if (minFactors == null) {
    throw new Error('This assessment does not support factor customisation.')
  }

  // Verify factorIds.length >= min_custom_factors
  if (factorIds.length < minFactors) {
    throw new Error(
      `At least ${minFactors} factor${minFactors === 1 ? '' : 's'} must be selected.`,
    )
  }

  // Verify all factorIds are valid assessment_factors for this assessment
  const { data: validFactors, error: vfError } = await admin
    .from('assessment_factors')
    .select('factor_id')
    .eq('assessment_id', ca.assessment_id)
    .in('factor_id', factorIds)

  if (vfError) {
    throwActionError('saveFactorSelection', 'Failed to validate factors.', vfError)
  }

  const validFactorIds = new Set((validFactors ?? []).map((r) => r.factor_id))
  const invalid = factorIds.filter((id) => !validFactorIds.has(id))
  if (invalid.length > 0) {
    throw new Error(`Invalid factor IDs: ${invalid.join(', ')}`)
  }

  // Delete existing + insert new rows
  const { error: deleteError } = await admin
    .from('campaign_assessment_factors')
    .delete()
    .eq('campaign_assessment_id', campaignAssessmentId)

  if (deleteError) {
    throwActionError('saveFactorSelection', 'Failed to clear existing selection.', deleteError)
  }

  const inserts = factorIds.map((factorId) => ({
    campaign_assessment_id: campaignAssessmentId,
    factor_id: factorId,
  }))

  const { error: insertError } = await admin
    .from('campaign_assessment_factors')
    .insert(inserts)

  if (insertError) {
    throwActionError('saveFactorSelection', 'Failed to save factor selection.', insertError)
  }

  revalidatePath(`/campaigns`)
  return { success: true }
}

// =============================================================================
// 4. Clear factor selection
// =============================================================================

export async function clearFactorSelection(
  campaignAssessmentId: string,
): Promise<{ success: true }> {
  const admin = createAdminClient()

  // Look up campaign_assessment for auth
  const { data: ca, error: caError } = await admin
    .from('campaign_assessments')
    .select('campaign_id')
    .eq('id', campaignAssessmentId)
    .single()

  if (caError || !ca) {
    throwActionError('clearFactorSelection', 'Campaign assessment not found.', caError)
  }

  await requireCampaignAccess(ca.campaign_id)

  const { error: deleteError } = await admin
    .from('campaign_assessment_factors')
    .delete()
    .eq('campaign_assessment_id', campaignAssessmentId)

  if (deleteError) {
    throwActionError('clearFactorSelection', 'Failed to clear factor selection.', deleteError)
  }

  revalidatePath(`/campaigns`)
  return { success: true }
}

// =============================================================================
// 5. Get factor selection estimate
// =============================================================================

export async function getFactorSelectionEstimate(constructCount: number): Promise<{
  itemsPerConstruct: number
  estimatedItems: number
  estimatedMinutes: number
}> {
  const itemsPerConstruct = (await getItemsPerConstructForCount(constructCount)) ?? 0

  const estimatedItems = constructCount * itemsPerConstruct
  const estimatedMinutes = Math.ceil((estimatedItems * 8) / 60)

  return {
    itemsPerConstruct,
    estimatedItems,
    estimatedMinutes,
  }
}
