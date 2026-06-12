import { z } from 'zod'
import { postgresUuid } from '@/lib/validations/uuid'

/**
 * The canvas renders at most 8 people; beyond that the table view is the
 * right tool (spec: "9+ people → Table"). The action enforces the same cap.
 */
export const CANVAS_MAX_PEOPLE = 8

export const canvasRequestSchema = z.object({
  campaignParticipantIds: z
    .array(postgresUuid('Invalid participant ID'))
    .min(1, 'Pick at least one participant')
    .max(CANVAS_MAX_PEOPLE, 'Too many participants for the canvas — use the table view'),
})
export type CanvasRequestInput = z.infer<typeof canvasRequestSchema>
