import { z } from 'zod'

export const updateDisplayNameSchema = z.object({
  displayName: z.string().max(120, 'Display name is too long'),
})

export type UpdateDisplayNameInput = z.infer<typeof updateDisplayNameSchema>
