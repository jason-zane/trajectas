'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminScope } from '@/lib/auth/authorization'
import { revalidatePath } from 'next/cache'
import { throwActionError } from '@/lib/security/action-errors'

/**
 * Get all construct links for a dimension.
 */
export async function getDimensionConstructs(dimensionId: string) {
  await requireAdminScope()
  const db = createAdminClient()

  const { data, error } = await db
    .from('dimension_constructs')
    .select('id, construct_id, weight, display_order, constructs(id, name, slug)')
    .eq('dimension_id', dimensionId)
    .order('display_order')

  if (error) {
    throwActionError('getDimensionConstructs', 'Failed to load dimension constructs.', error)
  }

  return data ?? []
}

/**
 * Get all dimension links for a construct.
 */
export async function getConstructDimensions(constructId: string) {
  await requireAdminScope()
  const db = createAdminClient()

  const { data, error } = await db
    .from('dimension_constructs')
    .select('id, dimension_id, weight, display_order, dimensions(id, name, slug)')
    .eq('construct_id', constructId)
    .order('display_order')

  if (error) {
    throwActionError('getConstructDimensions', 'Failed to load construct dimensions.', error)
  }

  return data ?? []
}

/**
 * Link a construct to a dimension.
 */
export async function linkConstructToDimension(
  dimensionId: string,
  constructId: string,
  weight: number = 1.0,
  displayOrder: number = 0,
) {
  await requireAdminScope()
  const db = createAdminClient()

  const { error } = await db.from('dimension_constructs').upsert(
    {
      dimension_id: dimensionId,
      construct_id: constructId,
      weight,
      display_order: displayOrder,
    },
    { onConflict: 'dimension_id,construct_id' },
  )

  if (error) {
    throwActionError('linkConstructToDimension', 'Failed to link construct to dimension.', error)
  }

  revalidatePath('/dimensions')
  revalidatePath('/constructs')
}

/**
 * Unlink a construct from a dimension.
 */
export async function unlinkConstructFromDimension(dimensionId: string, constructId: string) {
  await requireAdminScope()
  const db = createAdminClient()

  const { error } = await db
    .from('dimension_constructs')
    .delete()
    .eq('dimension_id', dimensionId)
    .eq('construct_id', constructId)

  if (error) {
    throwActionError('unlinkConstructFromDimension', 'Failed to unlink construct.', error)
  }

  revalidatePath('/dimensions')
  revalidatePath('/constructs')
}

/**
 * Update weight/order of a dimension-construct link.
 */
export async function updateDimensionConstructLink(
  linkId: string,
  updates: { weight?: number; display_order?: number },
) {
  await requireAdminScope()
  const db = createAdminClient()

  const { error } = await db.from('dimension_constructs').update(updates).eq('id', linkId)

  if (error) {
    throwActionError('updateDimensionConstructLink', 'Failed to update link.', error)
  }

  revalidatePath('/dimensions')
  revalidatePath('/constructs')
}
