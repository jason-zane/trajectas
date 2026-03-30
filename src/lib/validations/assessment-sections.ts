import { z } from 'zod'
import { postgresUuid } from './uuid'

export const assessmentSectionSchema = z.object({
  assessmentId: z.string().uuid(),
  responseFormatId: postgresUuid(),
  title: z.string().min(1, 'Title is required').max(300),
  instructions: z.string().max(4000).optional(),
  displayOrder: z.coerce.number().int().min(0).default(0),
  itemOrdering: z
    .enum(['fixed', 'randomised', 'interleaved_by_construct'])
    .default('interleaved_by_construct'),
  itemsPerPage: z.coerce.number().int().positive().optional(),
  timeLimitSeconds: z.coerce.number().int().positive().optional(),
  allowBackNav: z.boolean().default(true),
})

export type AssessmentSectionInput = z.infer<typeof assessmentSectionSchema>

export const assessmentSectionItemSchema = z.object({
  sectionId: z.string().uuid(),
  itemId: z.string().uuid(),
  displayOrder: z.coerce.number().int().min(0).default(0),
})

export type AssessmentSectionItemInput = z.infer<typeof assessmentSectionItemSchema>
