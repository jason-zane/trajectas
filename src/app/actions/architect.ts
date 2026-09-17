'use server'

/**
 * Assessment Architect — server actions.
 *
 * The fast lane: a role brief in, a bespoke draft assessment out. Three stages,
 * each its own action so the wizard can show intermediate state:
 *   1. extractBrief         — role text + decision  -> structured Brief
 *   2. runArchitectMatch    — Brief -> ranked, eligibility-filtered factors
 *   3. createArchitectAssessment — chosen factors -> draft assessment
 *
 * Role text can be pasted/typed or extracted from an uploaded PDF/DOCX/TXT
 * (extractRoleText). Architect runs are not persisted to matching_runs for
 * v1 — the durable artifact is the created assessment.
 */

import { requireAdminScope } from '@/lib/auth/authorization'
import { throwActionError, logActionError } from '@/lib/security/action-errors'
import { runBriefExtraction } from '@/lib/ai/brief-extraction'
import { runArchitectOverview } from '@/lib/ai/architect-overview'
import { runArchitectMatchPipeline } from '@/lib/ai/architect-match'
import { extractTextFromUpload } from '@/lib/ai/role-text-extraction'
import { createAssessment, getFormatBreakdown } from '@/app/actions/assessments'
import type { SectionDraft } from '@/app/actions/assessments'
import { buildDefaultSectionDrafts } from '@/lib/dal/assessment-sections'
import { extractBriefSchema, runArchitectMatchSchema, createArchitectAssessmentSchema, summariseSelectionSchema } from '@/lib/validations/architect'
import type { Brief } from '@/types/ai'
import type { ArchitectMatchResult } from '@/types/architect'

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB
const MAX_BRIEF_CHARS = 40000 // truncate over-long role text before extraction (~10k tokens)

// ---------------------------------------------------------------------------
// Stage 0 — file ingestion (PDF / DOCX / TXT -> text)
// ---------------------------------------------------------------------------

export async function extractRoleText(
  formData: FormData,
): Promise<{ text: string } | { error: string }> {
  await requireAdminScope()
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return { error: 'No file provided.' }
  if (file.size > MAX_UPLOAD_BYTES) return { error: 'File too large (max 10 MB).' }
  return extractTextFromUpload(file)
}

// ---------------------------------------------------------------------------
// Stage 1 — brief extraction
// ---------------------------------------------------------------------------

export async function extractBrief(input: {
  rawText: string
  outcomeIntent: string
}): Promise<Brief> {
  await requireAdminScope()
  // Truncate over-long input (long CVs/JDs) so it's trimmed, not rejected.
  const rawText = (input.rawText ?? '').slice(0, MAX_BRIEF_CHARS)
  const parsed = extractBriefSchema.safeParse({ rawText, outcomeIntent: input.outcomeIntent })
  if (!parsed.success) {
    throw new Error('Add a bit more detail about the role before continuing.')
  }
  try {
    return await runBriefExtraction(parsed.data)
  } catch (error) {
    throwActionError('extractBrief', 'Unable to read the role description.', error)
  }
}

// ---------------------------------------------------------------------------
// Stage 2 — eligibility filter + rank
// ---------------------------------------------------------------------------

export async function runArchitectMatch(input: { brief: Brief }): Promise<ArchitectMatchResult> {
  await requireAdminScope()
  const parsed = runArchitectMatchSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error('Invalid brief.')
  }
  return runArchitectMatchPipeline(parsed.data.brief as Brief)
}

// ---------------------------------------------------------------------------
// Coverage overview — short AI summary of what the selection reveals
// ---------------------------------------------------------------------------

export async function summariseArchitectSelection(input: {
  brief: Brief
  included: { factorName: string; categoryName: string | null; rank: number }[]
  excluded: { factorName: string; categoryName: string | null; rank: number }[]
}): Promise<{ summary: string } | { error: string }> {
  await requireAdminScope()
  const parsed = summariseSelectionSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid selection.' }
  try {
    const summary = await runArchitectOverview({
      brief: parsed.data.brief as Brief,
      included: parsed.data.included,
      excluded: parsed.data.excluded,
    })
    return { summary }
  } catch (error) {
    logActionError('architect.summariseSelection', error)
    return { error: 'Could not generate a summary.' }
  }
}

// ---------------------------------------------------------------------------
// Stage 3 — assemble + save
// ---------------------------------------------------------------------------

export async function createArchitectAssessment(input: {
  title: string
  description?: string
  picks: Array<{ factorId: string; itemCount: number; weight?: number }>
}) {
  const parsed = createArchitectAssessmentSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const factorIds = parsed.data.picks.map((p) => p.factorId)

  // The runner serves items from assessment_sections -> assessment_section_items,
  // not directly from assessment_factors. createAssessment only materialises those
  // section items when it's handed a `sections` layout (persistSections). Build the
  // shared default layout — one section per response format the picks resolve to.
  const formatGroups = await getFormatBreakdown({ factorIds })
  const sections: SectionDraft[] = buildDefaultSectionDrafts(formatGroups)

  // Reuse the existing assessment-creation path; it enforces its own scope.
  return createAssessment({
    title: parsed.data.title,
    description: parsed.data.description,
    // Architect assessments are assembled ready-to-run from the live (all-active)
    // library, so they go straight to active. Manual creation stays 'draft'.
    status: 'active',
    itemSelectionStrategy: 'fixed',
    creationMode: 'ai_generated',
    formatMode: 'traditional',
    factors: parsed.data.picks.map((p) => ({
      factorId: p.factorId,
      weight: p.weight ?? 1,
      itemCount: p.itemCount,
    })),
    sections,
  })
}

