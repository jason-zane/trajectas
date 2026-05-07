import { z } from 'zod'

export const updateDisplayNameSchema = z.object({
  displayName: z.string().max(200),
})

export type UpdateDisplayNameInput = z.infer<typeof updateDisplayNameSchema>
