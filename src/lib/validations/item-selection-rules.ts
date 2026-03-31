import { z } from 'zod'

export const itemSelectionRuleSchema = z.object({
  id: z.string().optional(),
  minConstructs: z.coerce.number().int().min(1, 'Min must be at least 1'),
  maxConstructs: z.coerce.number().int().min(1).nullable(),
  itemsPerConstruct: z.coerce.number().int().min(1, 'Items per construct must be at least 1'),
  displayOrder: z.coerce.number().int().min(0).default(0),
})

export type ItemSelectionRuleInput = z.infer<typeof itemSelectionRuleSchema>

export const itemSelectionRulesArraySchema = z
  .array(itemSelectionRuleSchema)
  .min(1, 'At least one rule is required')
  .superRefine((rules, ctx) => {
    // Sort by minConstructs for validation
    const sorted = [...rules].sort((a, b) => a.minConstructs - b.minConstructs)

    for (let i = 0; i < sorted.length; i++) {
      const rule = sorted[i]

      // max_constructs must be >= min_constructs (if not null)
      if (rule.maxConstructs !== null && rule.maxConstructs < rule.minConstructs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Rule ${i + 1}: max constructs must be >= min constructs`,
          path: [i, 'maxConstructs'],
        })
      }

      // Check contiguity: next rule's min should be previous rule's max + 1
      if (i > 0) {
        const prev = sorted[i - 1]
        if (prev.maxConstructs === null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Only the last rule can have an open-ended max (no upper bound)`,
            path: [i - 1, 'maxConstructs'],
          })
        } else if (rule.minConstructs !== prev.maxConstructs + 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Rules must be contiguous: expected min ${prev.maxConstructs + 1} but got ${rule.minConstructs}`,
            path: [i, 'minConstructs'],
          })
        }
      }
    }
  })
