import 'server-only'

// Trusted implementations. Never export these from a module with a use-server directive.
import { assessmentSelectionIssue } from '@/lib/dal/model-management';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuthorizationError, canManageAssessmentLibrary, canManageClient, getPreferredPartnerIdForAssessmentCreation, resolveAuthorizedScope, type AuthorizedScope } from '@/lib/auth/authorization';
import { logAuditEvent } from '@/lib/auth/support-sessions';
import { assessmentSchema } from '@/lib/validations/assessments';
import { getAssessmentContentSummaries } from '@/lib/dal/assessment-content';
import { autoBuildSectionsFromFactors, persistSections } from '@/lib/dal/assessment-sections';
import { seedAssessmentPreview } from '@/lib/sample-data/seed-preview';
import type { ItemOrdering } from '@/types/database';
import type { ForcedChoiceBlockDraft } from '@/lib/forced-choice-generator';

async function refreshPreviewSeed(assessmentId: string): Promise<void> {
  try {
    const db = createAdminClient()
    await seedAssessmentPreview(db, assessmentId)
  } catch (err) {
    console.warn(`[assessments] preview seed failed for ${assessmentId}:`, err)
  }
}

async function hasDeliverableContent(db: ReturnType<typeof createAdminClient>, assessmentId: string): Promise<boolean | null> {
  try {
    const [summary] = await getAssessmentContentSummaries(db, [assessmentId])
    return Boolean(summary?.hasDeliverableContent)
  } catch {
    return null
  }
}

async function tryAutoBuildSections(db: ReturnType<typeof createAdminClient>, assessmentId: string) {
  try {
    return await autoBuildSectionsFromFactors(db, assessmentId)
  } catch {
    return null
  }
}

const EMPTY_ASSESSMENT_ACTIVATION_ERROR =
  'This assessment has no questions: its selected factors don’t resolve to any active items (or its configured sections match none). Pick factors whose constructs have active items, or adjust the sections in the Presentation step.'

const CONTENT_CHECK_FAILED_ERROR =
  'Unable to verify that this assessment has questions right now. Try again.'

type SectionRole = 'scored' | 'practice' | 'instructions'

type SectionDraft = {
  id?: string
  responseFormatId: string
  formatName: string
  formatType: string
  title: string
  instructions: string
  displayOrder: number
  itemOrdering: ItemOrdering
  timeLimitSeconds: number | null
  sectionRole: SectionRole
  itemCount: number
}

function revalidateAssessmentPaths() {
  revalidatePath('/assessments')
  revalidatePath('/partner/assessments')
  revalidatePath('/partner')
  revalidatePath('/directory')
  revalidatePath('/clients', 'layout')
  revalidatePath('/partners', 'layout')
  revalidatePath('/')
}

async function requireAssessmentBuilderScope() {
  const scope = await resolveAuthorizedScope()

  if (!canManageAssessmentLibrary(scope)) {
    throw new AuthorizationError('You do not have permission to manage assessments.')
  }

  return scope
}

export async function createAssessment(
  payload: Record<string, unknown>,
  opts: { systemScope?: AuthorizedScope } = {},
) {
  let scope: AuthorizedScope | null = null
  let partnerId: string | null = null
  try {
    if (opts.systemScope) {
      scope = opts.systemScope
      if (!canManageAssessmentLibrary(scope)) {
        throw new AuthorizationError('You do not have permission to manage assessments.')
      }
      partnerId = null
    } else {
      scope = await requireAssessmentBuilderScope()
      partnerId = scope.isPlatformAdmin
        ? null
        : getPreferredPartnerIdForAssessmentCreation(scope)
    }
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: { _form: [error.message] } }
    }
    throw error
  }

  if (!scope) {
    return { error: { _form: ['Unable to resolve assessment scope.'] } }
  }

  const parsed = assessmentSchema.safeParse(payload)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  // A system scope is confined to the clients it manages, exactly as
  // createCampaign confines every caller — the constant scope must not be
  // able to write an assessment under some other client.
  if ((opts.systemScope && !parsed.data.clientId) || (parsed.data.clientId && !canManageClient(scope, parsed.data.clientId))) {
    return { error: { clientId: ['You do not have permission to manage this client'] } }
  }

  const selectionIssue = opts.systemScope ? null : await assessmentSelectionIssue(parsed.data.factors.map(f => f.factorId))
  if (selectionIssue) return { error: { _form: [selectionIssue] } }

  const db = createAdminClient()
  const { data: assessment, error } = await db.from('assessments').insert({
    partner_id: partnerId,
    client_id: parsed.data.clientId || null,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    status: parsed.data.status,
    item_selection_strategy: parsed.data.itemSelectionStrategy,
    scoring_method: 'ctt',
    creation_mode: parsed.data.creationMode,
    format_mode: parsed.data.formatMode,
    fc_block_size: parsed.data.fcBlockSize ?? null,
    source_id: parsed.data.sourceId || null,
  }).select('id').single()

  if (error) return { error: { _form: [error.message] } }

  if (parsed.data.factors.length > 0) {
    const links = parsed.data.factors.map((f) => ({
      assessment_id: assessment.id,
      factor_id: f.factorId,
      weight: f.weight,
      item_count: f.itemCount,
    }))
    const { error: linkError } = await db.from('assessment_factors').insert(links)
    if (linkError) return { error: { _form: [linkError.message] } }
  }

  // Insert sections (traditional mode)
  const sections = (payload.sections ?? []) as SectionDraft[]
  if (sections.length > 0 && parsed.data.formatMode === 'traditional') {
    const factorIds = parsed.data.factors.map((f) => f.factorId)
    const { error: sectionErr } = await persistSections(db, assessment.id, sections, {
      factorIds,
    })
    if (sectionErr) return { error: { _form: [sectionErr] } }
  }

  // Persist FC blocks (forced_choice mode)
  const fcBlocks = (payload.forcedChoiceBlocks ?? []) as ForcedChoiceBlockDraft[]
  if (fcBlocks.length > 0 && parsed.data.formatMode === 'forced_choice') {
    const blockErr = await persistForcedChoiceBlocks(db, assessment.id, fcBlocks)
    if (blockErr) return { error: { _form: [blockErr] } }
  }

  // Fail closed on empty-but-active: auto-build the default layout from the
  // factors first; if nothing is deliverable even then, keep the row as a
  // draft rather than let a question-less assessment reach campaigns.
  if (parsed.data.status === 'active') {
    let deliverable = await hasDeliverableContent(db, assessment.id)
    if (deliverable === false) {
      const built = await tryAutoBuildSections(db, assessment.id)
      if (built === null) deliverable = null
      else if (built.built) deliverable = true
    }
    if (!deliverable) {
      await db.from('assessments').update({ status: 'draft' }).eq('id', assessment.id)
      return {
        error: {
          _form: [
            deliverable === null ? CONTENT_CHECK_FAILED_ERROR : EMPTY_ASSESSMENT_ACTIVATION_ERROR,
          ],
        },
      }
    }
  }

  revalidateAssessmentPaths()
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'assessment.created',
    targetTable: 'assessments',
    targetId: assessment.id,
    partnerId,
    metadata: {
      formatMode: parsed.data.formatMode,
      factorCount: parsed.data.factors.length,
    },
  })
  await refreshPreviewSeed(assessment.id)
  return { success: true as const, id: assessment.id }
}

async function persistForcedChoiceBlocks(
   
  db: ReturnType<typeof createAdminClient>,
  assessmentId: string,
  blocks: ForcedChoiceBlockDraft[],
): Promise<string | null> {
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    const { data: inserted, error: blockErr } = await db
      .from('forced_choice_blocks')
      .insert({
        assessment_id: assessmentId,
        name: `Block ${i + 1}`,
        display_order: i,
      })
      .select('id')
      .single()

    if (blockErr) return blockErr.message

    const blockItems = block.items.map((item) => ({
      block_id: inserted.id,
      item_id: item.itemId,
      position: item.position,
    }))

    const { error: itemsErr } = await db
      .from('forced_choice_block_items')
      .insert(blockItems)

    if (itemsErr) return itemsErr.message
  }

  return null
}
