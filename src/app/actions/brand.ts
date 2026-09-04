'use server'

import { unstable_cache, revalidatePath, revalidateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  assertAdminOnly,
  AuthorizationError,
  canManageCampaign,
  canManageClient,
  canManagePartner,
  resolveAuthorizedScope,
} from '@/lib/auth/authorization'
import { logAuditEvent } from '@/lib/auth/support-sessions'
import { assertCanEditClientBrand } from '@/lib/brand/brand-write-authorization'
import { mapBrandConfigRow } from '@/lib/supabase/mappers'
import { brandConfigSchema, brandOverridesSchema } from '@/lib/validations/brand'
import { mergeBrandLayers, isEmptyOverrides } from '@/lib/brand/merge'
import type { BrandConfig, BrandConfigRecord, BrandOwnerType } from '@/lib/brand/types'
// TRAJECTAS_DEFAULTS is applied inside mergeBrandLayers — no direct use here.

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

async function getBrandConfigImpl(
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
 * Get a brand config by owner type and ID.
 * Returns null if no config exists for this owner.
 *
 * Uses admin client because this is called from contexts without a user
 * session: report runner (background), integrations service, email
 * sending, and participant-facing assessment pages.
 *
 * Wrapped in unstable_cache with tag 'brand' — save/update flows in this
 * file invalidate that tag, so cached reads stay correct.
 */
export const getBrandConfig = unstable_cache(
  getBrandConfigImpl,
  ['brand-config'],
  {
    revalidate: 300,
    tags: ['brand'],
  }
)

/**
 * Get the platform default brand config.
 *
 * Uses admin client — called transitively from no-session contexts
 * (see getBrandConfig).
 */
async function getPlatformBrand(): Promise<BrandConfigRecord | null> {
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
 * Layers are MERGED per top-level field, ascending specificity:
 *   TRAJECTAS_DEFAULTS ← platform ← partner ← client ← campaign
 *
 * A layer only affects the fields it defines — a campaign that overrides
 * just `primaryColor` inherits everything else from its client/partner/
 * platform chain. Nested groups (semanticColors, reportTheme, typography,
 * …) are atomic units; see src/lib/brand/merge.ts.
 *
 * Always returns a complete BrandConfig.
 */
export async function getEffectiveBrand(
  clientId?: string | null,
  campaignId?: string | null,
): Promise<BrandConfig> {
  const [platform, partnerId, clientBrand, campaignBrand] = await Promise.all([
    getCachedPlatformBrand(),
    clientId ? getClientPartnerId(clientId) : Promise.resolve(null),
    clientId ? getBrandConfig('client', clientId) : Promise.resolve(null),
    campaignId ? getBrandConfig('campaign', campaignId) : Promise.resolve(null),
  ])

  const partnerBrand = partnerId
    ? await getBrandConfig('partner', partnerId)
    : null

  return mergeBrandLayers([
    platform?.config,
    partnerBrand?.config,
    clientBrand?.config,
    campaignBrand?.config,
  ])
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
 * Get the effective brand for a client, for use in preview contexts.
 * Can be called from client components.
 *
 * Gated on authority over the client (platform admin, or an admin of the
 * client), not platform-admin-only — matching how brand configs are managed
 * (see assertCanManageBrandOwner). Today the only caller is the platform
 * experience editor's "Preview as" selector, which is admin-surfaced; but on
 * the single-host model client/partner org-admins are not platform_admin, so
 * a bare requireAdminScope() here would throw for them if this preview were
 * ever surfaced in a client/partner portal.
 */
export async function getClientBrandForPreview(clientId: string): Promise<BrandConfig> {
  const scope = await resolveAuthorizedScope()
  await assertCanManageBrandOwner(scope, 'client', clientId)
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
 * Assert the caller may manage branding for the given owner.
 *
 * Campaign branding is manageable by admins of the campaign's client or
 * partner (matching the campaign detail surface), not only platform admins.
 */
async function assertCanManageBrandOwner(
  scope: Awaited<ReturnType<typeof resolveAuthorizedScope>>,
  ownerType: BrandOwnerType,
  ownerId: string | null
): Promise<void> {
  if (ownerType === 'client' && ownerId) {
    if (!canManageClient(scope, ownerId)) {
      throw new AuthorizationError('Not authorized to manage this client')
    }
  } else if (ownerType === 'partner' && ownerId) {
    if (!canManagePartner(scope, ownerId)) {
      throw new AuthorizationError('Not authorized to manage this partner')
    }
  } else if (ownerType === 'campaign' && ownerId) {
    const db = createAdminClient()
    const { data: campaign } = await db
      .from('campaigns')
      .select('client_id')
      .eq('id', ownerId)
      .single()
    const clientId = campaign?.client_id ? String(campaign.client_id) : null
    const partnerId = clientId ? await getClientPartnerId(clientId) : null
    if (!clientId || !canManageCampaign(scope, partnerId, clientId)) {
      throw new AuthorizationError('Not authorized to manage this campaign')
    }
  } else {
    assertAdminOnly(scope)
  }
}

/**
 * Create or update a brand config.
 *
 * The platform config must be complete (it is the merge base); partner/
 * client/campaign configs are partial override layers — only the fields the
 * owner has customized. Saving an empty override set for a non-platform
 * owner is equivalent to resetting to inherited: any existing row is
 * soft-deleted.
 */
export async function upsertBrandConfig(
  ownerType: BrandOwnerType,
  ownerId: string | null,
  configInput: unknown
): Promise<{ error?: Record<string, string[]> }> {
  const scope = await resolveAuthorizedScope()
  await assertCanManageBrandOwner(scope, ownerType, ownerId)
  if (ownerType === 'client' && ownerId) {
    // D5: a partner admin edits a client's brand only while the partner flag is
    // on; a client admin only while both flags are on. Platform admins always.
    await assertCanEditClientBrand(scope, ownerId)
  }
  const schema = ownerType === 'platform' ? brandConfigSchema : brandOverridesSchema
  const parsed = schema.safeParse(configInput)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors as Record<string, string[]> }
  }

  const config = parsed.data

  // No overrides left for a non-platform owner → same as reset to inherited.
  if (ownerType !== 'platform' && isEmptyOverrides(config)) {
    const result = await resetBrandToDefault(ownerType, ownerId)
    return result.error ? { error: { _form: [result.error] } } : {}
  }

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
    revalidatePath('/client/settings/brand')
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
  await assertCanManageBrandOwner(scope, ownerType, ownerId)
  if (ownerType === 'client' && ownerId) {
    // D5: a partner admin edits a client's brand only while the partner flag is
    // on; a client admin only while both flags are on. Platform admins always.
    await assertCanEditClientBrand(scope, ownerId)
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
    revalidatePath('/client/settings/brand')
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
