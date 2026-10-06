import 'server-only'

// Trusted implementations. Never export these from a module with a use-server directive.
import { revalidatePath, revalidateTag } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAssessmentContentSummaries } from '@/lib/dal/assessment-content';
import { autoBuildSectionsFromFactors } from '@/lib/dal/assessment-sections';
import { AuthorizationError, canManageCampaign, canManageClient, requireAssessmentAccess, requireCampaignManage, resolveAuthorizedScope, type AuthorizedScope } from '@/lib/auth/authorization';
import { logAuditEvent } from '@/lib/auth/support-sessions';
import { logActionError } from '@/lib/security/action-errors';
import { requireAppUrl } from '@/lib/hosts';
import { campaignSchema } from '@/lib/validations/campaigns';

async function canWriteAssessment(assessmentId: string): Promise<boolean> {
  try {
    await requireAssessmentAccess(assessmentId, { forWrite: true })
    return true
  } catch (error) {
    if (error instanceof AuthorizationError) return false
    throw error
  }
}

async function getClientPartnerId(clientId: string) {
  const db = createAdminClient()
  const { data, error } = await db
    .from('clients')
    .select('id, partner_id')
    .eq('id', clientId)
    .is('deleted_at', null)
    .single()

  if (error || !data) {
    throw new AuthorizationError('Selected client is not available.')
  }

  return data.partner_id ? String(data.partner_id) : null
}

export async function createCampaign(
  payload: Record<string, unknown>,
  opts: { systemScope?: AuthorizedScope } = {},
) {
  const parsed = campaignSchema.safeParse(payload)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const scope = opts.systemScope ?? (await resolveAuthorizedScope())
  const clientId = parsed.data.clientId || null

  // 360 is an admin-only test-bed feature for now. Enforce server-side — the
  // UI only offers the type to admins, but the action uses the admin client
  // (RLS won't reject), so a non-admin could otherwise POST kind directly.
  if (parsed.data.kind === 'leadership_360' && !scope.isPlatformAdmin) {
    return { error: { kind: ['360 campaigns are not available for your account'] } }
  }

  if (!scope.isPlatformAdmin && !clientId) {
    return { error: { clientId: ['Campaigns must belong to a client context'] } }
  }
  if (clientId && !canManageClient(scope, clientId)) {
    return { error: { clientId: ['You do not have permission to manage this client'] } }
  }

  const partnerId =
    clientId
      ? await getClientPartnerId(clientId)
      : (parsed.data.partnerId || null)

  if (!clientId && !canManageCampaign(scope, partnerId, null)) {
    return { error: { clientId: ['Campaigns must belong to the active workspace'] } }
  }

  const db = createAdminClient()
  const { data: campaign, error } = await db
    .from('campaigns')
    .insert({
      title: parsed.data.title,
      slug: parsed.data.slug,
      description: parsed.data.description ?? null,
      status: parsed.data.status,
      kind: parsed.data.kind,
      client_id: clientId,
      partner_id: partnerId,
      opens_at: parsed.data.opensAt || null,
      closes_at: parsed.data.closesAt || null,
      allow_resume: parsed.data.allowResume,
      show_progress: parsed.data.showProgress,
      randomize_assessment_order: parsed.data.randomizeAssessmentOrder,
      confidentiality_mode: parsed.data.confidentialityMode || 'standard',
      inviter_name: parsed.data.inviterName || null,
      inviter_role: parsed.data.inviterRole || null,
      consultant_emails: scope.actor?.email ? [scope.actor.email] : [],
    })
    .select('id')
    .single()

  if (error) {
    logActionError('createCampaign', error)
    return { error: { _form: ['Unable to create campaign.'] } }
  }

  // Report templates are no longer auto-copied at campaign creation. The
  // session-completion resolver in src/app/actions/assess.ts unions the
  // campaign-level attachments with the assessment-level defaults at runtime,
  // and falls back to report_templates.is_default = true only when both
  // layers are empty. This keeps campaign_report_templates as a record of
  // explicit overrides rather than a pre-populated soup.

  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'campaign.created',
    targetTable: 'campaigns',
    targetId: campaign.id,
    partnerId,
    clientId: clientId,
    metadata: {
      slug: parsed.data.slug,
      isLocalDevelopmentBypass: scope.isLocalDevelopmentBypass,
    },
  })

  revalidatePath('/campaigns')
  revalidatePath('/')
  return { success: true as const, id: campaign.id }
}

export async function addAssessmentToCampaign(
  campaignId: string,
  assessmentId: string,
  opts: { systemScope?: AuthorizedScope } = {},
) {
  let access
  try {
    access = await requireCampaignManage(campaignId, opts)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  if (opts.systemScope) {
    const { data: owned, error: ownedError } = await createAdminClient()
      .from('assessments')
      .select('client_id')
      .eq('id', assessmentId)
      .is('deleted_at', null)
      .maybeSingle()
    if (ownedError) {
      logActionError('addAssessmentToCampaign', ownedError)
      return { error: 'Unable to verify assessment availability.' }
    }
    if (!owned || !access.clientId || owned.client_id !== access.clientId) {
      return { error: 'This assessment is not available for your client' }
    }
  }

  if (!opts.systemScope && !access.scope.isPlatformAdmin && access.clientId) {
    const supabase = createAdminClient()
    const { data: assignment, error: assignmentError } = await supabase
      .from('client_assessment_assignments')
      .select('id')
      .eq('client_id', access.clientId)
      .eq('assessment_id', assessmentId)
      .eq('is_active', true)
      .maybeSingle()

    if (assignmentError) {
      logActionError('addAssessmentToCampaign', assignmentError)
      return { error: 'Unable to verify assessment availability.' }
    }

    if (!assignment) {
      return { error: 'This assessment is not available for your client' }
    }
  }

  const db = createAdminClient()

  // Only active assessments can reach participants — a draft is unfinished
  // by definition. Applies to every caller, platform admins included.
  const { data: assessmentRow, error: assessmentStatusError } = await db
    .from('assessments')
    .select('status')
    .eq('id', assessmentId)
    .is('deleted_at', null)
    .maybeSingle()

  if (assessmentStatusError) {
    logActionError('addAssessmentToCampaign', assessmentStatusError)
    return { error: 'Unable to verify assessment availability.' }
  }
  if (!assessmentRow) {
    return { error: 'Assessment not found.' }
  }
  if (assessmentRow.status !== 'active') {
    return {
      error:
        'This assessment is not active. Publish it in the builder before adding it to a campaign.',
    }
  }

  // The runner serves questions from the assessment's sections, not its
  // factors — an assessment with none renders empty and auto-completes. Build
  // the default layout from the factors on the spot; only refuse when they
  // genuinely resolve to nothing.
  try {
    const [content] = await getAssessmentContentSummaries(db, [assessmentId])
    let deliverable = Boolean(content?.hasDeliverableContent)
    if (content && !deliverable && (await canWriteAssessment(assessmentId))) {
      const built = await autoBuildSectionsFromFactors(db, assessmentId)
      if (built.built) {
        deliverable = true
        await logAuditEvent({
          actorProfileId: access.scope.actor?.id ?? null,
          eventType: 'assessment.sections.autobuilt',
          targetTable: 'assessments',
          targetId: assessmentId,
          metadata: { itemCount: built.itemCount, trigger: 'campaign-attach' },
        })
      }
    }
    if (!deliverable) {
      return {
        error:
          'This assessment has no questions: its factors don’t resolve to any active items. Fix its factor selection (or sections) in the assessment builder before adding it to a campaign.',
      }
    }
  } catch {
    return { error: 'Unable to verify that this assessment has questions. Try again.' }
  }

  // Get max display order among live rows — soft-deleted assessments must
  // not inflate the next position.
  const { data: existing, error: existingOrderError } = await db
    .from('campaign_assessments')
    .select('display_order')
    .eq('campaign_id', campaignId)
    .is('deleted_at', null)
    .order('display_order', { ascending: false })
    .limit(1)

  if (existingOrderError) {
    logActionError('addAssessmentToCampaign', existingOrderError)
    return { error: 'Unable to add assessment.' }
  }

  const nextOrder = (existing?.[0]?.display_order ?? -1) + 1

  const { error } = await db
    .from('campaign_assessments')
    .insert({
      campaign_id: campaignId,
      assessment_id: assessmentId,
      display_order: nextOrder,
    })

  if (error) {
    logActionError('addAssessmentToCampaign', error)
    return { error: 'Unable to add assessment.' }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.assessment.added',
    targetTable: 'campaigns',
    targetId: campaignId,
    partnerId: access.partnerId,
    clientId: access.clientId,
    metadata: { assessmentId },
  })

  revalidatePath(`/campaigns/${campaignId}`)
  // Assessment count feeds into the effective experience (review step default),
  // so invalidate the experience cache alongside the campaign pages.
  revalidateTag('experience', 'max')
}

export async function sendParticipantInviteEmail(
  campaignId: string,
  participantId: string,
  opts: { systemScope?: AuthorizedScope } = {},
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireCampaignManage(campaignId, opts)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { success: false, error: error.message }
    }
    throw error
  }

  const db = createAdminClient()

  const [participantResult, campaignResult] = await Promise.all([
    db
      .from('campaign_participants')
      .select('email, first_name, access_token')
      .eq('id', participantId)
      .eq('campaign_id', campaignId)
      .is('deleted_at', null)
      .single(),
    db
      .from('campaigns')
      .select('title, description, client_id, partner_id')
      .eq('id', campaignId)
      .single(),
  ])

  if (participantResult.error || !participantResult.data) {
    return { success: false, error: 'Participant not found' }
  }
  if (campaignResult.error || !campaignResult.data) {
    return { success: false, error: 'Campaign not found' }
  }

  const participant = participantResult.data
  const campaign = campaignResult.data

  const assessBaseUrl = requireAppUrl('public')

  try {
    const { sendEmail } = await import('@/lib/email/send')

    await sendEmail({
      type: 'assessment_invite',
      to: participant.email,
      variables: {
        participantFirstName: participant.first_name ?? '',
        campaignTitle: campaign.title,
        campaignDescription: campaign.description ?? '',
        assessmentUrl: `${assessBaseUrl}/assess/${participant.access_token}`,
        brandName: 'Trajectas',
      },
      scopeCampaignId: campaignId,
      scopeClientId: campaign.client_id,
      scopePartnerId: campaign.partner_id ?? undefined,
    })

    // Update invited_at to track last send time
    const { error: invitedAtError } = await db
      .from('campaign_participants')
      .update({ invited_at: new Date().toISOString() })
      .eq('id', participantId)
    if (invitedAtError) {
      logActionError('sendParticipantInviteEmail', invitedAtError)
    }

    revalidatePath(`/campaigns/${campaignId}`)
    return { success: true }
  } catch (error) {
    console.error('[email] Failed to send invite:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Email delivery failed',
    }
  }
}
