import 'server-only'

import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { mapBrandConfigRow } from '@/lib/supabase/mappers'
import { mergeBrandLayers } from '@/lib/brand/merge'
import type { BrandConfig, BrandConfigRecord, BrandOwnerType } from '@/lib/brand/types'

// Internal rendering/background reads. Do not export these from a use-server
// module: arbitrary tenant IDs must never become unauthenticated RPC inputs.
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

export async function getClientPartnerId(clientId: string) {
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

export const getCachedEffectiveBrand = unstable_cache(
  async (clientId?: string | null, campaignId?: string | null) =>
    getEffectiveBrand(clientId, campaignId),
  ['effective-brand'],
  {
    revalidate: 300,
    tags: ['brand'],
  }
)

