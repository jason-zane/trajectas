'use server'

import OpenAI from 'openai'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminScope } from '@/lib/auth/authorization'
import { logAuditEvent } from '@/lib/auth/support-sessions'
import { getModelForTask } from '@/lib/ai/model-config'
import { getActiveSystemPrompt } from '@/lib/ai/prompt-config'
import {
  getOpenRouterErrorMessage,
  withOpenRouterRetry,
} from '@/lib/ai/providers/openrouter-retry'
import {
  toConstructInsert,
  toDimensionInsert,
  toFactorInsert,
  toItemInsert,
} from '@/lib/supabase/mappers'
import { constructSchema } from '@/lib/validations/constructs'
import { dimensionSchema } from '@/lib/validations/dimensions'
import { factorSchema } from '@/lib/validations/factors'
import { itemSchema } from '@/lib/validations/items'

export type BulkImportEntity = 'dimensions' | 'factors' | 'constructs' | 'items'

type BulkImportRequest = {
  entity: BulkImportEntity
  rawText: string
}

type BulkImportAIRequest = {
  entity: BulkImportEntity
  sourceText: string
}

type BulkImportError = {
  row: number
  message: string
}

type BulkImportSuccess = {
  success: true
  importedCount: number
  entity: BulkImportEntity
}

type BulkImportFailure = {
  success: false
  entity: BulkImportEntity
  errors: BulkImportError[]
}

export type BulkImportResult = BulkImportSuccess | BulkImportFailure

type LibraryBundleSuccess = {
  success: true
  importedCounts: Partial<Record<BulkImportEntity, number>>
  totalImportedCount: number
}

type LibraryBundleFailure = {
  success: false
  errors: BulkImportError[]
}

export type LibraryBundleImportResult = LibraryBundleSuccess | LibraryBundleFailure

type ParsedTable = {
  headers: string[]
  rows: Record<string, string>[]
}

type LookupOption = { id: string; name: string; slug?: string | null }

type BundleEntity = BulkImportEntity

type RefMatch = { source: 'existing' | 'staged'; key: string }

type StagedDimensionRow = {
  rowNumber: number
  name: string
  slug: string
  description?: string
  definition?: string
  displayOrder: number
  isActive: boolean
  indicatorsLow?: string
  indicatorsMid?: string
  indicatorsHigh?: string
}

type StagedFactorRow = {
  rowNumber: number
  name: string
  slug: string
  description?: string
  definition?: string
  isActive: boolean
  isMatchEligible: boolean
  clientId?: string
  dimensionRef?: string
  constructRefs: Array<{ reference: string; weight: number }>
  indicatorsLow?: string
  indicatorsMid?: string
  indicatorsHigh?: string
}

type StagedConstructRow = {
  rowNumber: number
  name: string
  slug: string
  description?: string
  definition?: string
  isActive: boolean
  factorRef?: string
  indicatorsLow?: string
  indicatorsMid?: string
  indicatorsHigh?: string
}

type StagedItemRow = {
  rowNumber: number
  stem: string
  purpose: string
  constructRef?: string
  responseFormatId: string
  reverseScored: boolean
  weight: number
  status: string
  displayOrder: number
  keyedAnswer?: number
}

const BOOLEAN_TRUE = new Set(['true', '1', 'yes', 'y'])
const BOOLEAN_FALSE = new Set(['false', '0', 'no', 'n'])

const HEADER_ALIASES: Record<string, string[]> = {
  name: ['name'],
  slug: ['slug'],
  description: ['description'],
  definition: ['definition'],
  displayOrder: ['displayorder', 'display_order', 'order'],
  isActive: ['isactive', 'is_active', 'active'],
  indicatorsLow: [
    'indicatorslow',
    'indicators_low',
    'lowindicator',
    'lowindicators',
    'lowperformanceindicator',
    'lowperformanceindicators',
  ],
  indicatorsMid: [
    'indicatorsmid',
    'indicators_mid',
    'midindicator',
    'midindicators',
    'midperformanceindicator',
    'midperformanceindicators',
  ],
  indicatorsHigh: [
    'indicatorshigh',
    'indicators_high',
    'highindicator',
    'highindicators',
    'highperformanceindicator',
    'highperformanceindicators',
  ],
  dimension: ['dimension', 'dimensionslug', 'dimensionname', 'dimension_slug', 'dimension_name'],
  client: ['client', 'clientslug', 'clientname', 'organization', 'organizationname', 'organizationslug'],
  isMatchEligible: ['ismatcheligible', 'is_match_eligible', 'matcheligible', 'match_eligible'],
  factor: ['factor', 'factorslug', 'factorname', 'factor_slug', 'factor_name'],
  constructs: ['constructs', 'constructlinks', 'construct_links', 'linkedconstructs'],
  purpose: ['purpose'],
  construct: ['construct', 'constructslug', 'constructname', 'construct_slug', 'construct_name'],
  responseFormat: [
    'responseformat',
    'response_format',
    'responseformatname',
    'responseformatid',
    'response_format_name',
    'response_format_id',
  ],
  stem: ['stem', 'item', 'itemstem', 'question'],
  reverseScored: ['reversescored', 'reverse_scored', 'reverse'],
  weight: ['weight'],
  status: ['status'],
  keyedAnswer: ['keyedanswer', 'keyed_answer', 'correctanswer', 'correct_answer'],
}

const AI_TEMPLATE_HEADERS: Record<BulkImportEntity, string> = {
  dimensions:
    'name,slug,description,definition,display_order,is_active,indicators_low,indicators_mid,indicators_high',
  factors:
    'name,slug,dimension,client,constructs,description,definition,is_active,is_match_eligible,indicators_low,indicators_mid,indicators_high',
  constructs:
    'name,slug,factor,description,definition,is_active,indicators_low,indicators_mid,indicators_high',
  items:
    'stem,purpose,construct,response_format,reverse_scored,weight,status,display_order,keyed_answer',
}

const AI_ENTITY_NOTES: Record<BulkImportEntity, string[]> = {
  dimensions: [
    'Every row is a dimension.',
    'Generate a slug when one is not explicit.',
  ],
  factors: [
    'Every row is a factor.',
    'dimension should reference an existing dimension name or slug when available.',
    'client should be blank unless the source clearly indicates a client-specific factor.',
    'constructs is optional and should use semicolon-separated entries such as stakeholder-framing:1;strategic-signalling:0.8.',
  ],
  constructs: [
    'Every row is a construct.',
    'factor is optional and should reference one parent factor by name or slug when clear.',
  ],
  items: [
    'Every row is an item.',
    'Construct items must use purpose=construct and include a construct reference.',
    'response_format should match an existing response format name if the source makes it obvious.',
    'If unsure about keyed_answer, leave it blank.',
  ],
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/--+/g, '-')
}

function parseBoolean(value: string | undefined, defaultValue: boolean) {
  if (!value?.trim()) {
    return defaultValue
  }

  const normalized = value.trim().toLowerCase()
  if (BOOLEAN_TRUE.has(normalized)) {
    return true
  }
  if (BOOLEAN_FALSE.has(normalized)) {
    return false
  }
  throw new Error(`Expected a boolean value but received "${value}".`)
}

function parseNumber(value: string | undefined, defaultValue: number) {
  if (!value?.trim()) {
    return defaultValue
  }

  const parsed = Number(value)
  if (Number.isNaN(parsed)) {
    throw new Error(`Expected a number value but received "${value}".`)
  }
  return parsed
}

function detectDelimiter(line: string) {
  return line.includes('\t') ? '\t' : ','
}

function normalizeBundleEntity(value: string | undefined): BundleEntity | null {
  const normalized = value?.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  if (normalized === 'dimension' || normalized === 'dimensions') {
    return 'dimensions'
  }
  if (normalized === 'factor' || normalized === 'factors') {
    return 'factors'
  }
  if (normalized === 'construct' || normalized === 'constructs') {
    return 'constructs'
  }
  if (normalized === 'item' || normalized === 'items') {
    return 'items'
  }

  return null
}

function parseDelimitedText(text: string, delimiter: string) {
  const rows: string[][] = []
  let current = ''
  let row: string[] = []
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (!inQuotes && char === delimiter) {
      row.push(current)
      current = ''
      continue
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') {
        index += 1
      }
      row.push(current)
      current = ''
      if (row.some((cell) => cell.trim() !== '')) {
        rows.push(row)
      }
      row = []
      continue
    }

    current += char
  }

  row.push(current)
  if (row.some((cell) => cell.trim() !== '')) {
    rows.push(row)
  }

  return rows
}

function canonicalizeHeaders(headers: string[]) {
  return headers.map((header) => {
    const normalized = normalizeHeader(header)
    const entry = Object.entries(HEADER_ALIASES).find(([, aliases]) =>
      aliases.includes(normalized)
    )
    return entry?.[0] ?? header.trim()
  })
}

function parseTable(rawText: string): ParsedTable {
  const cleanedText = rawText.replace(/^\uFEFF/, '').trim()
  if (!cleanedText) {
    throw new Error('Paste or upload a CSV/TSV file before importing.')
  }

  const firstLine = cleanedText.split(/\r?\n/, 1)[0] ?? ''
  const delimiter = detectDelimiter(firstLine)
  const parsedRows = parseDelimitedText(cleanedText, delimiter)

  if (parsedRows.length < 2) {
    throw new Error('The import file must include a header row and at least one data row.')
  }

  const canonicalHeaders = canonicalizeHeaders(parsedRows[0] ?? [])
  const rows = parsedRows.slice(1).map((cells) => {
    const entry: Record<string, string> = {}
    canonicalHeaders.forEach((header, headerIndex) => {
      entry[header] = cells[headerIndex]?.trim() ?? ''
    })
    return entry
  })

  return { headers: canonicalHeaders, rows }
}

function lookupByNameOrSlug(
  options: LookupOption[],
  rawValue: string | undefined,
  label: string
) {
  const value = rawValue?.trim()
  if (!value) {
    return null
  }

  const normalized = value.toLowerCase()
  const match = options.find((option) => {
    const optionName = option.name.trim().toLowerCase()
    const optionSlug = option.slug?.trim().toLowerCase()
    return option.id === value || optionName === normalized || optionSlug === normalized
  })

  if (!match) {
    throw new Error(`${label} "${value}" could not be found.`)
  }

  return match.id
}

function lookupByNameOrSlugOrNull(
  options: LookupOption[],
  rawValue: string | undefined
) {
  const value = rawValue?.trim()
  if (!value) {
    return null
  }

  const normalized = value.toLowerCase()
  const match = options.find((option) => {
    const optionName = option.name.trim().toLowerCase()
    const optionSlug = option.slug?.trim().toLowerCase()
    return option.id === value || optionName === normalized || optionSlug === normalized
  })

  return match?.id ?? null
}

function getExistingSlugMap(rows: { slug: string }[]) {
  return new Set(rows.map((row) => row.slug))
}

function getDuplicateSlugErrors(rows: Record<string, string>[]) {
  const seen = new Set<string>()
  const errors: BulkImportError[] = []

  rows.forEach((row, rowIndex) => {
    const slug = slugify(row.slug || row.name || '')
    if (!slug) {
      return
    }
    if (seen.has(slug)) {
      errors.push({
        row: rowIndex + 2,
        message: `Slug "${slug}" is duplicated within this import file.`,
      })
      return
    }
    seen.add(slug)
  })

  return errors
}

function getDuplicateStageSlugErrors<T extends { rowNumber: number; slug: string }>(rows: T[]) {
  const seen = new Set<string>()
  const errors: BulkImportError[] = []

  for (const row of rows) {
    if (seen.has(row.slug)) {
      errors.push({
        row: row.rowNumber,
        message: `Slug "${row.slug}" is duplicated within this import file.`,
      })
      continue
    }
    seen.add(row.slug)
  }

  return errors
}

function findStagedRef<T extends { name: string; slug: string }>(
  rows: T[],
  value: string | undefined
): RefMatch | null {
  const raw = value?.trim()
  if (!raw) {
    return null
  }

  const normalized = raw.toLowerCase()
  const match = rows.find((row) => row.slug === normalized || row.name.trim().toLowerCase() === normalized)
  return match ? { source: 'staged', key: match.slug } : null
}

function findReference(
  existingOptions: LookupOption[],
  stagedOptions: Array<{ name: string; slug: string }>,
  rawValue: string | undefined,
  label: string
): RefMatch | null {
  const raw = rawValue?.trim()
  if (!raw) {
    return null
  }

  const existingId = lookupByNameOrSlugOrNull(existingOptions, raw)
  if (existingId) {
    return { source: 'existing', key: existingId }
  }

  const staged = findStagedRef(stagedOptions, raw)
  if (staged) {
    return staged
  }

  throw new Error(`${label} "${raw}" could not be found.`)
}

function parseConstructReferenceList(value: string | undefined) {
  return (value || '')
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [reference, weightValue] = entry.split(':').map((part) => part.trim())
      return {
        reference,
        weight: weightValue ? parseNumber(weightValue, 1) : 1,
      }
    })
}

async function importDimensions(table: ParsedTable) {
  const scope = await requireAdminScope()
  const duplicateErrors = getDuplicateSlugErrors(table.rows)
  if (duplicateErrors.length > 0) {
    return duplicateErrors
  }

  const db = createAdminClient()
  const { data: existingRows, error: existingError } = await db
    .from('dimensions')
    .select('slug')
    .is('deleted_at', null)

  if (existingError) {
    throw new Error(existingError.message)
  }

  const existingSlugs = getExistingSlugMap((existingRows ?? []) as { slug: string }[])
  const inserts = []
  const errors: BulkImportError[] = []

  for (const [index, row] of table.rows.entries()) {
    try {
      const candidate = {
        name: row.name,
        slug: slugify(row.slug || row.name),
        description: row.description || undefined,
        definition: row.definition || undefined,
        displayOrder: parseNumber(row.displayOrder, index),
        isActive: parseBoolean(row.isActive, true),
        indicatorsLow: row.indicatorsLow || undefined,
        indicatorsMid: row.indicatorsMid || undefined,
        indicatorsHigh: row.indicatorsHigh || undefined,
      }

      if (existingSlugs.has(candidate.slug)) {
        throw new Error(`Slug "${candidate.slug}" already exists.`)
      }

      const parsed = dimensionSchema.parse(candidate)
      inserts.push(
        toDimensionInsert({
          ...parsed,
          partnerId: undefined,
          isScored: true,
        })
      )
      existingSlugs.add(parsed.slug)
    } catch (error) {
      errors.push({
        row: index + 2,
        message: error instanceof Error ? error.message : 'Invalid row.',
      })
    }
  }

  if (errors.length > 0) {
    return errors
  }

  const { data: insertedRows, error } = await db
    .from('dimensions')
    .insert(inserts)
    .select('id')

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/dimensions')
  revalidatePath('/')

  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'dimension.bulk_imported',
    targetTable: 'dimensions',
    metadata: {
      importedCount: insertedRows?.length ?? inserts.length,
    },
  })

  return insertedRows?.length ?? inserts.length
}

async function importFactors(table: ParsedTable) {
  const scope = await requireAdminScope()
  const duplicateErrors = getDuplicateSlugErrors(table.rows)
  if (duplicateErrors.length > 0) {
    return duplicateErrors
  }

  const db = createAdminClient()
  const [
    { data: dimensions, error: dimensionsError },
    { data: clients, error: clientsError },
    { data: constructs, error: constructsError },
    { data: existingRows, error: existingError },
  ] =
    await Promise.all([
      db.from('dimensions').select('id, name, slug').is('deleted_at', null),
      db.from('clients').select('id, name, slug').is('deleted_at', null),
      db.from('constructs').select('id, name, slug').is('deleted_at', null),
      db.from('factors').select('slug').is('deleted_at', null),
    ])

  if (dimensionsError || clientsError || constructsError || existingError) {
    throw new Error(
      dimensionsError?.message ||
        clientsError?.message ||
        constructsError?.message ||
        existingError?.message
    )
  }

  const existingSlugs = getExistingSlugMap((existingRows ?? []) as { slug: string }[])
  const errors: BulkImportError[] = []
  const inserts = []
  const constructLinks: Array<{ factorIndex: number; constructId: string; weight: number }> = []

  for (const [index, row] of table.rows.entries()) {
    try {
      const dimensionId = lookupByNameOrSlug(
        (dimensions ?? []) as LookupOption[],
        row.dimension,
        'Dimension'
      )
      const clientId = lookupByNameOrSlug(
        (clients ?? []) as LookupOption[],
        row.client,
        'Client'
      )
      const parsedConstructLinks = (row.constructs || '')
        .split(';')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => {
          const [reference, weightValue] = entry.split(':').map((value) => value.trim())
          const constructId = lookupByNameOrSlug(
            (constructs ?? []) as LookupOption[],
            reference,
            'Construct'
          )

          if (!constructId) {
            throw new Error(`Construct "${reference}" could not be found.`)
          }

          return {
            constructId,
            weight: weightValue ? parseNumber(weightValue, 1) : 1,
          }
        })
      const candidate = {
        name: row.name,
        slug: slugify(row.slug || row.name),
        description: row.description || undefined,
        definition: row.definition || undefined,
        dimensionId: dimensionId ?? undefined,
        isActive: parseBoolean(row.isActive, true),
        isMatchEligible: parseBoolean(row.isMatchEligible, true),
        clientId: clientId ?? undefined,
        constructs: parsedConstructLinks,
        indicatorsLow: row.indicatorsLow || undefined,
        indicatorsMid: row.indicatorsMid || undefined,
        indicatorsHigh: row.indicatorsHigh || undefined,
      }

      if (existingSlugs.has(candidate.slug)) {
        throw new Error(`Slug "${candidate.slug}" already exists.`)
      }

      const parsed = factorSchema.parse(candidate)
      inserts.push(
        toFactorInsert({
          ...parsed,
          partnerId: undefined,
        })
      )
      parsed.constructs.forEach((constructLink) => {
        constructLinks.push({
          factorIndex: inserts.length - 1,
          constructId: constructLink.constructId,
          weight: constructLink.weight,
        })
      })
      existingSlugs.add(parsed.slug)
    } catch (error) {
      errors.push({
        row: index + 2,
        message: error instanceof Error ? error.message : 'Invalid row.',
      })
    }
  }

  if (errors.length > 0) {
    return errors
  }

  const { data: insertedRows, error } = await db
    .from('factors')
    .insert(inserts)
    .select('id')

  if (error) {
    throw new Error(error.message)
  }

  if (constructLinks.length > 0 && insertedRows) {
    const factorIds = insertedRows.map((row) => String(row.id))
    const { data: existingLinks, error: linksError } = await db
      .from('factor_constructs')
      .select('factor_id, display_order')
      .in('factor_id', factorIds)
      .order('display_order', { ascending: true })

    if (linksError) {
      throw new Error(linksError.message)
    }

    const displayOrderMap = new Map<string, number>()
    for (const factorId of factorIds) {
      const maxOrder = (existingLinks ?? [])
        .filter((row) => String(row.factor_id) === factorId)
        .reduce((currentMax, row) => Math.max(currentMax, Number(row.display_order ?? 0)), 0)
      displayOrderMap.set(factorId, maxOrder)
    }

    const linkRows = constructLinks.map((link) => {
      const factorId = String(insertedRows[link.factorIndex]?.id)
      const nextOrder = (displayOrderMap.get(factorId) ?? 0) + 1
      displayOrderMap.set(factorId, nextOrder)

      return {
        factor_id: factorId,
        construct_id: link.constructId,
        weight: link.weight,
        display_order: nextOrder,
      }
    })

    const { error: insertLinksError } = await db.from('factor_constructs').insert(linkRows)
    if (insertLinksError) {
      throw new Error(insertLinksError.message)
    }
  }

  revalidatePath('/factors')
  revalidatePath('/')

  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'factor.bulk_imported',
    targetTable: 'factors',
    metadata: {
      importedCount: insertedRows?.length ?? inserts.length,
      linkedConstructCount: constructLinks.length,
    },
  })

  return insertedRows?.length ?? inserts.length
}

async function importConstructs(table: ParsedTable) {
  const scope = await requireAdminScope()
  const duplicateErrors = getDuplicateSlugErrors(table.rows)
  if (duplicateErrors.length > 0) {
    return duplicateErrors
  }

  const db = createAdminClient()
  const [{ data: factors, error: factorsError }, { data: existingRows, error: existingError }] = await Promise.all([
    db.from('factors').select('id, name, slug').is('deleted_at', null),
    db.from('constructs').select('slug').is('deleted_at', null),
  ])

  if (factorsError || existingError) {
    throw new Error(factorsError?.message || existingError?.message)
  }

  const existingSlugs = getExistingSlugMap((existingRows ?? []) as { slug: string }[])
  const errors: BulkImportError[] = []
  const constructInserts = []
  const factorLinks: { factorId: string; constructIndex: number }[] = []

  for (const [index, row] of table.rows.entries()) {
    try {
      const parentFactorId = lookupByNameOrSlug(
        (factors ?? []) as LookupOption[],
        row.factor,
        'Factor'
      )
      const candidate = {
        name: row.name,
        slug: slugify(row.slug || row.name),
        description: row.description || undefined,
        definition: row.definition || undefined,
        isActive: parseBoolean(row.isActive, true),
        indicatorsLow: row.indicatorsLow || undefined,
        indicatorsMid: row.indicatorsMid || undefined,
        indicatorsHigh: row.indicatorsHigh || undefined,
      }

      if (existingSlugs.has(candidate.slug)) {
        throw new Error(`Slug "${candidate.slug}" already exists.`)
      }

      const parsed = constructSchema.parse(candidate)
      constructInserts.push(
        toConstructInsert({
          ...parsed,
          partnerId: undefined,
        })
      )
      if (parentFactorId) {
        factorLinks.push({ factorId: parentFactorId, constructIndex: constructInserts.length - 1 })
      }
      existingSlugs.add(parsed.slug)
    } catch (error) {
      errors.push({
        row: index + 2,
        message: error instanceof Error ? error.message : 'Invalid row.',
      })
    }
  }

  if (errors.length > 0) {
    return errors
  }

  const { data: insertedRows, error } = await db
    .from('constructs')
    .insert(constructInserts)
    .select('id')

  if (error || !insertedRows) {
    throw new Error(error?.message ?? 'Failed to insert constructs.')
  }

  if (factorLinks.length > 0) {
    const factorIds = Array.from(new Set(factorLinks.map((link) => link.factorId)))
    const { data: existingLinks, error: linkError } = await db
      .from('factor_constructs')
      .select('factor_id, display_order')
      .in('factor_id', factorIds)
      .order('display_order', { ascending: true })

    if (linkError) {
      throw new Error(linkError.message)
    }

    const displayOrderMap = new Map<string, number>()
    for (const factorId of factorIds) {
      const maxOrder = (existingLinks ?? [])
        .filter((row) => String(row.factor_id) === factorId)
        .reduce((currentMax, row) => Math.max(currentMax, Number(row.display_order ?? 0)), 0)
      displayOrderMap.set(factorId, maxOrder)
    }

    const linkRows = factorLinks.map((link) => {
      const nextOrder = (displayOrderMap.get(link.factorId) ?? 0) + 1
      displayOrderMap.set(link.factorId, nextOrder)
      return {
        factor_id: link.factorId,
        construct_id: insertedRows[link.constructIndex]?.id,
        weight: 1,
        display_order: nextOrder,
      }
    })

    const { error: insertLinkError } = await db.from('factor_constructs').insert(linkRows)
    if (insertLinkError) {
      throw new Error(insertLinkError.message)
    }
  }

  revalidatePath('/constructs')
  revalidatePath('/factors')
  revalidatePath('/')

  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'construct.bulk_imported',
    targetTable: 'constructs',
    metadata: {
      importedCount: insertedRows.length,
      linkedFactorCount: factorLinks.length,
    },
  })

  return insertedRows.length
}

async function importItems(table: ParsedTable) {
  const scope = await requireAdminScope()
  const db = createAdminClient()
  const [{ data: constructs, error: constructsError }, { data: responseFormats, error: responseFormatsError }] =
    await Promise.all([
      db.from('constructs').select('id, name, slug').is('deleted_at', null),
      db.from('response_formats').select('id, name').eq('is_active', true),
    ])

  if (constructsError || responseFormatsError) {
    throw new Error(constructsError?.message || responseFormatsError?.message)
  }

  const errors: BulkImportError[] = []
  const inserts = []

  for (const [index, row] of table.rows.entries()) {
    try {
      const purpose = row.purpose?.trim() || 'construct'
      const constructId =
        purpose === 'construct'
          ? lookupByNameOrSlug(
              (constructs ?? []) as LookupOption[],
              row.construct,
              'Construct'
            ) ?? undefined
          : undefined
      const responseFormatId = lookupByNameOrSlug(
        (responseFormats ?? []) as LookupOption[],
        row.responseFormat,
        'Response format'
      )

      if (!responseFormatId) {
        throw new Error('Response format is required.')
      }

      const candidate = {
        purpose,
        constructId,
        responseFormatId,
        stem: row.stem,
        reverseScored: parseBoolean(row.reverseScored, false),
        weight: parseNumber(row.weight, 1),
        status: row.status?.trim() || 'draft',
        displayOrder: parseNumber(row.displayOrder, index),
        keyedAnswer: row.keyedAnswer?.trim() ? parseNumber(row.keyedAnswer, 0) : undefined,
      }

      const parsed = itemSchema.parse(candidate)
      inserts.push(toItemInsert(parsed))
    } catch (error) {
      errors.push({
        row: index + 2,
        message: error instanceof Error ? error.message : 'Invalid row.',
      })
    }
  }

  if (errors.length > 0) {
    return errors
  }

  const { data: insertedRows, error } = await db
    .from('items')
    .insert(inserts)
    .select('id')

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/items')
  revalidatePath('/constructs')
  revalidatePath('/')

  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'item.bulk_imported',
    targetTable: 'items',
    metadata: {
      importedCount: insertedRows?.length ?? inserts.length,
    },
  })

  return insertedRows?.length ?? inserts.length
}

export async function importLibraryRows(
  input: BulkImportRequest
): Promise<BulkImportResult> {
  try {
    const table = parseTable(input.rawText)

    const result =
      input.entity === 'dimensions'
        ? await importDimensions(table)
        : input.entity === 'factors'
          ? await importFactors(table)
          : input.entity === 'constructs'
            ? await importConstructs(table)
            : await importItems(table)

    if (Array.isArray(result)) {
      return {
        success: false,
        entity: input.entity,
        errors: result,
      }
    }

    return {
      success: true,
      entity: input.entity,
      importedCount: result,
    }
  } catch (error) {
    return {
      success: false,
      entity: input.entity,
      errors: [
        {
          row: 0,
          message: error instanceof Error ? error.message : 'Import failed.',
        },
      ],
    }
  }
}

export async function importLibraryBundleRows(rawText: string): Promise<LibraryBundleImportResult> {
  const scope = await requireAdminScope()
  const db = createAdminClient()

  const rollback = async (state: {
    factorLinkFactorIds: string[]
    insertedItemIds: string[]
    insertedConstructIds: string[]
    insertedFactorIds: string[]
    insertedDimensionIds: string[]
  }) => {
    if (state.factorLinkFactorIds.length > 0) {
      await db.from('factor_constructs').delete().in('factor_id', state.factorLinkFactorIds)
    }
    if (state.insertedItemIds.length > 0) {
      await db.from('items').delete().in('id', state.insertedItemIds)
    }
    if (state.insertedConstructIds.length > 0) {
      await db.from('constructs').delete().in('id', state.insertedConstructIds)
    }
    if (state.insertedFactorIds.length > 0) {
      await db.from('factors').delete().in('id', state.insertedFactorIds)
    }
    if (state.insertedDimensionIds.length > 0) {
      await db.from('dimensions').delete().in('id', state.insertedDimensionIds)
    }
  }

  try {
    const table = parseTable(rawText)
    if (!table.headers.includes('entity')) {
      return {
        success: false,
        errors: [{ row: 1, message: 'Full library import requires an "entity" column.' }],
      }
    }

    const groupedRows: Record<BundleEntity, Record<string, string>[]> = {
      dimensions: [],
      factors: [],
      constructs: [],
      items: [],
    }
    const errors: BulkImportError[] = []

    table.rows.forEach((row, index) => {
      const entity = normalizeBundleEntity(row.entity)
      if (!entity) {
        errors.push({
          row: index + 2,
          message: `Entity "${row.entity}" is not supported. Use dimension, factor, construct, or item.`,
        })
        return
      }
      groupedRows[entity].push(row)
    })

    if (errors.length > 0) {
      return { success: false, errors }
    }

    const [
      { data: existingDimensions, error: existingDimensionsError },
      { data: existingFactors, error: existingFactorsError },
      { data: existingConstructs, error: existingConstructsError },
      { data: existingClients, error: existingClientsError },
      { data: responseFormats, error: responseFormatsError },
    ] = await Promise.all([
      db.from('dimensions').select('id, name, slug').is('deleted_at', null),
      db.from('factors').select('id, name, slug').is('deleted_at', null),
      db.from('constructs').select('id, name, slug').is('deleted_at', null),
      db.from('clients').select('id, name, slug').is('deleted_at', null),
      db.from('response_formats').select('id, name').eq('is_active', true),
    ])

    if (
      existingDimensionsError ||
      existingFactorsError ||
      existingConstructsError ||
      existingClientsError ||
      responseFormatsError
    ) {
      throw new Error(
        existingDimensionsError?.message ||
          existingFactorsError?.message ||
          existingConstructsError?.message ||
          existingClientsError?.message ||
          responseFormatsError?.message
      )
    }

    const [
      { data: existingDimensionSlugs, error: existingDimensionSlugError },
      { data: existingFactorSlugs, error: existingFactorSlugError },
      { data: existingConstructSlugs, error: existingConstructSlugError },
    ] = await Promise.all([
      db.from('dimensions').select('slug').is('deleted_at', null),
      db.from('factors').select('slug').is('deleted_at', null),
      db.from('constructs').select('slug').is('deleted_at', null),
    ])

    if (existingDimensionSlugError || existingFactorSlugError || existingConstructSlugError) {
      throw new Error(
        existingDimensionSlugError?.message ||
          existingFactorSlugError?.message ||
          existingConstructSlugError?.message
      )
    }

    const dimensionSlugSet = getExistingSlugMap((existingDimensionSlugs ?? []) as { slug: string }[])
    const factorSlugSet = getExistingSlugMap((existingFactorSlugs ?? []) as { slug: string }[])
    const constructSlugSet = getExistingSlugMap((existingConstructSlugs ?? []) as { slug: string }[])

    const stagedDimensions: StagedDimensionRow[] = []
    const stagedFactors: StagedFactorRow[] = []
    const stagedConstructs: StagedConstructRow[] = []
    const stagedItems: StagedItemRow[] = []

    for (const [index, row] of groupedRows.dimensions.entries()) {
      const rowNumber = table.rows.indexOf(row) + 2
      try {
        const candidate = {
          name: row.name,
          slug: slugify(row.slug || row.name),
          description: row.description || undefined,
          definition: row.definition || undefined,
          displayOrder: parseNumber(row.displayOrder, index),
          isActive: parseBoolean(row.isActive, true),
          indicatorsLow: row.indicatorsLow || undefined,
          indicatorsMid: row.indicatorsMid || undefined,
          indicatorsHigh: row.indicatorsHigh || undefined,
        }

        if (dimensionSlugSet.has(candidate.slug)) {
          throw new Error(`Slug "${candidate.slug}" already exists.`)
        }

        const parsed = dimensionSchema.parse(candidate)
        stagedDimensions.push({
          rowNumber,
          ...parsed,
        })
        dimensionSlugSet.add(parsed.slug)
      } catch (error) {
        errors.push({
          row: rowNumber,
          message: error instanceof Error ? error.message : 'Invalid dimension row.',
        })
      }
    }

    for (const row of groupedRows.factors) {
      const rowNumber = table.rows.indexOf(row) + 2
      try {
        const clientId = lookupByNameOrSlug(
          (existingClients ?? []) as LookupOption[],
          row.client,
          'Client'
        )
        const candidate = {
          name: row.name,
          slug: slugify(row.slug || row.name),
          description: row.description || undefined,
          definition: row.definition || undefined,
          isActive: parseBoolean(row.isActive, true),
          isMatchEligible: parseBoolean(row.isMatchEligible, true),
          indicatorsLow: row.indicatorsLow || undefined,
          indicatorsMid: row.indicatorsMid || undefined,
          indicatorsHigh: row.indicatorsHigh || undefined,
        }

        if (factorSlugSet.has(candidate.slug)) {
          throw new Error(`Slug "${candidate.slug}" already exists.`)
        }

        factorSchema.parse({
          ...candidate,
          dimensionId: '',
          clientId: clientId ?? '',
          constructs: [],
        })

        stagedFactors.push({
          rowNumber,
          ...candidate,
          clientId: clientId ?? undefined,
          dimensionRef: row.dimension?.trim() || undefined,
          constructRefs: parseConstructReferenceList(row.constructs),
        })
        factorSlugSet.add(candidate.slug)
      } catch (error) {
        errors.push({
          row: rowNumber,
          message: error instanceof Error ? error.message : 'Invalid factor row.',
        })
      }
    }

    for (const row of groupedRows.constructs) {
      const rowNumber = table.rows.indexOf(row) + 2
      try {
        const candidate = {
          name: row.name,
          slug: slugify(row.slug || row.name),
          description: row.description || undefined,
          definition: row.definition || undefined,
          isActive: parseBoolean(row.isActive, true),
          indicatorsLow: row.indicatorsLow || undefined,
          indicatorsMid: row.indicatorsMid || undefined,
          indicatorsHigh: row.indicatorsHigh || undefined,
        }

        if (constructSlugSet.has(candidate.slug)) {
          throw new Error(`Slug "${candidate.slug}" already exists.`)
        }

        const parsed = constructSchema.parse(candidate)
        stagedConstructs.push({
          rowNumber,
          ...parsed,
          factorRef: row.factor?.trim() || undefined,
        })
        constructSlugSet.add(parsed.slug)
      } catch (error) {
        errors.push({
          row: rowNumber,
          message: error instanceof Error ? error.message : 'Invalid construct row.',
        })
      }
    }

    for (const [index, row] of groupedRows.items.entries()) {
      const rowNumber = table.rows.indexOf(row) + 2
      try {
        const responseFormatId = lookupByNameOrSlug(
          (responseFormats ?? []) as LookupOption[],
          row.responseFormat,
          'Response format'
        )

        if (!responseFormatId) {
          throw new Error('Response format is required.')
        }

        const candidate = {
          stem: row.stem,
          purpose: row.purpose?.trim() || 'construct',
          responseFormatId,
          reverseScored: parseBoolean(row.reverseScored, false),
          weight: parseNumber(row.weight, 1),
          status: row.status?.trim() || 'draft',
          displayOrder: parseNumber(row.displayOrder, index),
          keyedAnswer: row.keyedAnswer?.trim() ? parseNumber(row.keyedAnswer, 0) : undefined,
        }

        itemSchema.parse({
          ...candidate,
          constructId: candidate.purpose === 'construct' ? '00000000-0000-0000-0000-000000000000' : undefined,
        })

        stagedItems.push({
          rowNumber,
          ...candidate,
          constructRef: row.construct?.trim() || undefined,
        })
      } catch (error) {
        errors.push({
          row: rowNumber,
          message: error instanceof Error ? error.message : 'Invalid item row.',
        })
      }
    }

    errors.push(...getDuplicateStageSlugErrors(stagedDimensions))
    errors.push(...getDuplicateStageSlugErrors(stagedFactors))
    errors.push(...getDuplicateStageSlugErrors(stagedConstructs))

    const stagedDimensionRefs = stagedDimensions.map(({ name, slug }) => ({ name, slug }))
    const stagedFactorRefs = stagedFactors.map(({ name, slug }) => ({ name, slug }))
    const stagedConstructRefs = stagedConstructs.map(({ name, slug }) => ({ name, slug }))

    const resolvedFactorDimensionRefs = new Map<string, RefMatch | null>()
    const resolvedConstructFactorRefs = new Map<string, RefMatch | null>()
    const resolvedFactorConstructRefs = new Map<string, Array<{ match: RefMatch; weight: number }>>()
    const resolvedItemConstructRefs = new Map<string, RefMatch | null>()

    for (const factor of stagedFactors) {
      try {
        const match = findReference(
          (existingDimensions ?? []) as LookupOption[],
          stagedDimensionRefs,
          factor.dimensionRef,
          'Dimension'
        )
        resolvedFactorDimensionRefs.set(factor.slug, match)
      } catch (error) {
        errors.push({
          row: factor.rowNumber,
          message: error instanceof Error ? error.message : 'Invalid factor dimension reference.',
        })
      }

      try {
        const matches = factor.constructRefs.map((constructRef) => ({
          match: findReference(
            (existingConstructs ?? []) as LookupOption[],
            stagedConstructRefs,
            constructRef.reference,
            'Construct'
          ),
          weight: constructRef.weight,
        }))

        if (matches.some((entry) => !entry.match)) {
          throw new Error('Construct links must reference an existing or staged construct.')
        }

        resolvedFactorConstructRefs.set(
          factor.slug,
          matches.filter((entry): entry is { match: RefMatch; weight: number } => Boolean(entry.match))
        )
      } catch (error) {
        errors.push({
          row: factor.rowNumber,
          message: error instanceof Error ? error.message : 'Invalid factor construct reference.',
        })
      }
    }

    for (const construct of stagedConstructs) {
      try {
        const match = findReference(
          (existingFactors ?? []) as LookupOption[],
          stagedFactorRefs,
          construct.factorRef,
          'Factor'
        )
        resolvedConstructFactorRefs.set(construct.slug, match)
      } catch (error) {
        errors.push({
          row: construct.rowNumber,
          message: error instanceof Error ? error.message : 'Invalid construct factor reference.',
        })
      }
    }

    for (const item of stagedItems) {
      try {
        const match =
          item.purpose === 'construct'
            ? findReference(
                (existingConstructs ?? []) as LookupOption[],
                stagedConstructRefs,
                item.constructRef,
                'Construct'
              )
            : null

        if (item.purpose === 'construct' && !match) {
          throw new Error('Construct is required for construct items.')
        }

        resolvedItemConstructRefs.set(`${item.rowNumber}:${item.stem}`, match)
      } catch (error) {
        errors.push({
          row: item.rowNumber,
          message: error instanceof Error ? error.message : 'Invalid item construct reference.',
        })
      }
    }

    if (errors.length > 0) {
      return { success: false, errors }
    }

    const rollbackState = {
      factorLinkFactorIds: [] as string[],
      insertedItemIds: [] as string[],
      insertedConstructIds: [] as string[],
      insertedFactorIds: [] as string[],
      insertedDimensionIds: [] as string[],
    }

    try {
      const stagedDimensionIdBySlug = new Map<string, string>()
      const stagedFactorIdBySlug = new Map<string, string>()
      const stagedConstructIdBySlug = new Map<string, string>()

      if (stagedDimensions.length > 0) {
        const { data, error } = await db
          .from('dimensions')
          .insert(
            stagedDimensions.map((dimension) =>
              toDimensionInsert({
                ...dimension,
                partnerId: undefined,
                isScored: true,
              })
            )
          )
          .select('id, slug')

        if (error || !data) {
          throw new Error(error?.message ?? 'Failed to insert dimensions.')
        }

        data.forEach((row) => {
          stagedDimensionIdBySlug.set(String(row.slug), String(row.id))
          rollbackState.insertedDimensionIds.push(String(row.id))
        })
      }

      if (stagedFactors.length > 0) {
        const factorInserts = stagedFactors.map((factor) =>
          toFactorInsert({
            name: factor.name,
            slug: factor.slug,
            description: factor.description,
            definition: factor.definition,
            dimensionId: (() => {
              const match = resolvedFactorDimensionRefs.get(factor.slug)
              if (!match) return undefined
              return match.source === 'existing' ? match.key : stagedDimensionIdBySlug.get(match.key)
            })(),
            isActive: factor.isActive,
            isMatchEligible: factor.isMatchEligible,
            clientId: factor.clientId,
            indicatorsLow: factor.indicatorsLow,
            indicatorsMid: factor.indicatorsMid,
            indicatorsHigh: factor.indicatorsHigh,
            partnerId: undefined,
          })
        )

        const { data, error } = await db.from('factors').insert(factorInserts).select('id, slug')
        if (error || !data) {
          throw new Error(error?.message ?? 'Failed to insert factors.')
        }

        data.forEach((row) => {
          stagedFactorIdBySlug.set(String(row.slug), String(row.id))
          rollbackState.insertedFactorIds.push(String(row.id))
        })
      }

      if (stagedConstructs.length > 0) {
        const constructInserts = stagedConstructs.map((construct) =>
          toConstructInsert({
            ...construct,
            partnerId: undefined,
          })
        )

        const { data, error } = await db
          .from('constructs')
          .insert(constructInserts)
          .select('id, slug')

        if (error || !data) {
          throw new Error(error?.message ?? 'Failed to insert constructs.')
        }

        data.forEach((row) => {
          stagedConstructIdBySlug.set(String(row.slug), String(row.id))
          rollbackState.insertedConstructIds.push(String(row.id))
        })
      }

      const factorConstructLinks = new Map<string, { factorId: string; constructId: string; weight: number }>()

      for (const factor of stagedFactors) {
        const factorId = stagedFactorIdBySlug.get(factor.slug)
        if (!factorId) continue

        for (const linkedConstruct of resolvedFactorConstructRefs.get(factor.slug) ?? []) {
          const constructId =
            linkedConstruct.match.source === 'existing'
              ? linkedConstruct.match.key
              : stagedConstructIdBySlug.get(linkedConstruct.match.key)

          if (!constructId) {
            throw new Error(`Construct link for factor "${factor.name}" could not be resolved.`)
          }

          factorConstructLinks.set(`${factorId}:${constructId}`, {
            factorId,
            constructId,
            weight: linkedConstruct.weight,
          })
        }
      }

      for (const construct of stagedConstructs) {
        const constructId = stagedConstructIdBySlug.get(construct.slug)
        const factorMatch = resolvedConstructFactorRefs.get(construct.slug)
        if (!constructId || !factorMatch) continue

        const factorId =
          factorMatch.source === 'existing'
            ? factorMatch.key
            : stagedFactorIdBySlug.get(factorMatch.key)

        if (!factorId) {
          throw new Error(`Factor link for construct "${construct.name}" could not be resolved.`)
        }

        const dedupeKey = `${factorId}:${constructId}`
        if (!factorConstructLinks.has(dedupeKey)) {
          factorConstructLinks.set(dedupeKey, {
            factorId,
            constructId,
            weight: 1,
          })
        }
      }

      if (factorConstructLinks.size > 0) {
        const affectedFactorIds = Array.from(
          new Set(Array.from(factorConstructLinks.values()).map((link) => link.factorId))
        )
        const { data: existingLinks, error: existingLinksError } = await db
          .from('factor_constructs')
          .select('factor_id, display_order')
          .in('factor_id', affectedFactorIds)
          .order('display_order', { ascending: true })

        if (existingLinksError) {
          throw new Error(existingLinksError.message)
        }

        const displayOrderMap = new Map<string, number>()
        for (const factorId of affectedFactorIds) {
          const maxOrder = (existingLinks ?? [])
            .filter((row) => String(row.factor_id) === factorId)
            .reduce((currentMax, row) => Math.max(currentMax, Number(row.display_order ?? 0)), 0)
          displayOrderMap.set(factorId, maxOrder)
        }

        const linkRows = Array.from(factorConstructLinks.values()).map((link) => {
          const nextOrder = (displayOrderMap.get(link.factorId) ?? 0) + 1
          displayOrderMap.set(link.factorId, nextOrder)
          return {
            factor_id: link.factorId,
            construct_id: link.constructId,
            weight: link.weight,
            display_order: nextOrder,
          }
        })

        const { error } = await db.from('factor_constructs').insert(linkRows)
        if (error) {
          throw new Error(error.message)
        }

        rollbackState.factorLinkFactorIds = affectedFactorIds
      }

      if (stagedItems.length > 0) {
        const itemInserts = stagedItems.map((item) =>
          toItemInsert({
            purpose: item.purpose as 'construct' | 'impression_management' | 'infrequency' | 'attention_check',
            constructId: (() => {
              const match = resolvedItemConstructRefs.get(`${item.rowNumber}:${item.stem}`)
              if (!match) return undefined
              return match.source === 'existing' ? match.key : stagedConstructIdBySlug.get(match.key)
            })(),
            responseFormatId: item.responseFormatId,
            stem: item.stem,
            reverseScored: item.reverseScored,
            weight: item.weight,
            status: item.status as 'draft' | 'active' | 'archived',
            displayOrder: item.displayOrder,
            selectionPriority: 0,
            keyedAnswer: item.keyedAnswer,
          })
        )

        const { data, error } = await db.from('items').insert(itemInserts).select('id')
        if (error || !data) {
          throw new Error(error?.message ?? 'Failed to insert items.')
        }

        rollbackState.insertedItemIds = data.map((row) => String(row.id))
      }

      revalidatePath('/dimensions')
      revalidatePath('/factors')
      revalidatePath('/constructs')
      revalidatePath('/items')
      revalidatePath('/')

      const importedCounts: Partial<Record<BulkImportEntity, number>> = {
        dimensions: rollbackState.insertedDimensionIds.length,
        factors: rollbackState.insertedFactorIds.length,
        constructs: rollbackState.insertedConstructIds.length,
        items: rollbackState.insertedItemIds.length,
      }

      await logAuditEvent({
        actorProfileId: scope.actor?.id ?? null,
        eventType: 'library.bundle_imported',
        metadata: {
          importedCounts,
          totalImportedCount: Object.values(importedCounts).reduce((sum, value) => sum + (value ?? 0), 0),
        },
      })

      return {
        success: true,
        importedCounts,
        totalImportedCount: Object.values(importedCounts).reduce((sum, value) => sum + (value ?? 0), 0),
      }
    } catch (error) {
      await rollback(rollbackState)
      throw error
    }
  } catch (error) {
    return {
      success: false,
      errors: [
        {
          row: 0,
          message: error instanceof Error ? error.message : 'Full library import failed.',
        },
      ],
    }
  }
}

export async function structureLibraryImportWithAI(input: BulkImportAIRequest) {
  const scope = await requireAdminScope()
  const sourceText = input.sourceText.trim()

  if (!sourceText) {
    return { success: false as const, error: 'Paste source text before using AI structuring.' }
  }

  const apiKey = process.env.OpenRouter_API_KEY
  if (!apiKey) {
    return { success: false as const, error: 'OpenRouter API key is not configured.' }
  }

  try {
    const taskConfig = await getModelForTask('library_import_structuring')
    const systemPrompt = await getActiveSystemPrompt('library_import_structuring')
    const modelId = taskConfig.modelId
    const client = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://talent-fit.app',
        'X-Title': 'Talent Fit',
      },
    })

    const completion = await withOpenRouterRetry(() =>
      client.chat.completions.create({
        model: modelId,
        messages: [
          {
            role: 'system',
            content: [
              systemPrompt.content.trim(),
              '',
              'Implementation contract for this task:',
              'Return only CSV text.',
              `The CSV header must be exactly: ${AI_TEMPLATE_HEADERS[input.entity]}`,
              'Do not wrap the CSV in code fences.',
              'Leave cells blank when the source does not support a confident value.',
              ...AI_ENTITY_NOTES[input.entity],
            ].join('\n'),
          },
          {
            role: 'user',
            content: sourceText,
          },
        ],
        max_tokens: taskConfig.config.max_tokens ?? 3000,
        temperature: 0.2,
      })
    )

    const content = completion.choices[0]?.message?.content?.trim()
    if (!content) {
      return { success: false as const, error: 'AI did not return any structured output.' }
    }

    const cleaned = content.replace(/^```(?:csv)?\n?/i, '').replace(/\n?```$/, '').trim()

    await logAuditEvent({
      actorProfileId: scope.actor?.id ?? null,
      eventType: 'library_import.ai_structured',
        metadata: {
        purpose: 'library_import_structuring',
        entity: input.entity,
        modelId,
        promptId: systemPrompt.id,
        promptVersion: systemPrompt.version,
        sourceLength: sourceText.length,
        outputLength: cleaned.length,
      },
    })

    return {
      success: true as const,
      csv: cleaned,
      modelId,
    }
  } catch (error) {
    return {
      success: false as const,
      error: getOpenRouterErrorMessage(error),
    }
  }
}
