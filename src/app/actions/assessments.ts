'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  AuthenticationRequiredError,
  AuthorizationError,
  canManageAssessment,
  canManageAssessmentLibrary,
  getAccessibleCampaignIds,
  getAccessiblePartnerIds,
  getPreferredPartnerIdForAssessmentCreation,
  redirectToLoginOnDeadSession,
  requireAdminScope,
  requireAssessmentAccess,
  resolveAuthorizedScope,
  resolveTenantClientFilter,
} from '@/lib/auth/authorization'
import { logAuditEvent } from '@/lib/auth/support-sessions'
import { logActionError, throwActionError } from '@/lib/security/action-errors'
import { mapAssessmentRow } from '@/lib/supabase/mappers'
import { assessmentSchema } from '@/lib/validations/assessments'
import { getItemsPerConstructForCount } from '@/app/actions/item-selection-rules'
import { getAssessmentContentSummaries } from '@/lib/dal/assessment-content'
import {
  applyPerConstructLimit,
  autoBuildSectionsFromFactors,
  getFormatBreakdownForScope,
  persistSections,
} from '@/lib/dal/assessment-sections'
import { seedAssessmentPreview } from '@/lib/sample-data/seed-preview'
import type { Assessment, ItemOrdering, ScoringProfile } from '@/types/database'
import type { ForcedChoiceBlockDraft } from '@/lib/forced-choice-generator'

/**
 * Best-effort preview seed. A failure here MUST NOT fail the parent
 * create/update request — preview data is a convenience, not a correctness
 * requirement. Logs as warn so admins can diagnose.
 */
async function refreshPreviewSeed(assessmentId: string): Promise<void> {
  try {
    const db = createAdminClient()
    await seedAssessmentPreview(db, assessmentId)
  } catch (err) {
    console.warn(`[assessments] preview seed failed for ${assessmentId}:`, err)
  }
}

export type AssessmentWithMeta = Assessment & {
  factorCount: number
}

/**
 * True when the assessment has questions materialised in its delivery tables
 * (sections / FC blocks) — factors linked to item-rich constructs do NOT
 * count until a persist step pulls those items in, because the runner never
 * reads assessment_factors. `null` = check failed; callers must fail closed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function hasDeliverableContent(db: any, assessmentId: string): Promise<boolean | null> {
  try {
    const [summary] = await getAssessmentContentSummaries(db, [assessmentId])
    return Boolean(summary?.hasDeliverableContent)
  } catch {
    return null
  }
}

/**
 * Attempt the auto-build. Returns the build result, or null when the build
 * failed on infrastructure (callers fail closed). built:false means the
 * factors genuinely resolve to nothing (or a configured-but-empty layout
 * already exists, which auto-build never clobbers).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tryAutoBuildSections(db: any, assessmentId: string) {
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

const SESSION_EXPIRED_ERROR =
  'Your session has expired. Refresh the page and sign in again to keep editing.'

export type BuilderFactor = {
  id: string
  slug: string
  name: string
  description?: string
  dimensionId?: string
  dimensionName?: string
  constructCount: number
  itemCount: number
  isActive: boolean
}

export type AssessmentFactorLink = {
  factorId: string
  weight: number
  itemCount: number
}

export type BuilderConstruct = {
  id: string
  slug: string
  name: string
  description?: string
  dimensionId?: string
  dimensionName?: string
  itemCount: number
  isActive: boolean
}

export type AssessmentConstructLink = {
  constructId: string
  dimensionId: string | null
  weight: number
  itemCount: number
}

/** Format group for section auto-generation in the builder. */
export type FormatGroup = {
  responseFormatId: string
  formatName: string
  formatType: string
  itemCount: number
}

/**
 * What a section is FOR, which changes how it is delivered and scored.
 *
 * `practice` is the load-bearing one: items in a practice section are checked
 * against the key as the respondent answers, are excluded from the score, and
 * gate the scored sections until they are complete (20260814100000). Until
 * this was settable, the only producer of a practice section anywhere was
 * `scripts/cognitive/seed-lrm-assessment.ts` — so a cognitive test could not
 * be assembled through the UI at all.
 */
export type SectionRole = 'scored' | 'practice' | 'instructions'

/** Section draft state used in the builder before persisting. */
export type SectionDraft = {
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

/** Existing FC block loaded from DB for editing. */
export type ExistingFCBlock = {
  id: string
  items: {
    itemId: string
    constructId: string
    stem: string
    constructName: string
    position: number
  }[]
}

/** Existing section loaded from DB for editing. */
export type ExistingSection = {
  id: string
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

export type WorkspaceAssessmentSummary = {
  id: string
  title: string
  description?: string
  status: Assessment['status']
  clientId?: string
  clientName?: string
  campaignCount: number
  participantCount: number
  completedCount: number
  campaignTitles: string[]
  clientNames: string[]
  updatedAt?: string
}

export type AssessmentLibrarySummary = WorkspaceAssessmentSummary & {
  ownerScope: 'partner' | 'platform'
  partnerId?: string
  canEdit: boolean
}

function getRelatedRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    const first = value[0]
    return first && typeof first === 'object' ? (first as Record<string, unknown>) : null
  }

  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
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

export async function getAssessments(): Promise<AssessmentWithMeta[]> {
  await requireAdminScope()
  const db = await createClient()
  const { data, error } = await db
    .from('assessments')
    .select('*, assessment_factors(count)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    throwActionError('getAssessments', 'Unable to load assessments.', error)
  }

  return (data ?? []).map((row) => ({
    ...mapAssessmentRow(row),
    factorCount:
      (row as Record<string, unknown>).assessment_factors
        ? ((row as Record<string, unknown>).assessment_factors as { count: number }[])[0]?.count ?? 0
        : 0,
  }))
}

export async function getWorkspaceAssessmentSummaries(): Promise<WorkspaceAssessmentSummary[]> {
  const scope = await resolveAuthorizedScope()
  const db = await createClient()

  // `null` here means unrestricted, which getAccessibleCampaignIds now grants
  // only outside a tenant workspace; an empty list means nothing is visible.
  const accessibleCampaignIds = await getAccessibleCampaignIds(scope)
  if (accessibleCampaignIds && accessibleCampaignIds.length === 0) {
    return []
  }

  let query = db
    .from('campaign_assessments')
    .select(
      'campaign_id, assessment_id, campaigns:campaigns_with_counts(id, title, status, client_id, clients(name), participant_count), assessments(id, title, description, status, client_id, updated_at)'
    )
    .order('created_at', { ascending: false })

  if (accessibleCampaignIds) {
    query = query.in('campaign_id', accessibleCampaignIds)
  }

  const { data, error } = await query

  if (error) {
    throwActionError(
      'getWorkspaceAssessmentSummaries',
      'Unable to load assessments.',
      error
    )
  }

  const campaignIds = Array.from(
    new Set((data ?? []).map((row) => String(row.campaign_id ?? '')).filter(Boolean))
  )

  const completedCounts = new Map<string, number>()
  if (campaignIds.length > 0) {
    const { data: completedRows, error: completedError } = await db
      .from('campaign_participants')
      .select('campaign_id')
      .in('campaign_id', campaignIds)
      .eq('status', 'completed')

    if (completedError) {
      throwActionError(
        'getWorkspaceAssessmentSummaries.completedCounts',
        'Unable to load assessments.',
        completedError
      )
    }

    for (const row of completedRows ?? []) {
      const campaignId = String(row.campaign_id)
      completedCounts.set(campaignId, (completedCounts.get(campaignId) ?? 0) + 1)
    }
  }

  const summaries = new Map<
    string,
    WorkspaceAssessmentSummary & {
      _campaignIds: Set<string>
      _campaignTitles: Set<string>
      _clientNames: Set<string>
    }
  >()

  for (const row of data ?? []) {
    const assessmentRow = getRelatedRecord(row.assessments)
    if (!assessmentRow?.id || !assessmentRow?.title) {
      continue
    }

    const assessmentId = String(assessmentRow.id)
    const campaignRow = getRelatedRecord(row.campaigns)
    const campaignId = campaignRow?.id ? String(campaignRow.id) : String(row.campaign_id ?? '')
    const campaignTitle = campaignRow?.title ? String(campaignRow.title) : null
    const clientRow = getRelatedRecord(campaignRow?.clients)
    const clientName = clientRow?.name ? String(clientRow.name) : undefined
    const participantCount = Number(campaignRow?.participant_count ?? 0)

    const existing = summaries.get(assessmentId)
    if (existing) {
      if (campaignId && !existing._campaignIds.has(campaignId)) {
        existing._campaignIds.add(campaignId)
        existing.campaignCount += 1
        existing.participantCount += participantCount
        existing.completedCount += completedCounts.get(campaignId) ?? 0
      }
      if (campaignTitle) {
        existing._campaignTitles.add(campaignTitle)
      }
      if (clientName) {
        existing._clientNames.add(clientName)
      }
      continue
    }

    const campaignIdsSet = new Set<string>()
    if (campaignId) {
      campaignIdsSet.add(campaignId)
    }

    const campaignTitles = new Set<string>()
    if (campaignTitle) {
      campaignTitles.add(campaignTitle)
    }

    const clientNames = new Set<string>()
    if (clientName) {
      clientNames.add(clientName)
    }

    summaries.set(assessmentId, {
      id: assessmentId,
      title: String(assessmentRow.title),
      description: assessmentRow.description ? String(assessmentRow.description) : undefined,
      status: assessmentRow.status as Assessment['status'],
      clientId: assessmentRow.client_id ? String(assessmentRow.client_id) : undefined,
      clientName: clientName,
      campaignCount: campaignId ? 1 : 0,
      participantCount,
      completedCount: campaignId ? (completedCounts.get(campaignId) ?? 0) : 0,
      campaignTitles: [],
      clientNames: [],
      updatedAt: assessmentRow.updated_at ? String(assessmentRow.updated_at) : undefined,
      _campaignIds: campaignIdsSet,
      _campaignTitles: campaignTitles,
      _clientNames: clientNames,
    })
  }

  return Array.from(summaries.values())
    .map((entry) => {
      const clientNames = Array.from(entry._clientNames)
      return {
        id: entry.id,
        title: entry.title,
        description: entry.description,
        status: entry.status,
        clientId: entry.clientId,
        clientName: entry.clientName ?? clientNames[0] ?? undefined,
        campaignCount: entry.campaignCount,
        participantCount: entry.participantCount,
        completedCount: entry.completedCount,
        campaignTitles: Array.from(entry._campaignTitles),
        clientNames,
        updatedAt: entry.updatedAt,
      }
    })
    .sort((a, b) => {
      if (b.completedCount !== a.completedCount) {
        return b.completedCount - a.completedCount
      }
      if (b.campaignCount !== a.campaignCount) {
        return b.campaignCount - a.campaignCount
      }
      return a.title.localeCompare(b.title)
    })
}

export async function getPartnerAssessmentLibrary(): Promise<AssessmentLibrarySummary[]> {
  const scope = await resolveAuthorizedScope()

  // Partner-owned assessments, plus the shared library. `null` = unrestricted,
  // which only holds outside every workspace: a platform admin standing in one
  // sees that workspace's partners, not the whole platform's.
  let partnerFilter: string[] | null = null
  if (resolveTenantClientFilter(scope) !== null) {
    partnerFilter = scope.isPlatformAdmin
      ? await getAccessiblePartnerIds(scope)
      : scope.partnerIds
    if (partnerFilter.length === 0) {
      return []
    }
  }

  const db = createAdminClient()
  let query = db
    .from('assessments')
    .select('id, title, description, status, partner_id, updated_at')
    .is('deleted_at', null)
    .is('client_id', null)

  if (partnerFilter) {
    query = query.or(
      `partner_id.in.(${partnerFilter.join(',')}),and(partner_id.is.null,client_id.is.null)`
    )
  }

  const { data, error } = await query.order('updated_at', { ascending: false })

  if (error) {
    throwActionError('getPartnerAssessmentLibrary', 'Unable to load assessments.', error)
  }

  const assessmentRows = (data ?? []) as Array<Record<string, unknown>>
  if (assessmentRows.length === 0) {
    return []
  }

  const assessmentIds = assessmentRows.map((row) => String(row.id))
  const accessibleCampaignIds = await getAccessibleCampaignIds(scope)

  let deploymentRows:
    | Array<Record<string, unknown>>
    | null = []
  let deploymentError: unknown = null

  if (accessibleCampaignIds === null || accessibleCampaignIds.length > 0) {
    let deploymentQuery = db
      .from('campaign_assessments')
      .select(
        'assessment_id, campaign_id, campaigns:campaigns_with_counts(id, title, client_id, clients(name), participant_count)'
      )
      .in('assessment_id', assessmentIds)

    if (accessibleCampaignIds) {
      deploymentQuery = deploymentQuery.in('campaign_id', accessibleCampaignIds)
    }

    const response = await deploymentQuery
    deploymentRows = (response.data ?? []) as Array<Record<string, unknown>>
    deploymentError = response.error
  }

  if (deploymentError) {
    throwActionError(
      'getPartnerAssessmentLibrary.deployments',
      'Unable to load assessments.',
      deploymentError
    )
  }

  const campaignIds = Array.from(
    new Set((deploymentRows ?? []).map((row) => String(row.campaign_id ?? '')).filter(Boolean))
  )
  const completedCounts = new Map<string, number>()

  if (campaignIds.length > 0) {
    const { data: completedRows, error: completedError } = await db
      .from('campaign_participants')
      .select('campaign_id')
      .in('campaign_id', campaignIds)
      .eq('status', 'completed')

    if (completedError) {
      throwActionError(
        'getPartnerAssessmentLibrary.completedCounts',
        'Unable to load assessments.',
        completedError
      )
    }

    for (const row of completedRows ?? []) {
      const campaignId = String(row.campaign_id)
      completedCounts.set(campaignId, (completedCounts.get(campaignId) ?? 0) + 1)
    }
  }

  const summaries = new Map<string, AssessmentLibrarySummary>()

  for (const row of assessmentRows) {
    const assessmentId = String(row.id)
    const partnerId = row.partner_id ? String(row.partner_id) : undefined

    summaries.set(assessmentId, {
      id: assessmentId,
      title: String(row.title),
      description: row.description ? String(row.description) : undefined,
      status: row.status as Assessment['status'],
      partnerId,
      campaignCount: 0,
      participantCount: 0,
      completedCount: 0,
      campaignTitles: [],
      clientNames: [],
      updatedAt: row.updated_at ? String(row.updated_at) : undefined,
      ownerScope: partnerId ? 'partner' : 'platform',
      canEdit: canManageAssessment(scope, partnerId ?? null, null),
    })
  }

  for (const row of deploymentRows ?? []) {
    const summary = summaries.get(String(row.assessment_id))
    if (!summary) {
      continue
    }

    const campaignRow = getRelatedRecord(row.campaigns)
    const campaignId = campaignRow?.id ? String(campaignRow.id) : String(row.campaign_id ?? '')
    const campaignTitle = campaignRow?.title ? String(campaignRow.title) : null
    const clientRow = getRelatedRecord(campaignRow?.clients)
    const clientName = clientRow?.name ? String(clientRow.name) : null
    const participantCount = Number(campaignRow?.participant_count ?? 0)

    summary.campaignCount += campaignId ? 1 : 0
    summary.participantCount += participantCount
    summary.completedCount += campaignId ? (completedCounts.get(campaignId) ?? 0) : 0

    if (campaignTitle && !summary.campaignTitles.includes(campaignTitle)) {
      summary.campaignTitles = [...summary.campaignTitles, campaignTitle]
    }

    if (clientName && !summary.clientNames.includes(clientName)) {
      summary.clientNames = [...summary.clientNames, clientName]
    }
  }

  return Array.from(summaries.values()).sort((a, b) => {
    if (a.ownerScope !== b.ownerScope) {
      return a.ownerScope === 'partner' ? -1 : 1
    }

    if (b.updatedAt && a.updatedAt && b.updatedAt !== a.updatedAt) {
      return b.updatedAt.localeCompare(a.updatedAt)
    }

    return a.title.localeCompare(b.title)
  })
}

export async function getAssessmentById(id: string): Promise<Assessment | null> {
  try {
    await requireAssessmentAccess(id)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return null
    }
    redirectToLoginOnDeadSession(error)
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('assessments')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) return null
  return mapAssessmentRow(data)
}

/**
 * Current factor ids in canvas order, straight from the database.
 *
 * The client router cache may serve an edit tab's RSC payload for up to 30s
 * (staleTimes.dynamic), and the per-interaction auto-saves deliberately do
 * NOT purge it (see updateAssessmentComposition). Editors that seed state
 * from server props call this on mount to reconcile against server truth,
 * closing that staleness window without reintroducing the purge.
 * Returns null when the caller can't read the assessment.
 */
export async function getAssessmentFactorIds(id: string): Promise<string[] | null> {
  try {
    await requireAssessmentAccess(id)
  } catch (error) {
    if (error instanceof AuthorizationError) return null
    if (error instanceof AuthenticationRequiredError) return null
    throw error
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('assessment_factors')
    .select('factor_id')
    .eq('assessment_id', id)
    .order('display_order', { ascending: true })

  if (error) return null
  return (data ?? []).map((r) => String(r.factor_id))
}

export async function getAssessmentWithFactors(id: string): Promise<{
  assessment: Assessment
  factors: AssessmentFactorLink[]
  sections: ExistingSection[]
} | null> {
  try {
    await requireAssessmentAccess(id, { forWrite: true })
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return null
    }
    redirectToLoginOnDeadSession(error)
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('assessments')
    .select('*, assessment_factors(factor_id, weight, item_count, display_order)')
    .eq('id', id)
    .is('deleted_at', null)
    .order('display_order', {
      referencedTable: 'assessment_factors',
      ascending: true,
    })
    .single()

  if (error) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = data as any

  const { data: sectionRows } = await db
    .from('assessment_sections')
    .select('*, response_formats(name, type), assessment_section_items(count)')
    .eq('assessment_id', id)
    .order('display_order', { ascending: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sections: ExistingSection[] = (sectionRows ?? []).map((s: any) => ({
    id: s.id,
    responseFormatId: s.response_format_id,
    formatName: s.response_formats?.name ?? '',
    formatType: s.response_formats?.type ?? '',
    title: s.title ?? '',
    instructions: s.instructions ?? '',
    displayOrder: s.display_order,
    itemOrdering: s.item_ordering,
    timeLimitSeconds: s.time_limit_seconds ?? null,
    sectionRole: (s.section_role ?? 'scored') as SectionRole,
    itemCount: s.assessment_section_items?.[0]?.count ?? 0,
  }))

  return {
    assessment: mapAssessmentRow(data),
    factors: (r.assessment_factors ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ac: any) => ({
        factorId: ac.factor_id,
        weight: Number(ac.weight),
        itemCount: ac.item_count ?? 0,
      })
    ),
    sections,
  }
}

/**
 * Get item format breakdown for selected factors or constructs.
 * Returns how many active items exist per response format across the given
 * factors' constructs (factor-scope) or the given constructs directly
 * (construct-scope). Accepts a legacy positional factorIds array, or a scope
 * object naming factorIds / constructIds explicitly.
 */
export async function getFormatBreakdown(
  scope: string[] | { factorIds?: string[]; constructIds?: string[] },
): Promise<FormatGroup[]> {
  await requireAssessmentBuilderScope()

  const factorIds = Array.isArray(scope) ? scope : scope.factorIds ?? []
  const directConstructIds = Array.isArray(scope) ? [] : scope.constructIds ?? []

  return getFormatBreakdownForScope(createAdminClient(), {
    factorIds,
    constructIds: directConstructIds,
  })
}

export async function getFactorsForBuilder(): Promise<BuilderFactor[]> {
  await requireAssessmentBuilderScope()
  const db = createAdminClient()
  const { data, error } = await db
    .from('factors')
    .select('*, dimensions(name), factor_constructs(construct_id)')
    .eq('is_active', true)
    .is('deleted_at', null)
    // Drafts haven't cleared the assessment-ready bar — keep them out of the builder.
    .neq('readiness', 'draft')
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)

  // Gather all construct IDs to count items per factor
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = data as any[] ?? []
  const allConstructIds = new Set<string>()
  const constructsByFactor = new Map<string, string[]>()

  for (const r of rows) {
    const cIds = (r.factor_constructs ?? []).map((fc: { construct_id: string }) => fc.construct_id)
    constructsByFactor.set(r.id, cIds)
    for (const cId of cIds) allConstructIds.add(cId)
  }

  // Count active items per construct in one query
  const itemCountByConstruct: Record<string, number> = {}
  if (allConstructIds.size > 0) {
    const { data: items } = await db
      .from('items')
      .select('construct_id')
      .in('construct_id', [...allConstructIds])
      .eq('status', 'active')

    for (const item of items ?? []) {
      itemCountByConstruct[item.construct_id] = (itemCountByConstruct[item.construct_id] ?? 0) + 1
    }
  }

  return rows.map((r) => {
    const cIds = constructsByFactor.get(r.id) ?? []
    const itemCount = cIds.reduce((sum, cId) => sum + (itemCountByConstruct[cId] ?? 0), 0)
    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      description: r.description ?? undefined,
      dimensionId: r.dimension_id ?? undefined,
      dimensionName: r.dimensions?.name ?? undefined,
      constructCount: cIds.length,
      itemCount,
      isActive: r.is_active,
    }
  })
}

export async function getConstructsForBuilder(): Promise<BuilderConstruct[]> {
  await requireAssessmentBuilderScope()
  const db = createAdminClient()

  const { data: constructs, error } = await db
    .from('constructs')
    .select('id, slug, name, description, is_active')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)

  const constructIds = (constructs ?? []).map((c) => c.id)
  if (constructIds.length === 0) return []

  // Find a dimension for each construct by walking factor_constructs → factors → dimension.
  const { data: fcLinks } = await db
    .from('factor_constructs')
    .select('construct_id, factors(dimension_id, dimensions(id, name))')
    .in('construct_id', constructIds)

  const dimByConstruct = new Map<string, { id: string; name: string }>()
  for (const link of fcLinks ?? []) {
    if (dimByConstruct.has(link.construct_id)) continue
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const f = (link as any).factors
    const dim = Array.isArray(f) ? f[0]?.dimensions : f?.dimensions
    const dimRow = Array.isArray(dim) ? dim[0] : dim
    if (dimRow?.id) dimByConstruct.set(link.construct_id, { id: dimRow.id, name: dimRow.name })
  }

  // Count active items per construct
  const { data: items } = await db
    .from('items')
    .select('construct_id')
    .in('construct_id', constructIds)
    .eq('status', 'active')

  const itemCountByConstruct = new Map<string, number>()
  for (const i of items ?? []) {
    itemCountByConstruct.set(
      i.construct_id,
      (itemCountByConstruct.get(i.construct_id) ?? 0) + 1,
    )
  }

  return (constructs ?? []).map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description ?? undefined,
    dimensionId: dimByConstruct.get(c.id)?.id,
    dimensionName: dimByConstruct.get(c.id)?.name,
    itemCount: itemCountByConstruct.get(c.id) ?? 0,
    isActive: c.is_active,
  }))
}

export async function createAssessment(payload: Record<string, unknown>) {
  let scope = null as Awaited<ReturnType<typeof requireAssessmentBuilderScope>> | null
  let partnerId: string | null = null
  try {
    scope = await requireAssessmentBuilderScope()
    partnerId = scope.isPlatformAdmin
      ? null
      : getPreferredPartnerIdForAssessmentCreation(scope)
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

  const db = createAdminClient()
  const { data: assessment, error } = await db.from('assessments').insert({
    partner_id: partnerId,
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

export async function updateAssessment(id: string, payload: Record<string, unknown>) {
  let scope = null as Awaited<ReturnType<typeof resolveAuthorizedScope>> | null
  try {
    ;({ scope } = await requireAssessmentAccess(id, { forWrite: true }))
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

  const db = createAdminClient()

  const responseCheck = await assertNoParticipantResponses(db, id)
  if (responseCheck) return { error: { _form: [responseCheck] } }

  const lockName = await getAssessmentCustomReportLockName(db, id)
  if (lockName) {
    return { error: { _form: [formatTaxonomyLockedError(lockName)] } }
  }

  const { error: updateErr } = await db
    .from('assessments')
    .update({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      status: parsed.data.status,
      item_selection_strategy: parsed.data.itemSelectionStrategy,
      scoring_method: 'ctt',
      creation_mode: parsed.data.creationMode,
      format_mode: parsed.data.formatMode,
      fc_block_size: parsed.data.fcBlockSize ?? null,
      source_id: parsed.data.sourceId || null,
    })
    .eq('id', id)

  if (updateErr) return { error: { _form: [updateErr.message] } }

  // Atomic replacement (advisory-locked transaction in the RPC) — see
  // updateAssessmentComposition for the rationale.
  const { error: linkError } = await db.rpc('replace_assessment_factors', {
    p_assessment_id: id,
    p_factors: parsed.data.factors.map((f) => ({
      factor_id: f.factorId,
      weight: f.weight,
      item_count: f.itemCount,
    })),
  })
  if (linkError) return { error: { _form: [linkError.message] } }

  // Guard: if any existing section of this assessment has participant responses,
  // we cannot safely replace sections — the participant_responses.section_id FK
  // is ON DELETE NO ACTION, so the delete would silently fail and persistSections
  // would insert duplicates alongside the old ones. Surface a clear error instead.
  const { data: existingSectionRows, error: existingSectionsErr } = await db
    .from('assessment_sections')
    .select('id')
    .eq('assessment_id', id)

  if (existingSectionsErr) {
    logActionError('updateAssessment.loadExistingSections', existingSectionsErr)
    return { error: { _form: ['Unable to load existing sections.'] } }
  }

  const existingSectionIds = (existingSectionRows ?? []).map((s: { id: string }) => s.id)

  if (existingSectionIds.length > 0) {
    const { count: responseCount, error: responseCountErr } = await db
      .from('participant_responses')
      .select('*', { count: 'exact', head: true })
      .in('section_id', existingSectionIds)

    if (responseCountErr) {
      logActionError('updateAssessment.countResponses', responseCountErr)
      return { error: { _form: ['Unable to check existing responses.'] } }
    }

    if (responseCount && responseCount > 0) {
      return {
        error: {
          _form: [
            `Cannot modify this assessment's structure: ${responseCount} participant response(s) already exist. Clone this assessment into a new version to make structural changes.`,
          ],
        },
      }
    }
  }

  if (parsed.data.formatMode === 'traditional') {
    // Replace sections (cascade deletes section_items)
    const { error: deleteSectionsErr } = await db
      .from('assessment_sections')
      .delete()
      .eq('assessment_id', id)

    if (deleteSectionsErr) {
      logActionError('updateAssessment.deleteSections', deleteSectionsErr)
      return { error: { _form: [`Unable to replace sections: ${deleteSectionsErr.message}`] } }
    }

    const sections = (payload.sections ?? []) as SectionDraft[]
    if (sections.length > 0) {
      const factorIds = parsed.data.factors.map((f) => f.factorId)
      const { error: sectionErr } = await persistSections(db, id, sections, {
        factorIds,
      })
      if (sectionErr) return { error: { _form: [sectionErr] } }
    }

    // Clean up any stale FC blocks
    await db.from('forced_choice_block_items').delete()
      .in('block_id', (await db.from('forced_choice_blocks').select('id').eq('assessment_id', id)).data?.map((b: { id: string }) => b.id) ?? [])
    await db.from('forced_choice_blocks').delete().eq('assessment_id', id)
  } else {
    // Forced-choice mode: persist blocks, clean up sections
    const { error: deleteSectionsErr } = await db
      .from('assessment_sections')
      .delete()
      .eq('assessment_id', id)

    if (deleteSectionsErr) {
      logActionError('updateAssessment.deleteSections', deleteSectionsErr)
      return { error: { _form: [`Unable to clear sections: ${deleteSectionsErr.message}`] } }
    }

    const fcBlocks = (payload.forcedChoiceBlocks ?? []) as ForcedChoiceBlockDraft[]
    if (fcBlocks.length > 0) {
      // Delete existing blocks first
      const { data: existingBlockIds } = await db
        .from('forced_choice_blocks')
        .select('id')
        .eq('assessment_id', id)
      const oldBlockIds = (existingBlockIds ?? []).map((b: { id: string }) => b.id)
      if (oldBlockIds.length > 0) {
        await db.from('forced_choice_block_items').delete().in('block_id', oldBlockIds)
        await db.from('forced_choice_blocks').delete().eq('assessment_id', id)
      }

      const blockErr = await persistForcedChoiceBlocks(db, id, fcBlocks)
      if (blockErr) return { error: { _form: [blockErr] } }
    }
  }

  // Fail closed on empty-but-active: the status update above already wrote the
  // requested status and the sections were just rewritten, so try the
  // factor-derived auto-build, then demote back to draft whenever the content
  // isn't verified deliverable — including when the verification itself fails,
  // since an unverified active assessment is the exact state this guard
  // exists to prevent.
  if (parsed.data.status === 'active') {
    let deliverable = await hasDeliverableContent(db, id)
    if (deliverable === false) {
      const built = await tryAutoBuildSections(db, id)
      if (built === null) deliverable = null
      else if (built.built) deliverable = true
    }
    if (!deliverable) {
      await db.from('assessments').update({ status: 'draft' }).eq('id', id)
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
    eventType: 'assessment.updated',
    targetTable: 'assessments',
    targetId: id,
    metadata: {
      formatMode: parsed.data.formatMode,
      factorCount: parsed.data.factors.length,
    },
  })
  await refreshPreviewSeed(id)
  return { success: true as const, id }
}

export async function deleteAssessment(id: string) {
  let scope = null as Awaited<ReturnType<typeof resolveAuthorizedScope>> | null
  try {
    ;({ scope } = await requireAssessmentAccess(id, { forWrite: true }))
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  if (!scope) {
    return { error: 'Unable to resolve assessment scope.' }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('assessments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  // Cascade-equivalent: FK is ON DELETE CASCADE but fires only on hard DELETE.
  // Not restored on undelete — admin re-enables manually.
  await db
    .from('client_assessment_assignments')
    .update({ is_active: false })
    .eq('assessment_id', id)
    .eq('is_active', true)
  await db
    .from('partner_assessment_assignments')
    .update({ is_active: false })
    .eq('assessment_id', id)
    .eq('is_active', true)

  revalidateAssessmentPaths()
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'assessment.deleted',
    targetTable: 'assessments',
    targetId: id,
  })
}

export async function restoreAssessment(id: string) {
  let scope = null as Awaited<ReturnType<typeof resolveAuthorizedScope>> | null
  try {
    ;({ scope } = await requireAssessmentAccess(id, { includeArchived: true, forWrite: true }))
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  if (!scope) {
    return { error: 'Unable to resolve assessment scope.' }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('assessments')
    .update({ deleted_at: null })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidateAssessmentPaths()
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'assessment.restored',
    targetTable: 'assessments',
    targetId: id,
  })
}

export async function updateAssessmentField(id: string, field: string, value: string) {
  let scope = null as Awaited<ReturnType<typeof resolveAuthorizedScope>> | null
  try {
    ;({ scope } = await requireAssessmentAccess(id, { forWrite: true }))
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  if (!scope) {
    return { error: 'Unable to resolve assessment scope.' }
  }

  if (field !== 'description') {
    return { error: 'Only description can be auto-saved' }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('assessments')
    .update({ [field]: value || null })
    .eq('id', id)

  if (error) return { error: error.message }

  // No revalidatePath: per-interaction auto-saves must not trigger the full-route
  // re-render + prefetch-cache purge that revalidation inside an action causes.
  // List pages render dynamically per-request; router cache staleness ≤30s.
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'assessment.description.updated',
    targetTable: 'assessments',
    targetId: id,
    metadata: { field },
  })
}

/**
 * Update factor customisation settings for an assessment (Zone 1 — immediate save).
 * Pass `null` to disable customisation; pass a number to set the minimum.
 */
export async function updateAssessmentCustomisation(
  assessmentId: string,
  minCustomFactors: number | null
): Promise<{ success: true } | { error: string }> {
  let scope = null as Awaited<ReturnType<typeof resolveAuthorizedScope>> | null
  try {
    ;({ scope } = await requireAssessmentAccess(assessmentId, { forWrite: true }))
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  if (!scope) {
    return { error: 'Unable to resolve assessment scope.' }
  }

  const db = createAdminClient()

  if (minCustomFactors !== null) {
    const lockName = await getAssessmentCustomReportLockName(db, assessmentId)
    if (lockName) return { error: formatTaxonomyLockedError(lockName) }

    // Validate: get factor count for this assessment
    const { count } = await db
      .from('assessment_factors')
      .select('*', { count: 'exact', head: true })
      .eq('assessment_id', assessmentId)

    if (minCustomFactors < 1) {
      return { error: 'Minimum must be at least 1' }
    }
    if (count !== null && minCustomFactors > count) {
      return { error: `Minimum cannot exceed the ${count} factors in this assessment` }
    }
  }

  const { error } = await db
    .from('assessments')
    .update({ min_custom_factors: minCustomFactors })
    .eq('id', assessmentId)

  if (error) {
    logActionError('updateAssessmentCustomisation', error)
    return { error: 'Unable to update customisation settings.' }
  }

  // No revalidatePath: per-interaction auto-saves must not trigger the full-route
  // re-render + prefetch-cache purge that revalidation inside an action causes.
  // List pages render dynamically per-request; router cache staleness ≤30s.
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'assessment.customisation.updated',
    targetTable: 'assessments',
    targetId: assessmentId,
    metadata: { minCustomFactors },
  })
  return { success: true }
}

/**
 * Set which scorer a completed session is dispatched to
 * (`src/lib/scoring/dispatch.ts#scoreSession`).
 *
 * Before this action existed, nothing in the app wrote
 * `assessments.scoring_profile`: the column defaulted to `'pomp_factor'`
 * (20260813104000) and every assessment — including a keyed cognitive one —
 * routed to `scoreSessionCTT`, which treats an option's `value` as its score
 * rather than checking it against `item_answer_keys`. A figural-matrix test
 * built through the UI was silently unscoreable as an ability test.
 *
 * Refuses to change profile once responses exist: the two scorers write
 * different rows (`participant_item_outcomes` vs POMP factor scores) from the
 * same responses, so switching mid-collection would leave a cohort scored two
 * incompatible ways with nothing recording which is which.
 */
export async function updateAssessmentScoringProfile(
  assessmentId: string,
  scoringProfile: ScoringProfile,
): Promise<ActionResult> {
  const allowed: ScoringProfile[] = ['pomp_factor', 'ability_dichotomous', 'ability_irt']
  if (!allowed.includes(scoringProfile)) {
    return { error: 'Unknown scoring profile.' }
  }

  let scope = null as Awaited<ReturnType<typeof resolveAuthorizedScope>> | null
  try {
    ;({ scope } = await requireAssessmentAccess(assessmentId, { forWrite: true }))
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: error.message }
    if (error instanceof AuthenticationRequiredError) return { error: SESSION_EXPIRED_ERROR }
    throw error
  }
  if (!scope) return { error: 'Unable to resolve assessment scope.' }

  const db = createAdminClient()

  const { data: current, error: readErr } = await db
    .from('assessments')
    .select('scoring_profile')
    .eq('id', assessmentId)
    .is('deleted_at', null)
    .maybeSingle()
  if (readErr || !current) {
    logActionError('updateAssessmentScoringProfile.load', readErr)
    return { error: 'Unable to load this assessment.' }
  }
  if (current.scoring_profile === scoringProfile) return { success: true }

  const responseCheck = await assertNoParticipantResponses(db, assessmentId)
  if (responseCheck) {
    return {
      error:
        'Participants have already answered questions in this assessment, so its scoring profile is locked. ' +
        'Duplicate the assessment to change how it scores.',
    }
  }

  const { error } = await db
    .from('assessments')
    .update({ scoring_profile: scoringProfile })
    .eq('id', assessmentId)

  if (error) {
    logActionError('updateAssessmentScoringProfile', error)
    return { error: 'Unable to update the scoring profile.' }
  }

  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'assessment.scoringProfile.updated',
    targetTable: 'assessments',
    targetId: assessmentId,
    metadata: { from: current.scoring_profile, to: scoringProfile },
  })
  return { success: true }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Public wrapper for callers (server components, other actions) that don't
 * already have a Supabase admin client in hand. Creates one and delegates
 * to the internal helper.
 */
export async function getAssessmentCustomReportLockNameForAssessment(
  assessmentId: string,
): Promise<string | null> {
  await requireAssessmentAccess(assessmentId)
  const db = createAdminClient()
  return getAssessmentCustomReportLockName(db, assessmentId)
}

/**
 * Returns the name of the custom report bound to this assessment, if any.
 * When non-null, the assessment's taxonomy (factor/construct selection,
 * scoring level, and customisation flags) is locked — its shape underpins
 * a hand-coded report and can't be mutated without breaking the render.
 *
 * Returns null if no custom-report template is attached (i.e. only block-
 * builder templates, or no templates at all).
 */
export async function getAssessmentCustomReportLockName(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  assessmentId: string,
): Promise<string | null> {
  const { data, error } = await db
    .from('assessment_report_templates')
    .select('report_templates(name, custom_report_slug, deleted_at)')
    .eq('assessment_id', assessmentId)

  if (error) {
    logActionError('getAssessmentCustomReportLockName', error)
    return null
  }

  type Row = {
    report_templates:
      | { name?: string | null; custom_report_slug?: string | null; deleted_at?: string | null }
      | { name?: string | null; custom_report_slug?: string | null; deleted_at?: string | null }[]
      | null
  }
  for (const row of (data ?? []) as Row[]) {
    const tpl = Array.isArray(row.report_templates)
      ? row.report_templates[0]
      : row.report_templates
    if (tpl && tpl.custom_report_slug && !tpl.deleted_at) {
      return tpl.name ? String(tpl.name) : 'a custom report'
    }
  }
  return null
}

const TAXONOMY_LOCKED_ERROR_PREFIX =
  'This assessment is bound to a custom report'
function formatTaxonomyLockedError(lockName: string): string {
  return `${TAXONOMY_LOCKED_ERROR_PREFIX} ("${lockName}"). Detach the custom report on the assessment's Reports tab before changing its constructs, factors, or customisation settings.`
}

/**
 * Persist forced-choice blocks for an assessment.
 */
async function persistForcedChoiceBlocks(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
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

/**
 * Get active construct items for the selected factors,
 * with construct info for FC block generation.
 */
export async function getFCItemsForFactors(factorIds: string[]): Promise<{
  itemId: string
  constructId: string
  stem: string
  constructName: string
}[]> {
  await requireAssessmentBuilderScope()
  if (factorIds.length === 0) return []

  const db = createAdminClient()

  // Get construct IDs for these factors
  const { data: links } = await db
    .from('factor_constructs')
    .select('construct_id')
    .in('factor_id', factorIds)

  const constructIds = [...new Set((links ?? []).map((l: { construct_id: string }) => l.construct_id))]
  if (constructIds.length === 0) return []

  // Determine per-construct limit from rules
  const limit = await getItemsPerConstructForCount(constructIds.length)

  // Get active, non-deleted construct items with their construct names
  const { data: items } = await db
    .from('items')
    .select('id, construct_id, stem, display_order, difficulty, reverse_scored, constructs(name)')
    .in('construct_id', constructIds)
    .eq('status', 'active')
    .eq('purpose', 'construct')
    .is('deleted_at', null)

  if (!items || items.length === 0) return []

  // Apply per-construct limiting
  const limitedItems = applyPerConstructLimit(items, limit)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return limitedItems.map((item: any) => ({
    itemId: item.id,
    constructId: item.construct_id,
    stem: item.stem,
    constructName: item.constructs?.name ?? '',
  }))
}

/**
 * Load existing FC blocks for an assessment (for editing).
 */
export async function getExistingBlocks(assessmentId: string): Promise<ExistingFCBlock[]> {
  await requireAssessmentAccess(assessmentId, { forWrite: true })
  const db = createAdminClient()

  const { data: blocks } = await db
    .from('forced_choice_blocks')
    .select('id, forced_choice_block_items(item_id, position, items(stem, construct_id, constructs(name)))')
    .eq('assessment_id', assessmentId)
    .order('display_order', { ascending: true })

  if (!blocks || blocks.length === 0) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return blocks.map((block: any) => ({
    id: block.id,
    items: (block.forced_choice_block_items ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .sort((a: any, b: any) => a.position - b.position)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((bi: any) => ({
        itemId: bi.item_id,
        constructId: bi.items?.construct_id ?? '',
        stem: bi.items?.stem ?? '',
        constructName: bi.items?.constructs?.name ?? '',
        position: bi.position,
      })),
  }))
}

export async function bulkDeleteAssessments(ids: string[]) {
  if (ids.length === 0) return
  const scope = await resolveAuthorizedScope()
  if (!scope.isPlatformAdmin) return { error: 'Unauthorized' }

  const db = createAdminClient()
  const { error } = await db
    .from('assessments')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', ids)

  if (error) return { error: error.message }
  revalidateAssessmentPaths()
}

export async function bulkUpdateAssessmentStatus(ids: string[], status: string) {
  if (ids.length === 0) return
  const scope = await resolveAuthorizedScope()
  if (!scope.isPlatformAdmin) return { error: 'Unauthorized' }

  const db = createAdminClient()
  const { error } = await db
    .from('assessments')
    .update({ status })
    .in('id', ids)

  if (error) return { error: error.message }
  revalidateAssessmentPaths()
}

// ---------------------------------------------------------------------------
// Focused per-tab update actions
// ---------------------------------------------------------------------------
// These actions update a single concern of an assessment so the tabbed editor
// can save one tab without trampling the others. They are intentionally narrow:
// each replaces only the rows it owns. Use createAssessment / updateAssessment
// for the legacy single-shot create+overwrite flow.

type ActionResult<T = void> =
  | (T extends void ? { success: true } : { success: true; data: T })
  | { error: string }

export async function updateAssessmentMeta(
  assessmentId: string,
  updates: {
    title?: string
    description?: string | null
    status?: 'draft' | 'active' | 'archived'
    sourceId?: string | null
  },
): Promise<ActionResult> {
  let scope = null as Awaited<ReturnType<typeof resolveAuthorizedScope>> | null
  try {
    ;({ scope } = await requireAssessmentAccess(assessmentId, { forWrite: true }))
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: error.message }
    // A dead session must degrade to a structured error, not a thrown one — a
    // throw from an action lands in the route error boundary ("We hit a
    // snag") instead of telling the user to sign back in.
    if (error instanceof AuthenticationRequiredError) return { error: SESSION_EXPIRED_ERROR }
    throw error
  }
  if (!scope) return { error: 'Unable to resolve assessment scope.' }

  const patch: Record<string, unknown> = {}
  if (updates.title !== undefined) {
    const trimmed = updates.title.trim()
    if (!trimmed) return { error: 'Title cannot be empty.' }
    if (trimmed.length > 300) return { error: 'Title is too long (max 300 chars).' }
    patch.title = trimmed
  }
  if (updates.description !== undefined) {
    patch.description = updates.description ?? null
  }
  if (updates.status !== undefined) {
    patch.status = updates.status
  }
  if (updates.sourceId !== undefined) {
    patch.source_id = updates.sourceId || null
  }

  if (Object.keys(patch).length === 0) return { success: true }

  const db = createAdminClient()

  if (updates.status === 'active') {
    let deliverable = await hasDeliverableContent(db, assessmentId)
    if (deliverable === false) {
      // No Presentation step saved — build the default layout from the
      // selected factors right here instead of bouncing the user to another tab.
      const built = await tryAutoBuildSections(db, assessmentId)
      if (built === null) deliverable = null
      else if (built.built) {
        deliverable = true
        await logAuditEvent({
          actorProfileId: scope.actor?.id ?? null,
          eventType: 'assessment.sections.autobuilt',
          targetTable: 'assessments',
          targetId: assessmentId,
          metadata: { itemCount: built.itemCount, trigger: 'activation' },
        })
      }
    }
    if (deliverable === null) return { error: CONTENT_CHECK_FAILED_ERROR }
    if (!deliverable) return { error: EMPTY_ASSESSMENT_ACTIVATION_ERROR }
  }

  const { error } = await db
    .from('assessments')
    .update(patch)
    .eq('id', assessmentId)

  if (error) {
    logActionError('updateAssessmentMeta', error)
    return { error: 'Unable to save changes.' }
  }

  // No revalidatePath: per-interaction auto-saves must not trigger the full-route
  // re-render + prefetch-cache purge that revalidation inside an action causes.
  // List pages render dynamically per-request; router cache staleness ≤30s.
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'assessment.meta.updated',
    targetTable: 'assessments',
    targetId: assessmentId,
    metadata: { fields: Object.keys(patch) },
  })
  return { success: true }
}

/**
 * Replace the factor selection on an assessment. Does NOT touch sections or
 * fc_blocks — those are owned by the Presentation tab and may need to be
 * regenerated after composition changes.
 */
export async function updateAssessmentComposition(
  assessmentId: string,
  payload: { factors: Array<{ factorId: string; weight?: number }> },
): Promise<ActionResult> {
  let scope = null as Awaited<ReturnType<typeof resolveAuthorizedScope>> | null
  try {
    ;({ scope } = await requireAssessmentAccess(assessmentId, { forWrite: true }))
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: error.message }
    // A dead session must degrade to a structured error, not a thrown one — a
    // throw from an action lands in the route error boundary ("We hit a
    // snag") instead of telling the user to sign back in.
    if (error instanceof AuthenticationRequiredError) return { error: SESSION_EXPIRED_ERROR }
    throw error
  }
  if (!scope) return { error: 'Unable to resolve assessment scope.' }

  const db = createAdminClient()
  const responseCheck = await assertNoParticipantResponses(db, assessmentId)
  if (responseCheck) return { error: responseCheck }

  const lockName = await getAssessmentCustomReportLockName(db, assessmentId)
  if (lockName) return { error: formatTaxonomyLockedError(lockName) }

  // Atomic replacement (advisory-locked transaction in the RPC): concurrent
  // writers — second tab, partner portal — can no longer interleave the old
  // delete/insert pair into unique violations or a stranded empty selection.
  // Array order is persisted as display_order, so the canvas order survives.
  const { error } = await db.rpc('replace_assessment_factors', {
    p_assessment_id: assessmentId,
    p_factors: payload.factors.map((f) => ({
      factor_id: f.factorId,
      weight: f.weight ?? 1,
      item_count: 0,
    })),
  })
  if (error) {
    logActionError('updateAssessmentComposition.factors', error)
    return { error: 'Unable to save factor selection.' }
  }

  // No revalidatePath here: any revalidation inside a server action makes
  // Next re-render the whole current route in the action response and purge
  // the client prefetch cache — the "entire shell flips to its loading page"
  // on every drag. The list pages that show factor counts are dynamically
  // rendered per-request and the client router cache is capped at 30s
  // (staleTimes.dynamic), so they stay fresh without a per-keystroke purge.
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'assessment.composition.updated',
    targetTable: 'assessments',
    targetId: assessmentId,
    metadata: { factorCount: payload.factors.length },
  })
  return { success: true }
}

/**
 * Replace the section / fc-block configuration on an assessment, plus the
 * top-level format_mode toggle. Does NOT touch composition.
 */
export async function updateAssessmentPresentation(
  assessmentId: string,
  payload: {
    formatMode: 'traditional' | 'forced_choice'
    fcBlockSize?: 3 | 4 | null
    sections?: SectionDraft[]
    forcedChoiceBlocks?: ForcedChoiceBlockDraft[]
  },
): Promise<ActionResult> {
  let scope = null as Awaited<ReturnType<typeof resolveAuthorizedScope>> | null
  try {
    ;({ scope } = await requireAssessmentAccess(assessmentId, { forWrite: true }))
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: error.message }
    // A dead session must degrade to a structured error, not a thrown one — a
    // throw from an action lands in the route error boundary ("We hit a
    // snag") instead of telling the user to sign back in.
    if (error instanceof AuthenticationRequiredError) return { error: SESSION_EXPIRED_ERROR }
    throw error
  }
  if (!scope) return { error: 'Unable to resolve assessment scope.' }

  const db = createAdminClient()

  const responseCheck = await assertNoParticipantResponses(db, assessmentId)
  if (responseCheck) return { error: responseCheck }

  const { data: assessmentRow, error: statusErr } = await db
    .from('assessments')
    .select('status')
    .eq('id', assessmentId)
    .single()
  if (statusErr || !assessmentRow) {
    logActionError('updateAssessmentPresentation.loadStatus', statusErr)
    return { error: 'Unable to load this assessment.' }
  }
  const isActive = assessmentRow.status === 'active'

  // Refuse to strip a live assessment down to nothing before wiping anything.
  // Forced-choice mode always counts as nothing servable: it deletes the
  // sections, and the runner only delivers sections (FC blocks have no
  // delivery path — see dal/assessment-content).
  const emptyLayout =
    payload.formatMode !== 'traditional' || (payload.sections ?? []).length === 0
  if (isActive && emptyLayout) {
    return {
      error:
        payload.formatMode === 'traditional'
          ? 'An active assessment needs at least one section with questions. Move it back to draft first if you want to clear its layout.'
          : 'Forced-choice layouts cannot be served to participants yet, so a live assessment cannot switch to forced-choice mode. Move it back to draft first.',
    }
  }

  const { data: af } = await db
    .from('assessment_factors')
    .select('factor_id')
    .eq('assessment_id', assessmentId)
  const factorIds = ((af ?? []) as { factor_id: string }[]).map((r) => r.factor_id)

  // Update top-level fields
  const { error: updErr } = await db
    .from('assessments')
    .update({
      format_mode: payload.formatMode,
      fc_block_size: payload.formatMode === 'forced_choice' ? payload.fcBlockSize ?? null : null,
    })
    .eq('id', assessmentId)
  if (updErr) {
    logActionError('updateAssessmentPresentation.assessmentUpdate', updErr)
    return { error: 'Unable to save presentation settings.' }
  }

  // Wipe & replace sections and FC blocks.
  await db.from('assessment_sections').delete().eq('assessment_id', assessmentId)

  const { data: existingBlockIds } = await db
    .from('forced_choice_blocks')
    .select('id')
    .eq('assessment_id', assessmentId)
  const oldBlockIds = ((existingBlockIds ?? []) as { id: string }[]).map((b) => b.id)
  if (oldBlockIds.length > 0) {
    await db.from('forced_choice_block_items').delete().in('block_id', oldBlockIds)
    await db.from('forced_choice_blocks').delete().eq('assessment_id', assessmentId)
  }

  if (payload.formatMode === 'traditional') {
    const sections = payload.sections ?? []
    if (sections.length > 0) {
      const { error: err } = await persistSections(db, assessmentId, sections, {
        factorIds,
      })
      if (err) return { error: err }
    }
  } else {
    const blocks = payload.forcedChoiceBlocks ?? []
    if (blocks.length > 0) {
      const err = await persistForcedChoiceBlocks(db, assessmentId, blocks)
      if (err) return { error: err }
    }
  }

  // The layout may persist without matching any items (e.g. constructs with no
  // active items in the chosen formats). Never leave that live — demote to
  // draft, including when the verification itself fails: the sections were
  // just rewritten, so an unverified active assessment is exactly the state
  // this guard exists to prevent.
  if (isActive) {
    const deliverable = await hasDeliverableContent(db, assessmentId)
    if (!deliverable) {
      await db.from('assessments').update({ status: 'draft' }).eq('id', assessmentId)
      return {
        error:
          deliverable === null
            ? CONTENT_CHECK_FAILED_ERROR
            : 'No items matched the saved sections, so this assessment was moved back to draft. Check that its factors link to constructs with active items in the chosen response formats, then re-activate it.',
      }
    }
  }

  // No revalidatePath: per-interaction auto-saves must not trigger the full-route
  // re-render + prefetch-cache purge that revalidation inside an action causes.
  // List pages render dynamically per-request; router cache staleness ≤30s.
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'assessment.presentation.updated',
    targetTable: 'assessments',
    targetId: assessmentId,
    metadata: { formatMode: payload.formatMode },
  })
  return { success: true }
}

/**
 * Minimal-fields creator for the simplified `/assessments/create` flow.
 * Sets up a draft assessment with metadata only; composition and presentation
 * are configured afterwards through the tabbed editor.
 */
export async function createAssessmentDraft(payload: {
  title: string
  description?: string
  sourceId?: string
}): Promise<{ success: true; id: string } | { error: string }> {
  let scope = null as Awaited<ReturnType<typeof requireAssessmentBuilderScope>> | null
  try {
    scope = await requireAssessmentBuilderScope()
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: error.message }
    // A dead session must degrade to a structured error, not a thrown one — a
    // throw from an action lands in the route error boundary ("We hit a
    // snag") instead of telling the user to sign back in.
    if (error instanceof AuthenticationRequiredError) return { error: SESSION_EXPIRED_ERROR }
    throw error
  }
  if (!scope) return { error: 'Unable to resolve assessment scope.' }

  const title = payload.title.trim()
  if (!title) return { error: 'Title is required.' }
  if (title.length > 300) return { error: 'Title is too long (max 300 chars).' }

  const partnerId = scope.isPlatformAdmin
    ? null
    : getPreferredPartnerIdForAssessmentCreation(scope)

  const db = createAdminClient()
  const { data, error } = await db
    .from('assessments')
    .insert({
      partner_id: partnerId,
      title,
      description: payload.description?.trim() || null,
      status: 'draft',
      item_selection_strategy: 'fixed',
      scoring_method: 'ctt',
      creation_mode: 'manual',
      format_mode: 'traditional',
      source_id: payload.sourceId || null,
    })
    .select('id')
    .single()

  if (error || !data) {
    logActionError('createAssessmentDraft', error)
    return { error: 'Unable to create assessment.' }
  }

  revalidateAssessmentPaths()
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'assessment.created',
    targetTable: 'assessments',
    targetId: data.id,
    metadata: { source: 'draft-create' },
  })

  return { success: true, id: data.id }
}

/**
 * Returns a string error message if the assessment has participant responses
 * (and therefore cannot be restructured), or null if it's safe to modify.
 */
async function assertNoParticipantResponses(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  assessmentId: string,
): Promise<string | null> {
  const { data: sectionRows, error: sectionError } = await db
    .from('assessment_sections')
    .select('id')
    .eq('assessment_id', assessmentId)

  if (sectionError) return 'Unable to verify assessment usage.'

  const sectionIds = ((sectionRows ?? []) as { id: string }[]).map((s) => s.id)
  if (sectionIds.length === 0) return null

  const { count, error: countError } = await db
    .from('participant_responses')
    .select('*', { count: 'exact', head: true })
    .in('section_id', sectionIds)

  if (countError) return 'Unable to verify assessment usage.'

  const { count: formCount, error: formError } = await db
    .from('participant_section_forms')
    .select('*', { count: 'exact', head: true })
    .in('section_id', sectionIds)
  if (formError) return 'Unable to verify assessment usage.'
  if (formCount && formCount > 0) {
    return 'This assessment has already been delivered. Clone it into a new version before changing its structure.'
  }

  if (count && count > 0) {
    return `Cannot modify this assessment's structure: ${count} participant response(s) already exist. Clone this assessment into a new version to make structural changes.`
  }
  return null
}
