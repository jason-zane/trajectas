import { z } from 'zod'
import { postgresUuid } from './uuid'

/** Validation schemas for the item bank admin Server Actions (LR-8 / #347). */

export const itemLifecycleStateSchema = z.enum([
  'draft',
  'content_reviewed',
  'fairness_reviewed',
  'piloting',
  'calibrated',
  'operational',
  'suspended',
  'retired',
  'killed',
])

export const recordItemReviewSchema = z.object({
  itemId: postgresUuid(),
  /**
   * Content and fairness are separate judgements, deliberately not a single
   * "reviewed" flag — see #347 and migration 20260814110000.
   */
  reviewKind: z.enum(['content', 'fairness']),
  decision: z.enum(['approved', 'rejected']),
  notes: z.string().trim().max(4000).optional(),
})
export type RecordItemReviewInput = z.infer<typeof recordItemReviewSchema>

export const transitionItemLifecycleSchema = z.object({
  itemId: postgresUuid(),
  targetState: itemLifecycleStateSchema,
})
export type TransitionItemLifecycleInput = z.infer<typeof transitionItemLifecycleSchema>

export const ingestGeneratedBankSchema = z.object({
  /** Parsed contents of the generator's `items.json`. */
  items: z.unknown(),
  /** Parsed contents of the generator's `summary.json`. */
  summary: z.unknown(),
  constructId: postgresUuid(),
  responseFormatId: postgresUuid(),
  purpose: z.enum(['construct', 'practice', 'seed']).default('construct'),
  gitSha: z.string().trim().max(64).optional(),
  /** Overrides the default figural-matrix instruction stem. */
  stem: z.string().trim().min(1).max(500).optional(),
})
export type IngestGeneratedBankInput = z.infer<typeof ingestGeneratedBankSchema>
