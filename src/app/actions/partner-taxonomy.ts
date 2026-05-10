'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePartnerAccess } from '@/lib/auth/authorization'
import { throwActionError } from '@/lib/security/action-errors'
import { revalidatePath } from 'next/cache'
import {
  getPartnerTaxonomyAssignmentsSchema,
  togglePartnerTaxonomyAssignmentSchema,
  bulkTogglePartnerTaxonomyAssignmentsSchema,
} from '@/lib/validations/partner-taxonomy'

type EntityType = 'dimension' | 'factor' | 'construct'

export interface TaxonomyAssignmentRow {
  id: string
  name: string
  slug: string
  dimensionName?: string
  factorName?: string
  assigned: boolean
}

export async function getPartnerTaxonomyAssignments(
  partnerId: string,
  entityType: EntityType,
): Promise<TaxonomyAssignmentRow[]> {
  const parsed = getPartnerTaxonomyAssignmentsSchema.safeParse({ partnerId, entityType })
  if (!parsed.success) return []
  await requirePartnerAccess(partnerId)
  const db = await createClient()

  // Get all active, non-deleted entities of this type
  let query
  if (entityType === 'dimension') {
    query = db
      .from('dimensions')
      .select('id, name, slug')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name')
  } else if (entityType === 'factor') {
    query = db
      .from('factors')
      .select('id, name, slug, dimension_id, dimensions(name)')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name')
  } else {
    // constructs — join through factor_constructs to get factor and dimension names
    query = db
      .from('constructs')
      .select('id, name, slug, factor_constructs(factors(id, name, dimensions(name)))')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name')
  }

  const { data: entities, error: entitiesError } = await query

  if (entitiesError) {
    throwActionError(
      'getPartnerTaxonomyAssignments',
      'Unable to load taxonomy entities.',
      entitiesError,
    )
  }

  // Get assignments for this partner + entity type
  const { data: assignments, error: assignError } = await db
    .from('partner_taxonomy_assignments')
    .select('entity_id')
    .eq('partner_id', partnerId)
    .eq('entity_type', entityType)
    .eq('is_active', true)

  if (assignError) {
    throwActionError(
      'getPartnerTaxonomyAssignments',
      'Unable to load assignments.',
      assignError,
    )
  }

  const assignedIds = new Set((assignments ?? []).map((a) => a.entity_id))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (entities ?? []).map((entity: any) => {
    // For factors, extract dimension name from join
    const dimensionName = entity.dimensions?.name ?? undefined
    // For constructs, extract factor and dimension names from factor_constructs join
    const fc = entity.factor_constructs?.[0]
    const factor = Array.isArray(fc?.factors) ? fc.factors[0] : fc?.factors
    const factorName = factor?.name ?? undefined
    const constructDimensionName =
      factor?.dimensions?.name ?? dimensionName ?? undefined

    return {
      id: entity.id,
      name: entity.name,
      slug: entity.slug,
      dimensionName: constructDimensionName,
      factorName,
      assigned: assignedIds.has(entity.id),
    }
  })
}

export async function togglePartnerTaxonomyAssignment(
  partnerId: string,
  entityType: EntityType,
  entityId: string,
  assigned: boolean,
): Promise<{ success: true } | { error: string }> {
  const parsed = togglePartnerTaxonomyAssignmentSchema.safeParse({ partnerId, entityType, entityId, assigned })
  if (!parsed.success) return { error: 'Invalid input' }
  const { scope } = await requirePartnerAccess(partnerId)
  if (!scope.isPlatformAdmin) {
    return {
      error: 'Only platform administrators can manage taxonomy assignments.',
    }
  }
  if (!scope.actor?.id) {
    return { error: 'Unable to determine the acting user.' }
  }

  const db = createAdminClient()

  if (assigned) {
    const { error } = await db
      .from('partner_taxonomy_assignments')
      .upsert(
        {
          partner_id: partnerId,
          entity_type: entityType,
          entity_id: entityId,
          is_active: true,
          assigned_by: scope.actor.id,
        },
        { onConflict: 'partner_id,entity_type,entity_id' },
      )

    if (error) return { error: error.message }
  } else {
    const { error } = await db
      .from('partner_taxonomy_assignments')
      .update({ is_active: false })
      .eq('partner_id', partnerId)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)

    if (error) return { error: error.message }
  }

  revalidatePath('/partners')
  return { success: true }
}

export async function bulkTogglePartnerTaxonomyAssignments(
  partnerId: string,
  entityType: EntityType,
  entityIds: string[],
  assigned: boolean,
): Promise<{ success: true } | { error: string }> {
  if (entityIds.length === 0) return { success: true }
  const parsed = bulkTogglePartnerTaxonomyAssignmentsSchema.safeParse({ partnerId, entityType, entityIds, assigned })
  if (!parsed.success) return { error: 'Invalid input' }
  const { scope } = await requirePartnerAccess(partnerId)
  if (!scope.isPlatformAdmin) {
    return {
      error: 'Only platform administrators can manage taxonomy assignments.',
    }
  }
  if (!scope.actor?.id) {
    return { error: 'Unable to determine the acting user.' }
  }

  const db = createAdminClient()

  if (assigned) {
    const rows = entityIds.map((entityId) => ({
      partner_id: partnerId,
      entity_type: entityType,
      entity_id: entityId,
      is_active: true,
      assigned_by: scope.actor!.id,
    }))

    const { error } = await db
      .from('partner_taxonomy_assignments')
      .upsert(rows, { onConflict: 'partner_id,entity_type,entity_id' })

    if (error) return { error: error.message }
  } else {
    const { error } = await db
      .from('partner_taxonomy_assignments')
      .update({ is_active: false })
      .eq('partner_id', partnerId)
      .eq('entity_type', entityType)
      .in('entity_id', entityIds)

    if (error) return { error: error.message }
  }

  revalidatePath('/partners')
  return { success: true }
}
