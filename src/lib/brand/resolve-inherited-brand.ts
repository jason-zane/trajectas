import { getBrandConfig, getCachedPlatformBrand } from '@/app/actions/brand'
import { TRAJECTAS_DEFAULTS } from '@/lib/brand/defaults'
import type { BrandConfig } from '@/lib/brand/types'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Resolve the inherited brand config for a given scope (client or partner).
 *
 * For clients: partner → platform → defaults
 * For partners: platform → defaults
 *
 * Clients can inherit from their partner if one exists, cascading to platform defaults.
 * Partners only have platform defaults to inherit from.
 */
export async function resolveInheritedBrand(
  scope: 'client' | 'partner',
  entityId: string
): Promise<BrandConfig> {
  if (scope === 'client') {
    return resolveClientInheritedBrand(entityId)
  } else {
    return resolvePartnerInheritedBrand()
  }
}

async function resolveClientInheritedBrand(clientId: string): Promise<BrandConfig> {
  const db = createAdminClient()
  const { data: client } = await db
    .from('clients')
    .select('partner_id')
    .eq('id', clientId)
    .single()

  // Try partner first if client has one
  if (client?.partner_id) {
    const partnerBrand = await getBrandConfig('partner', client.partner_id)
    if (partnerBrand) {
      return partnerBrand.config
    }
  }

  // Fall back to platform defaults
  const platform = await getCachedPlatformBrand()
  return platform?.config ?? (TRAJECTAS_DEFAULTS as BrandConfig)
}

async function resolvePartnerInheritedBrand(): Promise<BrandConfig> {
  // Partners only inherit from platform defaults
  const platform = await getCachedPlatformBrand()
  return platform?.config ?? (TRAJECTAS_DEFAULTS as BrandConfig)
}
