import { z } from 'zod'
import { postgresUuid } from '@/lib/validations/uuid'

const entityTypeSchema = z.enum(['dimension', 'factor', 'construct'])

export const getPartnerTaxonomyAssignmentsSchema = z.object({
  partnerId: postgresUuid(),
  entityType: entityTypeSchema,
})

export const togglePartnerTaxonomyAssignmentSchema = z.object({
  partnerId: postgresUuid(),
  entityType: entityTypeSchema,
  entityId: postgresUuid(),
  assigned: z.boolean(),
})

export const bulkTogglePartnerTaxonomyAssignmentsSchema = z.object({
  partnerId: postgresUuid(),
  entityType: entityTypeSchema,
  entityIds: z.array(postgresUuid()).min(1),
  assigned: z.boolean(),
})

export type GetPartnerTaxonomyAssignmentsInput = z.infer<typeof getPartnerTaxonomyAssignmentsSchema>
export type TogglePartnerTaxonomyAssignmentInput = z.infer<typeof togglePartnerTaxonomyAssignmentSchema>
export type BulkTogglePartnerTaxonomyAssignmentsInput = z.infer<typeof bulkTogglePartnerTaxonomyAssignmentsSchema>
