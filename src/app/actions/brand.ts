'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminScope } from '@/lib/auth/authorization'
import { logAuditEvent } from '@/lib/auth/support-sessions'
import { mapBrandConfigRow } from '@/lib/supabase/mappers'
import { brandConfigSchema } from '@/lib/validations/brand'
import { TALENT_FIT_DEFAULTS } from '@/lib/brand/defaults'
import type { BrandConfig, BrandConfigRecord, BrandOwnerType } from '@/lib/brand/types'

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Get a brand config by owner type and ID.
 * Returns null if no config exists for this owner.
 */
export async function getBrandConfig(
  ownerType: BrandOwnerType,
  ownerId: string | null
): Promise<BrandConfigRecord | null> {
  const db = createAdminClient()

  let query = db
    .from('brand_configs')
    .select('*')
    .eq('owner_type', ownerType)
    .is('deleted_at', null)

  if (ownerId) {
    query = query.eq('owner_id', ownerId)
  } else {
    query = query.is('owner_id', null)
  }

  const { data, error } = await query.single()
  if (error) return null
  return mapBrandConfigRow(data)
}

/**
 * Get the platform default brand config.
 */
export async function getPlatformBrand(): Promise<BrandConfigRecord | null> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('brand_configs')
    .select('*')
    .eq('owner_type', 'platform')
    .eq('is_default', true)
    .is('deleted_at', null)
    .single()

  if (error) return null
  return mapBrandConfigRow(data)
}

/**
 * Resolve the effective brand for a given organization.
 *
 * Resolution order:
 * 1. Organization-specific config (if exists)
 * 2. Platform default config
 * 3. Hardcoded defaults (fallback)
 */
export async function getEffectiveBrand(orgId?: string | null): Promise<BrandConfig> {
  // Try org-specific first
  if (orgId) {
    const orgBrand = await getBrandConfig('organization', orgId)
    if (orgBrand) return orgBrand.config
  }

  // Fall back to platform default
  const platform = await getPlatformBrand()
  if (platform) return platform.config

  // Ultimate fallback: hardcoded defaults
  return { ...TALENT_FIT_DEFAULTS }
}

/**
 * Get the effective brand with metadata (includes record ID for editing).
 */
export async function getEffectiveBrandRecord(
  ownerType: BrandOwnerType,
  ownerId: string | null
): Promise<BrandConfigRecord | null> {
  // Try the specific owner first
  const specific = await getBrandConfig(ownerType, ownerId)
  if (specific) return specific

  // Fall back to platform default for org owners
  if (ownerType === 'organization') {
    return getPlatformBrand()
  }

  return null
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Create or update a brand config.
 */
export async function upsertBrandConfig(
  ownerType: BrandOwnerType,
  ownerId: string | null,
  configInput: unknown
): Promise<{ error?: Record<string, string[]> }> {
  const scope = await requireAdminScope()
  const parsed = brandConfigSchema.safeParse(configInput)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors as Record<string, string[]> }
  }

  const config = parsed.data
  const db = createAdminClient()

  // Check if a config already exists for this owner
  const existing = await getBrandConfig(ownerType, ownerId)

  if (existing) {
    // Update existing
    const { error } = await db
      .from('brand_configs')
      .update({ config })
      .eq('id', existing.id)

    if (error) return { error: { _form: [error.message] } }
  } else {
    // Insert new
    const { error } = await db
      .from('brand_configs')
      .insert({
        owner_type: ownerType,
        owner_id: ownerId,
        config,
        is_default: ownerType === 'platform',
      })

    if (error) return { error: { _form: [error.message] } }
  }

  revalidatePath('/settings/brand')
  if (ownerId) {
    revalidatePath(`/organizations`)
  }

  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'brand_config.upserted',
    targetTable: 'brand_configs',
    targetId: existing?.id ?? null,
    clientId: ownerType === 'organization' ? ownerId : null,
    metadata: {
      ownerType,
      ownerId,
      isDefault: ownerType === 'platform',
    },
  })

  return {}
}

/**
 * Reset an organization's brand config to use platform defaults.
 * Soft-deletes the org-specific config.
 */
export async function resetBrandToDefault(
  ownerType: BrandOwnerType,
  ownerId: string | null
): Promise<{ error?: string }> {
  const scope = await requireAdminScope()
  if (ownerType === 'platform') {
    return { error: 'Cannot reset platform brand — edit it instead.' }
  }

  const existing = await getBrandConfig(ownerType, ownerId)
  if (!existing) return {} // Nothing to reset

  const db = createAdminClient()
  const { error } = await db
    .from('brand_configs')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', existing.id)

  if (error) return { error: error.message }

  revalidatePath('/settings/brand')
  if (ownerId) {
    revalidatePath(`/organizations`)
  }

  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'brand_config.reset_to_default',
    targetTable: 'brand_configs',
    targetId: existing.id,
    clientId: ownerType === 'organization' ? ownerId : null,
    metadata: {
      ownerType,
      ownerId,
    },
  })

  return {}
}
