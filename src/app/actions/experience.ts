'use server'

import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache'
import {
  ParticipantRuntimeAccessError,
  requireParticipantRuntimeParticipantAccess,
} from '@/lib/auth/participant-runtime'
import { requireAdminScope } from '@/lib/auth/authorization'
import { logAuditEvent } from '@/lib/auth/support-sessions'
import { createAdminClient } from '@/lib/supabase/admin'
import { mapExperienceTemplateRow } from '@/lib/supabase/mappers'
import { resolveTemplate } from '@/lib/experience/resolve'
import type {
  ExperienceOwnerType,
  ExperienceTemplate,
  ExperienceTemplateRecord,
  PageContentMap,
  FlowConfig,
  DemographicsConfig,
} from '@/lib/experience/types'

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Get an experience template by owner type and ID.
 *
 * Uses admin client because this is called from participant-facing
 * assessment pages (/assess/[token]/*) which have no authenticated
 * user session, and from write functions that already hold admin scope.
 */
export async function getExperienceTemplate(
  ownerType: ExperienceOwnerType,
  ownerId: string | null
): Promise<ExperienceTemplateRecord | null> {
  const db = createAdminClient()

  let query = db
    .from('experience_templates')
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
  return mapExperienceTemplateRow(data)
}

/**
 * Get the platform default experience template.
 */
export async function getPlatformExperienceTemplate(): Promise<ExperienceTemplateRecord | null> {
  return getExperienceTemplate('platform', null)
}

export const getCachedPlatformExperienceTemplate = unstable_cache(
  async () => getPlatformExperienceTemplate(),
  ['platform-experience'],
  {
    revalidate: 300,
    tags: ['experience'],
  }
)

/**
 * Count active assessments attached to a campaign.
 */
async function getCampaignAssessmentCount(campaignId: string): Promise<number> {
  const db = createAdminClient()
  const { count } = await db
    .from('campaign_assessments')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .is('deleted_at', null)
  return count ?? 0
}

/**
 * Resolve the effective experience template for a campaign.
 *
 * Resolution order:
 * 1. Campaign-specific template (if exists)
 * 2. Platform default template
 * 3. Hardcoded defaults (fallback)
 *
 * Single-assessment default: the review step only adds value when participants
 * can compare answers across multiple assessments. When a campaign has ≤ 1
 * assessment and the campaign template has not explicitly customised
 * review.enabled, default it to off.
 */
export async function getEffectiveExperience(
  campaignId?: string | null
): Promise<ExperienceTemplate> {
  const platform = await getCachedPlatformExperienceTemplate()

  let campaign: ExperienceTemplateRecord | null = null
  if (campaignId) {
    campaign = await getExperienceTemplate('campaign', campaignId)
  }

  const resolved = resolveTemplate(platform, campaign)

  if (campaignId) {
    const explicitReviewOverride = campaign?.flowConfig?.review !== undefined
    if (!explicitReviewOverride) {
      const assessmentCount = await getCampaignAssessmentCount(campaignId)
      const reviewBase = resolved.flowConfig.review ?? { enabled: true, order: 110 }
      resolved.flowConfig = {
        ...resolved.flowConfig,
        review: { ...reviewBase, enabled: assessmentCount >= 2 },
      }
    }
  }

  return resolved
}

export const getCachedEffectiveExperience = unstable_cache(
  async (campaignId?: string | null) => getEffectiveExperience(campaignId),
  ['effective-experience'],
  {
    revalidate: 300,
    tags: ['experience'],
  }
)

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Upsert an experience template's page content.
 */
export async function upsertExperiencePageContent(
  ownerType: ExperienceOwnerType,
  ownerId: string | null,
  pageContent: Partial<PageContentMap>
): Promise<{ error?: string }> {
  const scope = await requireAdminScope()
  const db = createAdminClient()
  const existing = await getExperienceTemplate(ownerType, ownerId)

  if (existing) {
    const { error } = await db
      .from('experience_templates')
      .update({ page_content: pageContent })
      .eq('id', existing.id)

    if (error) return { error: error.message }
  } else {
    const { error } = await db
      .from('experience_templates')
      .insert({
        owner_type: ownerType,
        owner_id: ownerId,
        page_content: pageContent,
      })

    if (error) return { error: error.message }
  }

  revalidatePath('/settings/experience')
  if (ownerId) revalidatePath(`/campaigns/${ownerId}`)
  revalidateTag('experience', 'max')

  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'experience_template.page_content_upserted',
    targetTable: 'experience_templates',
    targetId: existing?.id ?? null,
    metadata: {
      ownerType,
      ownerId,
    },
  })

  return {}
}

/**
 * Upsert an experience template's flow config.
 */
export async function upsertExperienceFlowConfig(
  ownerType: ExperienceOwnerType,
  ownerId: string | null,
  flowConfig: Partial<FlowConfig>
): Promise<{ error?: string }> {
  const scope = await requireAdminScope()
  const db = createAdminClient()
  const existing = await getExperienceTemplate(ownerType, ownerId)

  if (existing) {
    const { error } = await db
      .from('experience_templates')
      .update({ flow_config: flowConfig })
      .eq('id', existing.id)

    if (error) return { error: error.message }
  } else {
    const { error } = await db
      .from('experience_templates')
      .insert({
        owner_type: ownerType,
        owner_id: ownerId,
        flow_config: flowConfig,
      })

    if (error) return { error: error.message }
  }

  revalidatePath('/settings/experience')
  if (ownerId) revalidatePath(`/campaigns/${ownerId}`)
  revalidateTag('experience', 'max')

  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'experience_template.flow_config_upserted',
    targetTable: 'experience_templates',
    targetId: existing?.id ?? null,
    metadata: {
      ownerType,
      ownerId,
    },
  })

  return {}
}

/**
 * Upsert an experience template's demographics config.
 */
export async function upsertExperienceDemographics(
  ownerType: ExperienceOwnerType,
  ownerId: string | null,
  demographicsConfig: DemographicsConfig
): Promise<{ error?: string }> {
  const scope = await requireAdminScope()
  const db = createAdminClient()
  const existing = await getExperienceTemplate(ownerType, ownerId)

  if (existing) {
    const { error } = await db
      .from('experience_templates')
      .update({ demographics_config: demographicsConfig })
      .eq('id', existing.id)

    if (error) return { error: error.message }
  } else {
    const { error } = await db
      .from('experience_templates')
      .insert({
        owner_type: ownerType,
        owner_id: ownerId,
        demographics_config: demographicsConfig,
      })

    if (error) return { error: error.message }
  }

  revalidatePath('/settings/experience')
  if (ownerId) revalidatePath(`/campaigns/${ownerId}`)
  revalidateTag('experience', 'max')

  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'experience_template.demographics_upserted',
    targetTable: 'experience_templates',
    targetId: existing?.id ?? null,
    metadata: {
      ownerType,
      ownerId,
    },
  })

  return {}
}

/**
 * Full upsert — update all three JSONB columns at once.
 */
export async function upsertExperienceTemplate(
  ownerType: ExperienceOwnerType,
  ownerId: string | null,
  template: Partial<ExperienceTemplate>
): Promise<{ error?: string }> {
  const scope = await requireAdminScope()
  const db = createAdminClient()
  const existing = await getExperienceTemplate(ownerType, ownerId)

  const payload: Record<string, unknown> = {}
  if (template.pageContent) payload.page_content = template.pageContent
  if (template.flowConfig) payload.flow_config = template.flowConfig
  if (template.demographicsConfig) payload.demographics_config = template.demographicsConfig
  if (template.customPageContent !== undefined) payload.custom_page_content = template.customPageContent
  if (template.privacyUrl !== undefined) payload.privacy_url = template.privacyUrl || null
  if (template.termsUrl !== undefined) payload.terms_url = template.termsUrl || null

  if (existing) {
    const { error } = await db
      .from('experience_templates')
      .update(payload)
      .eq('id', existing.id)

    if (error) return { error: error.message }
  } else {
    const { error } = await db
      .from('experience_templates')
      .insert({
        owner_type: ownerType,
        owner_id: ownerId,
        ...payload,
      })

    if (error) return { error: error.message }
  }

  revalidatePath('/settings/experience')
  if (ownerId) revalidatePath(`/campaigns/${ownerId}`)
  revalidateTag('experience', 'max')

  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'experience_template.upserted',
    targetTable: 'experience_templates',
    targetId: existing?.id ?? null,
    metadata: {
      ownerType,
      ownerId,
      updatedKeys: Object.keys(payload),
    },
  })

  return {}
}

/**
 * Reset a campaign's experience template to use platform defaults.
 * Soft-deletes the campaign-specific template.
 */
export async function resetExperienceToDefault(
  ownerType: ExperienceOwnerType,
  ownerId: string | null
): Promise<{ error?: string }> {
  const scope = await requireAdminScope()
  if (ownerType === 'platform') {
    return { error: 'Cannot reset platform template — edit it instead.' }
  }

  const existing = await getExperienceTemplate(ownerType, ownerId)
  if (!existing) return {}

  const db = createAdminClient()
  const { error } = await db
    .from('experience_templates')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', existing.id)

  if (error) return { error: error.message }

  if (ownerId) revalidatePath(`/campaigns/${ownerId}`)
  revalidateTag('experience', 'max')

  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'experience_template.reset_to_default',
    targetTable: 'experience_templates',
    targetId: existing.id,
    metadata: {
      ownerType,
      ownerId,
    },
  })

  return {}
}

// ---------------------------------------------------------------------------
// Participant-facing actions
// ---------------------------------------------------------------------------

/**
 * Save consent for a participant.
 */
export async function saveConsent(
  token: string,
  participantId: string,
): Promise<{ error?: string }> {
  try {
    await requireParticipantRuntimeParticipantAccess(token, participantId)
  } catch (error) {
    if (error instanceof ParticipantRuntimeAccessError) {
      return { error: error.message }
    }
    throw error
  }

  // Capture client IP server-side from request headers
  const { headers } = await import('next/headers')
  const headersList = await headers()
  const ip =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headersList.get('x-real-ip') ??
    'unknown'

  const db = createAdminClient()
  const { error } = await db
    .from('campaign_participants')
    .update({
      consent_given_at: new Date().toISOString(),
      consent_ip: ip,
    })
    .eq('id', participantId)

  if (error) return { error: error.message }
  return {}
}

/**
 * Save demographics for a participant.
 */
export async function saveDemographics(
  token: string,
  participantId: string,
  demographics: Record<string, string>
): Promise<{ error?: string }> {
  try {
    await requireParticipantRuntimeParticipantAccess(token, participantId)
  } catch (error) {
    if (error instanceof ParticipantRuntimeAccessError) {
      return { error: error.message }
    }
    throw error
  }

  const db = createAdminClient()
  const { error } = await db
    .from('campaign_participants')
    .update({
      demographics,
      demographics_completed_at: new Date().toISOString(),
    })
    .eq('id', participantId)

  if (error) return { error: error.message }
  return {}
}
