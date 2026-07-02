import { getBrandConfig, getCachedPlatformBrand } from '@/app/actions/brand'
import { mergeBrandLayers } from '@/lib/brand/merge'
import type { BrandConfig } from '@/lib/brand/types'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Resolve the inherited (parent-merged) brand for a given scope — the brand
 * an entity would render with if it had no overrides of its own.
 *
 * For clients:  defaults ← platform ← partner
 * For partners: defaults ← platform
 *
 * Layers are MERGED per top-level field (see src/lib/brand/merge.ts), so a
 * partner that overrides only its logo still inherits platform colors.
 * The editors use this as the baseline against which per-field overrides
 * are diffed and displayed.
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
  const [{ data: client }, platform] = await Promise.all([
    db.from('clients').select('partner_id').eq('id', clientId).single(),
    getCachedPlatformBrand(),
  ])

  const partnerBrand = client?.partner_id
    ? await getBrandConfig('partner', client.partner_id)
    : null

  return mergeBrandLayers([platform?.config, partnerBrand?.config])
}

async function resolvePartnerInheritedBrand(): Promise<BrandConfig> {
  const platform = await getCachedPlatformBrand()
  return mergeBrandLayers([platform?.config])
}
