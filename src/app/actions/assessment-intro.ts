'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminScope } from '@/lib/auth/authorization'
import { logAuditEvent } from '@/lib/auth/support-sessions'
import type { AssessmentIntroContent, IntroOverride } from '@/types/database'

const uuidSchema = z.uuid()

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getAssessmentIntro(
  assessmentId: string
): Promise<AssessmentIntroContent | null> {
  await requireAdminScope()
  const db = createAdminClient()

  const { data, error } = await db
    .from('assessments')
    .select('intro_content')
    .eq('id', assessmentId)
    .single()

  if (error || !data) return null

  return (data.intro_content as AssessmentIntroContent | null) ?? null
}

// ---------------------------------------------------------------------------
// Update intro content
// ---------------------------------------------------------------------------

export async function updateAssessmentIntro(
  assessmentId: string,
  content: AssessmentIntroContent
): Promise<{ success: true } | { error: string }> {
  const scope = await requireAdminScope()

  const parsed = uuidSchema.safeParse(assessmentId)
  if (!parsed.success) {
    return { error: 'Invalid assessment ID.' }
  }

  const db = createAdminClient()

  const { error } = await db
    .from('assessments')
    .update({ intro_content: content })
    .eq('id', assessmentId)

  if (error) return { error: error.message }

  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'assessment.intro_content.updated',
    targetTable: 'assessments',
    targetId: assessmentId,
  })

  revalidatePath('/assessments')
  revalidatePath(`/assessments/${assessmentId}/edit`)

  return { success: true }
}

// ---------------------------------------------------------------------------
// Toggle intro enabled
// ---------------------------------------------------------------------------

export async function toggleAssessmentIntro(
  assessmentId: string,
  enabled: boolean
): Promise<{ success: true } | { error: string }> {
  const scope = await requireAdminScope()

  const db = createAdminClient()

  // Fetch current intro_content (and title if we need to create a default)
  const { data, error: fetchError } = await db
    .from('assessments')
    .select('intro_content, title')
    .eq('id', assessmentId)
    .single()

  if (fetchError || !data) {
    return { error: fetchError?.message ?? 'Assessment not found.' }
  }

  let updatedContent: AssessmentIntroContent

  if (!data.intro_content && enabled) {
    // Create default content using the assessment title
    updatedContent = {
      enabled: true,
      heading: String(data.title ?? ''),
      body: '',
      buttonLabel: 'Begin Assessment',
    }
  } else if (data.intro_content) {
    // Merge enabled flag into existing content
    updatedContent = {
      ...(data.intro_content as AssessmentIntroContent),
      enabled,
    }
  } else {
    // intro_content is null and enabled is false — nothing to do, store null-safe default
    updatedContent = {
      enabled: false,
      heading: String(data.title ?? ''),
      body: '',
      buttonLabel: 'Begin Assessment',
    }
  }

  const { error: updateError } = await db
    .from('assessments')
    .update({ intro_content: updatedContent })
    .eq('id', assessmentId)

  if (updateError) return { error: updateError.message }

  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'assessment.intro_enabled.toggled',
    targetTable: 'assessments',
    targetId: assessmentId,
    metadata: { enabled },
  })

  revalidatePath('/assessments')
  revalidatePath(`/assessments/${assessmentId}/edit`)

  return { success: true }
}

// ---------------------------------------------------------------------------
// Campaign intro override
// ---------------------------------------------------------------------------

export async function updateCampaignIntroOverride(
  campaignId: string,
  assessmentId: string,
  override: IntroOverride
): Promise<{ success: true } | { error: string }> {
  const scope = await requireAdminScope()

  const campaignParsed = uuidSchema.safeParse(campaignId)
  const assessmentParsed = uuidSchema.safeParse(assessmentId)

  if (!campaignParsed.success) return { error: 'Invalid campaign ID.' }
  if (!assessmentParsed.success) return { error: 'Invalid assessment ID.' }

  const db = createAdminClient()

  const { error } = await db
    .from('campaign_assessments')
    .update({ intro_override: override })
    .eq('campaign_id', campaignId)
    .eq('assessment_id', assessmentId)

  if (error) return { error: error.message }

  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'campaign_assessment.intro_override.updated',
    targetTable: 'campaign_assessments',
    targetId: campaignId,
    metadata: { assessmentId },
  })

  revalidatePath('/campaigns')
  revalidatePath(`/campaigns/${campaignId}`)
  revalidatePath(`/campaigns/${campaignId}/edit`)

  return { success: true }
}

// ---------------------------------------------------------------------------
// Fetch campaign assessment intros
// ---------------------------------------------------------------------------

export type CampaignAssessmentIntro = {
  assessmentId: string
  assessmentTitle: string
  introContent: AssessmentIntroContent | null
  introOverride: IntroOverride
  displayOrder: number
}

export async function getCampaignAssessmentIntros(
  campaignId: string
): Promise<CampaignAssessmentIntro[]> {
  await requireAdminScope()

  const db = createAdminClient()

  // Query campaign_assessments for this campaign
  const { data: campaignAssessments, error: caError } = await db
    .from('campaign_assessments')
    .select('assessment_id, intro_override, display_order')
    .eq('campaign_id', campaignId)
    .order('display_order', { ascending: true })

  if (caError || !campaignAssessments || campaignAssessments.length === 0) {
    return []
  }

  const assessmentIds = campaignAssessments.map((ca) => ca.assessment_id as string)

  // Fetch assessment titles and intro_content for all linked assessments
  const { data: assessments, error: assessmentsError } = await db
    .from('assessments')
    .select('id, title, intro_content')
    .in('id', assessmentIds)

  if (assessmentsError || !assessments) return []

  // Build a lookup map
  const assessmentMap = new Map<
    string,
    { title: string; introContent: AssessmentIntroContent | null }
  >()
  for (const a of assessments) {
    assessmentMap.set(String(a.id), {
      title: String(a.title ?? ''),
      introContent: (a.intro_content as AssessmentIntroContent | null) ?? null,
    })
  }

  return campaignAssessments
    .map((ca) => {
      const assessmentId = String(ca.assessment_id)
      const assessment = assessmentMap.get(assessmentId)
      return {
        assessmentId,
        assessmentTitle: assessment?.title ?? '',
        introContent: assessment?.introContent ?? null,
        introOverride: (ca.intro_override as IntroOverride) ?? null,
        displayOrder: Number(ca.display_order ?? 0),
      }
    })
    .sort((a, b) => a.displayOrder - b.displayOrder)
}
