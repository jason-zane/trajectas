import { z } from 'zod'

export const responseFormatSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  type: z.enum(['likert', 'forced_choice', 'binary', 'free_text', 'sjt']),
  isActive: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === 'true')
    .default(true),
  config: z.record(z.string(), z.unknown()).default({}),
})

export type ResponseFormatInput = z.infer<typeof responseFormatSchema>
