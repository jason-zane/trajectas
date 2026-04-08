'use server'

import { unstable_cache, revalidatePath, revalidateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  assertAdminOnly,
  AuthorizationError,
  canManageClient,
  canManagePartner,
  requireAdminScope,
  resolveAuthorizedScope,
} from '@/lib/auth/authorization'
import { logAuditEvent } from '@/lib/auth/support-sessions'
import { mapBrandConfigRow } from '@/lib/supabase/mappers'
import { brandConfigSchema } from '@/lib/validations/brand'
import { TRAJECTAS_DEFAULTS } from '@/lib/brand/defaults'
import type { BrandConfig, BrandConfigRecord, BrandOwnerType } from '@/lib/brand/types'

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Get a brand config by owner type and ID.
 * Returns null if no config exists for this owner.
 *
 * Uses admin client because this is called from contexts without a user
 * session: report runner (background), integrations service, email
 * sending, and participant-facing assessment pages.
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
 *
 * Uses admin client — called transitively from no-session contexts
 * (see getBrandConfig).
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

export const getCachedPlatformBrand = unstable_cache(
  async () => getPlatformBrand(),
  ['platform-brand'],
  {
    revalidate: 300,
    tags: ['brand'],
  }
)

async function getClientPartnerId(clientId: string) {
  const db = createAdminClient()
  const { data, error } = await db
    .from('clients')
    .select('partner_id')
    .eq('id', clientId)
    .single()

  if (error) return null
  return data?.partner_id ? String(data.partner_id) : null
}

/**
 * Resolve the effective brand for a given context.
 *
 * Resolution order:
 * 1. Campaign-specific config (if campaignId provided)
 * 2. Client-specific config (if clientId provided)
 * 3. Platform default config
 * 4. Hardcoded defaults (fallback)
 */
export async function getEffectiveBrand(
  clientId?: string | null,
  campaignId?: string | null,
): Promise<BrandConfig> {
  // Try campaign-specific first
  if (campaignId) {
    const campaignBrand = await getBrandConfig('campaign', campaignId)
    if (campaignBrand) return campaignBrand.config
  }

  // Try client-specific, then partner-specific
  if (clientId) {
    const orgBrand = await getBrandConfig('client', clientId)
    if (orgBrand) return orgBrand.config

    const partnerId = await getClientPartnerId(clientId)
    if (partnerId) {
      const partnerBrand = await getBrandConfig('partner', partnerId)
      if (partnerBrand) return partnerBrand.config
    }
  }

  // Fall back to platform default
  const platform = await getCachedPlatformBrand()
  if (platform) return platform.config

  // Ultimate fallback: hardcoded defaults
  return { ...TRAJECTAS_DEFAULTS }
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

  if (ownerType === 'client' && ownerId) {
    const partnerId = await getClientPartnerId(ownerId)
    if (partnerId) {
      const partnerBrand = await getBrandConfig('partner', partnerId)
      if (partnerBrand) return partnerBrand
    }

    return getPlatformBrand()
  }

  if (ownerType === 'partner') {
    return getPlatformBrand()
  }

  return null
}

/**
 * Get the effective brand for a client, for use in admin preview contexts.
 * Can be called from client components.
 */
export async function getClientBrandForPreview(clientId: string): Promise<BrandConfig> {
  await requireAdminScope()
  return getCachedEffectiveBrand(clientId)
}

export const getCachedEffectiveBrand = unstable_cache(
  async (clientId?: string | null, campaignId?: string | null) =>
    getEffectiveBrand(clientId, campaignId),
  ['effective-brand'],
  {
    revalidate: 300,
    tags: ['brand'],
  }
)

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
  const scope = await resolveAuthorizedScope()
  if (ownerType === 'client' && ownerId) {
    if (!canManageClient(scope, ownerId)) {
      throw new AuthorizationError('Not authorized to manage this client')
    }
  } else if (ownerType === 'partner' && ownerId) {
    if (!canManagePartner(scope, ownerId)) {
      throw new AuthorizationError('Not authorized to manage this partner')
    }
  } else {
    assertAdminOnly(scope)
  }
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
  if (ownerType === 'client') {
    revalidatePath('/client/settings/brand/client')
  }
  if (ownerType === 'partner') {
    revalidatePath('/partners')
    revalidatePath('/partner/settings/brand')
  }
  if (ownerId) {
    revalidatePath(`/clients`)
  }
  revalidateTag('brand', 'max')

  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'brand_config.upserted',
    targetTable: 'brand_configs',
    targetId: existing?.id ?? null,
    partnerId: ownerType === 'partner' ? ownerId : null,
    clientId: ownerType === 'client' ? ownerId : null,
    metadata: {
      ownerType,
      ownerId,
      isDefault: ownerType === 'platform',
    },
  })

  return {}
}

/**
 * Reset a client's brand config to use platform defaults.
 * Soft-deletes the org-specific config.
 */
export async function resetBrandToDefault(
  ownerType: BrandOwnerType,
  ownerId: string | null
): Promise<{ error?: string }> {
  const scope = await resolveAuthorizedScope()
  if (ownerType === 'client' && ownerId) {
    if (!canManageClient(scope, ownerId)) {
      throw new AuthorizationError('Not authorized to manage this client')
    }
  } else if (ownerType === 'partner' && ownerId) {
    if (!canManagePartner(scope, ownerId)) {
      throw new AuthorizationError('Not authorized to manage this partner')
    }
  } else {
    assertAdminOnly(scope)
  }
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
  if (ownerType === 'client') {
    revalidatePath('/client/settings/brand/client')
  }
  if (ownerType === 'partner') {
    revalidatePath('/partners')
    revalidatePath('/partner/settings/brand')
  }
  if (ownerId) {
    revalidatePath(`/clients`)
  }
  revalidateTag('brand', 'max')

  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'brand_config.reset_to_default',
    targetTable: 'brand_configs',
    targetId: existing.id,
    partnerId: ownerType === 'partner' ? ownerId : null,
    clientId: ownerType === 'client' ? ownerId : null,
    metadata: {
      ownerType,
      ownerId,
    },
  })

  return {}
}
