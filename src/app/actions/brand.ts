'use server'

import { requireWorkspaceFeature, requirePartnerWorkspaceFeature } from '@/lib/features/access'

import { revalidatePath, revalidateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBrandConfig, getCachedEffectiveBrand, getClientPartnerId } from '@/lib/dal/brand'
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
import { brandConfigSchema, brandOverridesSchema } from '@/lib/validations/brand'
import { isEmptyOverrides } from '@/lib/brand/merge'
import type { BrandConfig, BrandOwnerType } from '@/lib/brand/types'
// TRAJECTAS_DEFAULTS is applied inside mergeBrandLayers — no direct use here.

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

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
  if (ownerType === 'campaign') await requireWorkspaceFeature('campaignBranding')

  if (ownerType === 'client' && ownerId) {
    await requirePartnerWorkspaceFeature('clientManagement', ownerId)
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
 * D5 gate for brand WRITES, applied to every layer whose content a client
 * ultimately wears: the client layer itself and the campaign layer beneath it.
 *
 * The campaign layer matters as much as the client layer — a campaign brand
 * override is what a participant actually sees — so a partner whose
 * `can_customize_branding` flag is off must not be able to reach it by
 * addressing the campaign directly. Platform and partner layers are governed
 * by `assertCanManageBrandOwner` alone.
 */
async function assertBrandLayerEditable(
  scope: Awaited<ReturnType<typeof resolveAuthorizedScope>>,
  ownerType: BrandOwnerType,
  ownerId: string | null
): Promise<void> {
  if (!ownerId) return

  if (ownerType === 'client') {
    await assertCanEditClientBrand(scope, ownerId)
    return
  }

  if (ownerType === 'campaign') {
    const db = createAdminClient()
    const { data: campaign } = await db
      .from('campaigns')
      .select('client_id')
      .eq('id', ownerId)
      .single()
    const clientId = campaign?.client_id ? String(campaign.client_id) : null
    // A platform-owned campaign has no client flags to honour; reaching here at
    // all already required admin rights via assertCanManageBrandOwner.
    if (clientId) await assertCanEditClientBrand(scope, clientId)
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
  // D5: a partner admin edits a client/campaign brand only while the partner
  // flag is on; a client admin only while both flags are on. Platform admins
  // always.
  await assertBrandLayerEditable(scope, ownerType, ownerId)
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
  await assertBrandLayerEditable(scope, ownerType, ownerId)
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
