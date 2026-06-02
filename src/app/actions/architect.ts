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

import { createClient } from '@/lib/supabase/server'
import { requireAdminScope } from '@/lib/auth/authorization'
import { throwActionError } from '@/lib/security/action-errors'
import { runBriefExtraction } from '@/lib/ai/brief-extraction'
import { runMatching } from '@/lib/ai/matching/engine'
import { runArchitectOverview } from '@/lib/ai/architect-overview'
import { createAssessment } from '@/app/actions/assessments'
import { extractBriefSchema, runArchitectMatchSchema, createArchitectAssessmentSchema, summariseSelectionSchema } from '@/lib/validations/architect'
import type { Brief, MatchingFactor } from '@/types/ai'
import type { ArchitectPick, ArchitectMatchResult } from '@/types/architect'

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

  const buffer = Buffer.from(await file.arrayBuffer())
  const name = file.name.toLowerCase()

  try {
    if (name.endsWith('.pdf') || file.type === 'application/pdf') {
      const { extractText, getDocumentProxy } = await import('unpdf')
      const pdf = await getDocumentProxy(new Uint8Array(buffer))
      const { text } = await extractText(pdf, { mergePages: true })
      const joined = Array.isArray(text) ? text.join('\n') : text
      return { text: joined.trim() }
    }
    if (name.endsWith('.docx') || file.type.includes('wordprocessingml')) {
      const mammoth = await import('mammoth')
      const { value } = await mammoth.extractRawText({ buffer })
      return { text: value.trim() }
    }
    if (name.endsWith('.txt') || file.type.startsWith('text/')) {
      return { text: buffer.toString('utf8').trim() }
    }
    return { error: 'Unsupported file. Upload a PDF, DOCX, or TXT — or paste the text.' }
  } catch {
    return { error: 'Could not read that file. Try pasting the text instead.' }
  }
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
  const brief = parsed.data.brief as Brief
  const db = await createClient()

  // Eligible factor pool: match-eligible, active, not deleted.
  const { data: factorRows, error } = await db
    .from('factors')
    .select('id, name, definition, description, applicable_outcomes, applicable_levels, applicable_functions, dimension_id, dimensions(name), primary_category_id')
    .eq('is_active', true)
    .eq('is_match_eligible', true)
    .is('deleted_at', null)

  if (error) {
    throwActionError('runArchitectMatch.factors', 'Unable to load the factor library.', error)
  }

  // Eligibility filter: empty tag arrays mean "applies to all" (pre-backfill).
  const eligible = (factorRows ?? []).filter((f) => {
    const outcomes = (f.applicable_outcomes ?? []) as string[]
    const levels = (f.applicable_levels ?? []) as string[]
    const outcomeOk = outcomes.length === 0 || outcomes.includes(brief.outcome)
    const levelOk = levels.length === 0 || levels.includes(brief.level)
    return outcomeOk && levelOk
  })

  if (eligible.length === 0) {
    return { picks: [], summary: 'No eligible factors matched this brief.', recommendedCount: { minimum: 0, optimal: 0, maximum: 0 }, consideredCount: 0, eligibleFactors: [], categories: [] }
  }

  const availableFactors: MatchingFactor[] = eligible.map((f) => ({
    id: f.id as string,
    name: f.name as string,
    // Feed definition; fall back to description (definition is the populated field).
    definition: ((f.definition as string) || (f.description as string) || '').trim(),
    // Soft ranking signal — the matcher weighs function fit; it is not a hard filter.
    applicableFunctions: (f.applicable_functions ?? []) as string[],
  }))

  // Item counts per factor (factor_constructs -> items), for the picks counters.
  const itemCountByFactor = await getItemCountsByFactor(db, availableFactors.map((f) => f.id))

  let output
  try {
    output = await runMatching({ source: { kind: 'brief', brief }, availableFactors })
  } catch (error) {
    throwActionError('runArchitectMatch.match', 'The matcher could not rank factors for this brief.', error)
  }

  const dimNameOf = (row: Record<string, unknown>): string | null => {
    const d = row.dimensions
    if (Array.isArray(d)) return (d[0] as { name?: string } | undefined)?.name ?? null
    return (d as { name?: string } | null)?.name ?? null
  }

  // High-level categories — the whole-person coverage frame.
  const { data: catRows } = await db
    .from('library_categories')
    .select('id, key, name')
    .order('display_order', { ascending: true })
  const catById = new Map(
    (catRows ?? []).map((c) => [c.id as string, { key: c.key as string, name: c.name as string }]),
  )
  const categories = (catRows ?? []).map((c) => ({ key: c.key as string, name: c.name as string }))
  const catOf = (f?: Record<string, unknown>) => {
    const id = (f?.primary_category_id as string | null) ?? null
    const cat = id ? catById.get(id) : undefined
    return { categoryId: id, categoryName: cat?.name ?? null, categoryKey: cat?.key ?? null }
  }

  const eligibleById = new Map(eligible.map((f) => [f.id as string, f as Record<string, unknown>]))

  const picks: ArchitectPick[] = output.rankings.map((r) => {
    const f = eligibleById.get(r.factorId)
    return {
      factorId: r.factorId,
      factorName: r.factorName,
      rank: r.rank,
      relevanceScore: r.relevanceScore,
      reasoning: r.reasoning,
      availableItems: itemCountByFactor.get(r.factorId) ?? 0,
      dimensionId: (f?.dimension_id as string | null) ?? null,
      dimensionName: f ? dimNameOf(f) : null,
      ...catOf(f),
    }
  })

  const eligibleFactors = eligible.map((f) => ({
    factorId: f.id as string,
    factorName: f.name as string,
    availableItems: itemCountByFactor.get(f.id as string) ?? 0,
    dimensionId: (f.dimension_id as string | null) ?? null,
    dimensionName: dimNameOf(f as Record<string, unknown>),
    ...catOf(f as Record<string, unknown>),
  }))

  return {
    picks,
    summary: output.summary,
    recommendedCount: output.recommendedCount,
    consideredCount: eligible.length,
    eligibleFactors,
    categories,
  }
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
  } catch {
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

  // Reuse the existing assessment-creation path; it enforces its own scope.
  return createAssessment({
    title: parsed.data.title,
    description: parsed.data.description,
    status: 'draft',
    itemSelectionStrategy: 'fixed',
    creationMode: 'ai_generated',
    formatMode: 'traditional',
    factors: parsed.data.picks.map((p) => ({
      factorId: p.factorId,
      weight: p.weight ?? 1,
      itemCount: p.itemCount,
    })),
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type DbClient = Awaited<ReturnType<typeof createClient>>

async function getItemCountsByFactor(
  db: DbClient,
  factorIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (factorIds.length === 0) return counts

  const { data: links } = await db
    .from('factor_constructs')
    .select('factor_id, construct_id')
    .in('factor_id', factorIds)

  const constructIds = [...new Set((links ?? []).map((l) => l.construct_id as string))]
  if (constructIds.length === 0) return counts

  const { data: items } = await db
    .from('items')
    .select('construct_id')
    .eq('status', 'active')
    .is('deleted_at', null)
    .in('construct_id', constructIds)

  const itemsByConstruct = new Map<string, number>()
  for (const it of items ?? []) {
    const cid = it.construct_id as string
    itemsByConstruct.set(cid, (itemsByConstruct.get(cid) ?? 0) + 1)
  }

  for (const link of links ?? []) {
    const fid = link.factor_id as string
    const cid = link.construct_id as string
    counts.set(fid, (counts.get(fid) ?? 0) + (itemsByConstruct.get(cid) ?? 0))
  }
  return counts
}
