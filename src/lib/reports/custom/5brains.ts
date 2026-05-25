// =============================================================================
// src/lib/reports/custom/5brains.ts
//
// 5Brains Capability Report — a hand-coded 9-page custom report.
//
// Reads dimensions (brains), constructs (capabilities), and POMP scores from
// ReportContext. Merges with hardcoded BRAIN_PRESENTATION (colours and short
// labels) keyed by dimension slug — the brain colour identity is intrinsic
// to the 5Brains framework, not configurable per client.
// =============================================================================

import { FiveBrainsReport } from '@/components/reports/custom/5brains/report'
import type { CustomReport } from './index'
import type { ReportContext, TaxonomyEntity } from '../report-context'

// ---------------------------------------------------------------------------
// Brain presentation — hardcoded framework identity
// ---------------------------------------------------------------------------

interface BrainPresentation {
  colour: string
  shortLabel: string
}

const BRAIN_PRESENTATION: Record<string, BrainPresentation> = {
  'red-brain': { colour: '#B5453A', shortLabel: 'Self-Mastery' },
  'orange-brain': { colour: '#D08842', shortLabel: 'Interpersonal Effectiveness' },
  'green-brain': { colour: '#4E8867', shortLabel: 'Decisive Reasoning' },
  'blue-brain': { colour: '#3F6BA8', shortLabel: 'Results Delivery' },
  'pink-brain': { colour: '#B86090', shortLabel: 'Vision and Drive' },
}

const BRAIN_ORDER = ['red-brain', 'orange-brain', 'green-brain', 'blue-brain', 'pink-brain']

// ---------------------------------------------------------------------------
// Typed payload
// ---------------------------------------------------------------------------

export interface FiveBrainsCapability {
  id: string
  name: string
  definition: string
  anchorLow: string
  anchorHigh: string
  /** POMP 0–100. */
  score: number
  /** Resolved band label from the active band scheme. */
  bandLabel: string
}

export interface FiveBrainsBrain {
  id: string
  slug: string
  /** e.g. "RedBrain". */
  name: string
  /** Short framework label, e.g. "Self-Mastery". Hardcoded. */
  shortLabel: string
  /** Brain summary copy from dimensions.definition. */
  summary: string
  /** Hex colour, hardcoded per framework. */
  colour: string
  /** POMP 0–100, mean of the 5 capability scores. */
  score: number
  capabilities: FiveBrainsCapability[]
}

export interface FiveBrainsReportData {
  participant: {
    /** Concatenated first + last name. */
    name: string
    firstName: string
    jobTitle?: string
    company?: string
  }
  generatedAt: string
  /** Mean of all 25 construct scores (POMP 0–100). v1 placeholder until platform-level composite scoring lands. */
  compositeScore: number
  brains: FiveBrainsBrain[]
  /** Typical-range band for continuum bars. Platform default. */
  typicalRange: { low: number; high: number }
  /** Logos resolved at build time so the renderer doesn't have to refetch. */
  primaryLogoUrl?: string
  secondaryLogoUrl?: string
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

function getString(entity: TaxonomyEntity, key: string): string {
  const v = entity[key]
  return typeof v === 'string' ? v : ''
}

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

function buildFiveBrainsData(ctx: ReportContext): FiveBrainsReportData {
  // Each "brain" is a dimension; each "capability" is a child factor
  // (post-taxonomy-unification, the 1:1 wrapper factor for what was previously
  // a construct).
  const dimensions: Array<{ id: string; entity: TaxonomyEntity; factorIds: string[] }> = []
  for (const [dimId, factorIds] of ctx.dimensionChildFactors) {
    const entity = ctx.taxonomy.get(dimId)
    if (!entity || entity._taxonomy_level !== 'dimension') continue
    dimensions.push({ id: dimId, entity, factorIds })
  }

  const brains: FiveBrainsBrain[] = dimensions
    .map((dim) => {
      const slug = getString(dim.entity, 'slug')
      const presentation = BRAIN_PRESENTATION[slug]
      if (!presentation) return null

      const capabilities: FiveBrainsCapability[] = dim.factorIds
        .map((fid) => {
          const fEntity = ctx.taxonomy.get(fid)
          if (!fEntity || fEntity._taxonomy_level !== 'factor') return null
          const rawScore = ctx.scores[fid]
          const score = typeof rawScore === 'number' ? Math.round(rawScore) : 0
          return {
            id: fid,
            name: getString(fEntity, 'name'),
            definition: getString(fEntity, 'definition'),
            anchorLow: getString(fEntity, 'anchor_low'),
            anchorHigh: getString(fEntity, 'anchor_high'),
            score,
            bandLabel: ctx.resolveBand(score).bandLabel,
          }
        })
        .filter((c): c is FiveBrainsCapability => c !== null)
        .sort((a, b) => a.name.localeCompare(b.name))

      const dimRawScore = ctx.scores[dim.id]
      const brainScore =
        typeof dimRawScore === 'number'
          ? Math.round(dimRawScore)
          : Math.round(mean(capabilities.map((c) => c.score)))

      return {
        id: dim.id,
        slug,
        name: getString(dim.entity, 'name'),
        shortLabel: presentation.shortLabel,
        summary: getString(dim.entity, 'definition'),
        colour: presentation.colour,
        score: brainScore,
        capabilities,
      } satisfies FiveBrainsBrain
    })
    .filter((b): b is FiveBrainsBrain => b !== null)
    .sort((a, b) => BRAIN_ORDER.indexOf(a.slug) - BRAIN_ORDER.indexOf(b.slug))

  // Composite = mean of all 25 capability scores. v1 placeholder.
  const allCapabilityScores = brains.flatMap((b) => b.capabilities.map((c) => c.score))
  const compositeScore = Math.round(mean(allCapabilityScores))

  const firstName = ctx.session.firstName ?? ''
  const lastName = ctx.session.lastName ?? ''
  const participantName = [firstName, lastName].filter(Boolean).join(' ').trim()

  return {
    participant: {
      name: participantName,
      firstName,
      jobTitle: ctx.session.jobTitle,
      company: ctx.session.company,
    },
    generatedAt: new Date().toISOString(),
    compositeScore,
    brains,
    typicalRange: { low: 30, high: 70 },
    primaryLogoUrl: ctx.brandTheme.primaryLogoUrl,
    secondaryLogoUrl: ctx.brandTheme.secondaryLogoUrl,
  }
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const fiveBrainsReport: CustomReport<FiveBrainsReportData> = {
  slug: '5brains',
  label: '5Brains Capability Report',
  description:
    'Hand-coded 9-page A4 report for the 5Brains Capability Assessment: cover, intro, overview, one page per brain, and closing.',
  buildData: buildFiveBrainsData,
  Component: FiveBrainsReport,
}
