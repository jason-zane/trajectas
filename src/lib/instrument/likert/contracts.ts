import type { FormPairCheck } from './form-review'
import { normalizeLikertAnchors } from '@/lib/assess/likert-anchors'
import { z } from 'zod'
import type { BlueprintCell } from '../types'

export const LIKERT_VERSION = 'likert-v1'
export const LIKERT_STAGE = 'autonomous_likert'
export const LIKERT_STEP = 'autonomous_likert_step'
export const MAX_ROUNDS = 6
export const MAX_FORM_REPAIRS = 3
export const MAX_CALLS = 600
export const BATCH_SIZE = 5
export const STEP_DEADLINE_MS = 105_000
export const LEASE_MS = 180_000

export const likertOptionsSchema = z.object({
  itemsPerConstruct: z.number().int().min(4).max(30).default(10),
  targetAlpha: z.number().min(0.6).max(0.95).default(0.8),
  readingLevel: z.enum(['entry', 'mid', 'senior', 'executive', 'mixed']).default('mixed'),
  responseFormatId: z.guid().optional(),
  timeframe: z.string().trim().min(3).max(160).default('Over the past three months'),
  reverseProportion: z.number().min(0).max(0.5).default(0.25),
})
export type LikertOptions = z.infer<typeof likertOptionsSchema>

/** Budget preflight includes the quadratic final pair review, before any model usage. */
export function assertLikertScopeBudget(constructCount: number, itemsPerConstruct: number): void {
  const facets = Math.min(4, Math.floor(itemsPerConstruct / 2))
  const cells = Math.min(itemsPerConstruct, facets * 3)
  const initialDrafts = itemsPerConstruct + cells
  const minimumCalls = constructCount * (2 + cells * Math.ceil((Math.ceil(itemsPerConstruct / cells) + 1) / BATCH_SIZE)
    + 3 * Math.ceil(initialDrafts / BATCH_SIZE) + 2 + 2 * Math.ceil(itemsPerConstruct * (itemsPerConstruct - 1) / 2 / 8))
  if (minimumCalls > MAX_CALLS * 0.8) throw new Error('This form is too large for the automatic review budget, including every final item pair and repair headroom. Use fewer constructs or items per construct, or split the model into separate builds.')
}

export interface LikertFormat {
  id: string
  name: string
  points: number
  anchors: Record<string, string>
  anchorType: 'agreement' | 'frequency'
}
export interface LikertConstruct {
  id: string
  name: string
  definition: string
  exclusions: string[]
  cells: BlueprintCell[]
}
export interface LikertSpec {
  version: typeof LIKERT_VERSION
  measureType: string
  brief: string
  audience: Record<string, unknown>
  useContext: string
  timeframe: string
  readingCeiling: number
  itemsPerConstruct: number
  reverseProportion: number
  scoreDirection: string
  format: LikertFormat
  constructs: LikertConstruct[]
}

/** A format must be usable by the participant renderer, with every category labelled. */
export function parseLikertFormat(row: { id: string; name: string; type: string; config: Record<string, unknown>; is_active: boolean }): LikertFormat {
  if (row.type !== 'likert' || !row.is_active) throw new Error('Select an active Likert response format.')
  const { points, anchors, anchorType } = normalizeLikertAnchors(row.config)
  if ((row.config.minValue !== undefined && row.config.minValue !== 1) || (row.config.maxValue !== undefined && row.config.maxValue !== points)) throw new Error('Likert scoring bounds must match categories 1 through points.')
  if (typeof points !== 'number' || !Number.isInteger(points) || points < 4 || points > 7) throw new Error('Likert formats need 4–7 numbered response categories.')
  if (!anchors || typeof anchors !== 'object' || Array.isArray(anchors)) throw new Error('Every response category needs a written anchor.')
  const labels: Record<string, string> = {}
  for (let i = 1; i <= points; i++) {
    const label = (anchors as Record<string, unknown>)[String(i)]
    if (typeof label !== 'string' || !label.trim()) throw new Error(`Response category ${i} has no anchor.`)
    labels[String(i)] = label.trim()
  }
  if (new Set(Object.values(labels).map(label => label.toLowerCase())).size !== points) throw new Error('Response anchors must be distinct.')
  if (anchorType !== 'agreement' && anchorType !== 'frequency') throw new Error('The response format must declare agreement or frequency anchors.')
  return { id: row.id, name: row.name, points, anchors: labels, anchorType }
}

export function assertLikertMeasure(measureType: string): void {
  if (!['trait', 'competency_behavioural', 'capability', 'preference', 'climate', 'validity_scale'].includes(measureType)) {
    throw new Error('Automatic creation currently supports Likert self-report items only. Choose a Likert construct type.')
  }
}

const issueSchema = z.object({
  code: z.enum(['double_barrel', 'ambiguity', 'construct_contamination', 'social_desirability', 'opportunity', 'culture', 'accessibility', 'anchor_mismatch', 'timeframe', 'negation', 'idiom', 'jargon', 'protected_class', 'metaphor', 'sensory_assumption', 'reading_level', 'response_bias', 'other']),
  severity: z.enum(['minor', 'major', 'critical']),
  evidence: z.string().trim().min(1).max(1200),
  fix: z.string().trim().min(1).max(1200),
})
export const reviewItemSchema = z.object({
  id: z.string().min(1),
  constructId: z.string().min(1),
  facetLabel: z.string().min(1),
  relevance: z.number().int().min(1).max(4),
  clarity: z.number().int().min(1).max(4),
  reverseScored: z.boolean(),
  lowTypicalHigh: z.tuple([z.number().int(), z.number().int(), z.number().int()]),
  paraphrase: z.string().trim().min(5).max(1200),
  issues: z.array(issueSchema).max(8),
  rationale: z.string().trim().min(5).max(1200),
})
export type ItemReview = z.infer<typeof reviewItemSchema>
export interface ReviewerResult {
  model: string
  items: ItemReview[]
  inputTokens?: number
  outputTokens?: number
}
export interface ItemQuality {
  version: typeof LIKERT_VERSION
  specHash: string
  itemHash: string
  reviewedAt: string
  reviews: Array<ItemReview & { model: string }>
  pass: boolean
  reasons: string[]
  score: number
  correctedKey: boolean
  readingGrade: number
}
export interface LikertCandidate {
  id: string
  blueprintCellId?: string | null
  stem: string
  reverseScored?: boolean | null
  status: string
  payload?: Record<string, unknown> | null
  updatedAt: string
}
export interface DiversityResult {
  contentHash: string
  model: string
  models?: string[]
  pairs: Array<{ a: string; b: string; reason: string }>
}
export interface LikertState {
  version: typeof LIKERT_VERSION
  revision: number
  options: LikertOptions
  models: { writer: string; blueprint: string; reviewers: string[] }
  phase: 'blueprint' | 'generate' | 'review' | 'diversity' | 'select' | 'form_review' | 'complete' | 'incomplete'
  round: number
  resumePhase?: Exclude<LikertState['phase'], 'complete' | 'incomplete'>
  blueprintHashes?: Record<string, string>
  blueprintRepairs?: number
  blueprintRepairIds?: string[]
  blueprintFeedback?: Record<string, unknown>
  formReviewStarted?: boolean
  formRepairRounds?: number
  specHash?: string
  diversity?: Record<string, DiversityResult>
  selectedIds: string[]
  pairChecks?: Record<string, FormPairCheck>
  failures: number
  calls: number
  detail: string
  blockers: string[]
  refillCellIds?: string[]
  generationCounts: Record<string, number>
}
export interface LikertStatus {
  jobId: string
  phase: LikertState['phase']
  round: number
  detail: string
  totalCandidates: number
  reviewed: number
  passed: number
  selected: number
  target: number
  blockers: string[]
  ready: boolean
  busy?: boolean
  pairsChecked?: number
  pairsRequired?: number
  roundLimit?: number
}

export interface LikertAuditReport {
  status: LikertStatus
  spec: LikertSpec
  specHash: string
  models: LikertState['models']
  calls: number
  targetAlphaGoal?: number
  items: Array<{ id: string; stem: string; reverseScored: boolean; constructId: string | null; construct: string; facet: string; selected: boolean; quality: ItemQuality | null }>
}
