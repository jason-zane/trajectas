'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  AuthorizationError,
  canManageAssessment,
  canManageAssessmentLibrary,
  getAccessibleCampaignIds,
  getPreferredPartnerIdForAssessmentCreation,
  requireAdminScope,
  requireAssessmentAccess,
  resolveAuthorizedScope,
} from '@/lib/auth/authorization'
import { logAuditEvent } from '@/lib/auth/support-sessions'
import { logActionError, throwActionError } from '@/lib/security/action-errors'
import { mapAssessmentRow } from '@/lib/supabase/mappers'
import { assessmentSchema } from '@/lib/validations/assessments'
import { getItemsPerConstructForCount } from '@/app/actions/item-selection-rules'
import { seedAssessmentPreview } from '@/lib/sample-data/seed-preview'
import type { Assessment, ItemOrdering } from '@/types/database'
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

export type BuilderFactor = {
  id: string
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
  itemsPerPage: number | null
  timeLimitSeconds: number | null
  allowBackNav: boolean
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
  itemsPerPage: number | null
  timeLimitSeconds: number | null
  allowBackNav: boolean
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

function getRelatedCount(value: unknown) {
  const record = getRelatedRecord(value)
  return record?.count ? Number(record.count) : 0
}

function revalidateAssessmentPaths() {
  revalidatePath('/assessments')
  revalidatePath('/partner/assessments')
  revalidatePath('/partner')
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

  let accessibleCampaignIds: string[] | null = null
  if (!scope.isPlatformAdmin) {
    accessibleCampaignIds = await getAccessibleCampaignIds(scope)
    if (!accessibleCampaignIds || accessibleCampaignIds.length === 0) {
      return []
    }
  }

  let query = db
    .from('campaign_assessments')
    .select(
      'campaign_id, assessment_id, campaigns(id, title, status, client_id, clients(name), campaign_participants(count)), assessments(id, title, description, status, client_id, updated_at)'
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
    const participantCount = getRelatedCount(campaignRow?.campaign_participants)

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

  if (!scope.isPlatformAdmin && scope.partnerIds.length === 0) {
    return []
  }

  const db = createAdminClient()
  let query = db
    .from('assessments')
    .select('id, title, description, status, partner_id, updated_at')
    .is('deleted_at', null)
    .is('client_id', null)

  if (!scope.isPlatformAdmin) {
    query = query.or(
      `partner_id.in.(${scope.partnerIds.join(',')}),and(partner_id.is.null,client_id.is.null)`
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
  const accessibleCampaignIds = scope.isPlatformAdmin
    ? null
    : await getAccessibleCampaignIds(scope)

  let deploymentRows:
    | Array<Record<string, unknown>>
    | null = []
  let deploymentError: unknown = null

  if (accessibleCampaignIds === null || accessibleCampaignIds.length > 0) {
    let deploymentQuery = db
      .from('campaign_assessments')
      .select(
        'assessment_id, campaign_id, campaigns(id, title, client_id, clients(name), campaign_participants(count))'
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
    const participantCount = getRelatedCount(campaignRow?.campaign_participants)

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
    throw error
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

export async function getAssessmentWithFactors(id: string): Promise<{
  assessment: Assessment
  factors: AssessmentFactorLink[]
  constructs: AssessmentConstructLink[]
  sections: ExistingSection[]
} | null> {
  try {
    await requireAssessmentAccess(id, { forWrite: true })
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return null
    }
    throw error
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('assessments')
    .select(
      '*, assessment_factors(factor_id, weight, item_count), assessment_constructs(construct_id, dimension_id, weight, item_count)',
    )
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = data as any

  // Load existing sections with item counts and format info
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
    itemsPerPage: s.items_per_page ?? null,
    timeLimitSeconds: s.time_limit_seconds ?? null,
    allowBackNav: s.allow_back_nav,
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
    constructs: (r.assessment_constructs ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ac: any) => ({
        constructId: ac.construct_id,
        dimensionId: ac.dimension_id ?? null,
        weight: Number(ac.weight),
        itemCount: ac.item_count ?? 0,
      })
    ),
    sections,
  }
}

/**
 * Get item format breakdown for selected factors.
 * Returns how many active items exist per response format
 * across the given factors' constructs.
 */
export async function getFormatBreakdown(factorIds: string[]): Promise<FormatGroup[]> {
  await requireAssessmentBuilderScope()
  if (factorIds.length === 0) return []

  const db = createAdminClient()

  // Get construct IDs for these factors
  const { data: links } = await db
    .from('factor_constructs')
    .select('construct_id')
    .in('factor_id', factorIds)

  const constructIds = [...new Set((links ?? []).map((l) => l.construct_id))]
  if (constructIds.length === 0) return []

  // Determine per-construct limit from rules
  const limit = await getItemsPerConstructForCount(constructIds.length)

  // Get active, non-deleted items for these constructs with their format info
  const { data: items } = await db
    .from('items')
    .select('id, construct_id, response_format_id, selection_priority, display_order, response_formats(id, name, type)')
    .in('construct_id', constructIds)
    .eq('status', 'active')
    .is('deleted_at', null)

  if (!items || items.length === 0) return []

  // Apply per-construct limiting
  const limitedItems = applyPerConstructLimit(items, limit)

  // Group by format
  const groups = new Map<string, { formatName: string; formatType: string; count: number }>()

  for (const item of limitedItems) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rf = (item as any).response_formats
    const fmtId = item.response_format_id
    const existing = groups.get(fmtId)
    if (existing) {
      existing.count++
    } else {
      groups.set(fmtId, {
        formatName: rf?.name ?? 'Unknown',
        formatType: rf?.type ?? 'unknown',
        count: 1,
      })
    }
  }

  return [...groups.entries()]
    .map(([responseFormatId, g]) => ({
      responseFormatId,
      formatName: g.formatName,
      formatType: g.formatType,
      itemCount: g.count,
    }))
    .sort((a, b) => b.itemCount - a.itemCount)
}

export async function getFactorsForBuilder(): Promise<BuilderFactor[]> {
  await requireAssessmentBuilderScope()
  const db = createAdminClient()
  const { data, error } = await db
    .from('factors')
    .select('*, dimensions(name), factor_constructs(construct_id)')
    .eq('is_active', true)
    .is('deleted_at', null)
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
    .select('id, name, description, is_active')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)

  const constructIds = (constructs ?? []).map((c) => c.id)
  if (constructIds.length === 0) return []

  // Load dimension links (via dimension_constructs). A construct may link to
  // multiple dimensions; for display purposes take the first.
  const { data: dcLinks } = await db
    .from('dimension_constructs')
    .select('construct_id, dimension_id, dimensions(id, name)')
    .in('construct_id', constructIds)

  const dimByConstruct = new Map<string, { id: string; name: string }>()
  for (const link of dcLinks ?? []) {
    if (!dimByConstruct.has(link.construct_id)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dim = (link as any).dimensions as { id: string; name: string } | null
      if (dim) dimByConstruct.set(link.construct_id, dim)
    }
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
  const scoringLevel = (payload.scoringLevel as string) ?? 'factor'
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
    scoring_level: scoringLevel,
    min_custom_constructs: scoringLevel === 'construct'
      ? ((payload.minCustomConstructs as number) ?? null)
      : null,
  }).select('id').single()

  if (error) return { error: { _form: [error.message] } }

  // Insert factor junction records (factor-level scoring)
  if (scoringLevel === 'factor' && parsed.data.factors.length > 0) {
    const links = parsed.data.factors.map((f) => ({
      assessment_id: assessment.id,
      factor_id: f.factorId,
      weight: f.weight,
      item_count: f.itemCount,
    }))
    const { error: linkError } = await db.from('assessment_factors').insert(links)
    if (linkError) return { error: { _form: [linkError.message] } }
  }

  // Insert construct junction records (construct-level scoring)
  if (scoringLevel === 'construct' && parsed.data.constructs.length > 0) {
    const links = parsed.data.constructs.map((c) => ({
      assessment_id: assessment.id,
      construct_id: c.constructId,
      dimension_id: c.dimensionId ?? null,
      weight: c.weight,
      item_count: c.itemCount,
    }))
    const { error: linkError } = await db.from('assessment_constructs').insert(links)
    if (linkError) return { error: { _form: [linkError.message] } }
  }

  // Insert sections (traditional mode)
  const sections = (payload.sections ?? []) as SectionDraft[]
  if (sections.length > 0 && parsed.data.formatMode === 'traditional') {
    const factorIds = parsed.data.factors.map((f) => f.factorId)
    const sectionErr = await persistSections(db, assessment.id, sections, factorIds)
    if (sectionErr) return { error: { _form: [sectionErr] } }
  }

  // Persist FC blocks (forced_choice mode)
  const fcBlocks = (payload.forcedChoiceBlocks ?? []) as ForcedChoiceBlockDraft[]
  if (fcBlocks.length > 0 && parsed.data.formatMode === 'forced_choice') {
    const blockErr = await persistForcedChoiceBlocks(db, assessment.id, fcBlocks)
    if (blockErr) return { error: { _form: [blockErr] } }
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

  const updatedScoringLevel = (payload.scoringLevel as string) ?? 'factor'
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
      scoring_level: updatedScoringLevel,
      min_custom_constructs: updatedScoringLevel === 'construct'
        ? ((payload.minCustomConstructs as number) ?? null)
        : null,
    })
    .eq('id', id)

  if (updateErr) return { error: { _form: [updateErr.message] } }

  // Replace factor junction records (always delete, insert if factor-level)
  await db.from('assessment_factors').delete().eq('assessment_id', id)

  if (updatedScoringLevel === 'factor' && parsed.data.factors.length > 0) {
    const links = parsed.data.factors.map((f) => ({
      assessment_id: id,
      factor_id: f.factorId,
      weight: f.weight,
      item_count: f.itemCount,
    }))
    const { error: linkError } = await db.from('assessment_factors').insert(links)
    if (linkError) return { error: { _form: [linkError.message] } }
  }

  // Replace construct junction records (always delete, insert if construct-level)
  await db.from('assessment_constructs').delete().eq('assessment_id', id)

  if (updatedScoringLevel === 'construct' && parsed.data.constructs.length > 0) {
    const links = parsed.data.constructs.map((c) => ({
      assessment_id: id,
      construct_id: c.constructId,
      dimension_id: c.dimensionId ?? null,
      weight: c.weight,
      item_count: c.itemCount,
    }))
    const { error: linkError } = await db.from('assessment_constructs').insert(links)
    if (linkError) return { error: { _form: [linkError.message] } }
  }

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
      const sectionErr = await persistSections(db, id, sections, factorIds)
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

  revalidateAssessmentPaths()
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

  revalidateAssessmentPaths()
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'assessment.customisation.updated',
    targetTable: 'assessments',
    targetId: assessmentId,
    metadata: { minCustomFactors },
  })
  return { success: true }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Persist sections for an assessment and auto-assign matching items.
 * Items are matched to sections by response_format_id.
 */
async function persistSections(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  assessmentId: string,
  sections: SectionDraft[],
  factorIds: string[],
): Promise<string | null> {
  // Insert sections
  const sectionInserts = sections.map((s) => ({
    assessment_id: assessmentId,
    response_format_id: s.responseFormatId,
    title: s.title.trim() || null,
    instructions: s.instructions || null,
    display_order: s.displayOrder,
    item_ordering: s.itemOrdering,
    items_per_page: s.itemsPerPage ?? null,
    time_limit_seconds: s.timeLimitSeconds ?? null,
    allow_back_nav: s.allowBackNav,
  }))

  const { data: insertedSections, error: secErr } = await db
    .from('assessment_sections')
    .insert(sectionInserts)
    .select('id, response_format_id')

  if (secErr) return secErr.message

  // Get construct IDs for these factors
  const { data: links } = await db
    .from('factor_constructs')
    .select('construct_id')
    .in('factor_id', factorIds)

  const constructIds = [...new Set((links ?? []).map((l: { construct_id: string }) => l.construct_id))]
  if (constructIds.length === 0) return null

  // Determine per-construct limit from rules
  const limit = await getItemsPerConstructForCount(constructIds.length)

  // Get all active, non-deleted items for these constructs with priority ordering
  const { data: items } = await db
    .from('items')
    .select('id, construct_id, response_format_id, selection_priority, display_order')
    .in('construct_id', constructIds)
    .eq('status', 'active')
    .is('deleted_at', null)

  if (!items || items.length === 0) return null

  // Apply per-construct limiting
  const limitedItems = applyPerConstructLimit(items, limit)

  // Build section ID lookup by format
  const sectionByFormat = new Map<string, string>()
  for (const s of insertedSections) {
    sectionByFormat.set(s.response_format_id, s.id)
  }

  // Assign items to matching sections
  const sectionItems: { section_id: string; item_id: string; display_order: number }[] = []
  const orderBySection = new Map<string, number>()

  for (const item of limitedItems) {
    const sectionId = sectionByFormat.get(item.response_format_id)
    if (!sectionId) continue

    const order = orderBySection.get(sectionId) ?? 0
    sectionItems.push({
      section_id: sectionId,
      item_id: item.id,
      display_order: order,
    })
    orderBySection.set(sectionId, order + 1)
  }

  if (sectionItems.length > 0) {
    const { error: itemErr } = await db
      .from('assessment_section_items')
      .insert(sectionItems)
    if (itemErr) return itemErr.message
  }

  return null
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
    .select('id, construct_id, stem, selection_priority, display_order, constructs(name)')
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
 * Apply per-construct item limit: group items by construct_id,
 * sort by selection_priority then display_order, and take the top N.
 * Returns all items if limit is null.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyPerConstructLimit<T extends Record<string, any> & { construct_id: string; selection_priority: number; display_order: number }>(
  items: T[],
  limit: number | null,
): T[] {
  if (limit === null) return items

  // Group by construct
  const byConstruct = new Map<string, T[]>()
  for (const item of items) {
    const group = byConstruct.get(item.construct_id)
    if (group) {
      group.push(item)
    } else {
      byConstruct.set(item.construct_id, [item])
    }
  }

  // Sort each group and take top N
  const result: T[] = []
  for (const [, group] of byConstruct) {
    group.sort((a, b) => {
      if (a.selection_priority !== b.selection_priority) {
        return a.selection_priority - b.selection_priority
      }
      return a.display_order - b.display_order
    })
    result.push(...group.slice(0, limit))
  }

  return result
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
