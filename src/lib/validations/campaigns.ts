import { z } from 'zod'

export const campaignSchema = z.object({
  title: z.string().min(1, 'Title is required').max(300),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(200)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(4000).optional(),
  status: z.enum(['draft', 'active', 'paused', 'closed', 'archived']).default('draft'),
  organizationId: z.string().uuid().optional().or(z.literal('')),
  partnerId: z.string().uuid().optional().or(z.literal('')),
  opensAt: z.string().optional().or(z.literal('')),
  closesAt: z.string().optional().or(z.literal('')),
  allowResume: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === 'true')
    .default(true),
  showProgress: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === 'true')
    .default(true),
  randomizeAssessmentOrder: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === 'true')
    .default(false),
})

export type CampaignInput = z.infer<typeof campaignSchema>

export const inviteCandidateSchema = z.object({
  email: z.string().email('Valid email is required'),
  firstName: z.string().max(200).optional(),
  lastName: z.string().max(200).optional(),
})

export type InviteCandidateInput = z.infer<typeof inviteCandidateSchema>

export const accessLinkSchema = z.object({
  label: z.string().max(200).optional(),
  maxUses: z.coerce.number().int().positive().optional(),
  expiresAt: z.string().optional().or(z.literal('')),
})

export type AccessLinkInput = z.infer<typeof accessLinkSchema>
