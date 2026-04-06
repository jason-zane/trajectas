import { z } from 'zod'

export const diagnosticTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(4000).optional(),
  isActive: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === 'true')
    .default(true),
})

export const diagnosticSessionSchema = z.object({
  clientId: z.string().uuid('Client is required'),
  templateId: z.string().uuid('Template is required'),
  title: z.string().min(1, 'Title is required').max(300),
  status: z.enum(['draft', 'active', 'completed', 'archived']).default('draft'),
  expiresAt: z.string().optional(),
})

export type DiagnosticTemplateInput = z.infer<typeof diagnosticTemplateSchema>
export type DiagnosticSessionInput = z.infer<typeof diagnosticSessionSchema>
