import { z } from "zod";
const finite = z.number().finite();
const estimate = z.object({
  value: finite,
  lower: finite,
  upper: finite,
  p: finite.min(0).max(1),
  q: finite.min(0).max(1),
});
const finding = z.object({
  predictorId: z.string(),
  n: z.number().int().min(0),
  correlation: estimate.nullable(),
  spearman: finite.nullable(),
  groups: z
    .object({
      low: finite,
      high: finite,
      lowN: z.number().int().min(10),
      highN: z.number().int().min(10),
      difference: finite,
      lower: finite,
      upper: finite,
    })
    .nullable(),
  adjusted: estimate.nullable(),
  adjustedPerSd: estimate.nullable().optional(),
  scoreMin: finite.nullable(),
  scoreMax: finite.nullable(),
  scoreMean: finite.nullable(),
  status: z.enum(["supported", "inconclusive", "unavailable"]),
  reason: z.string().nullable(),
});
export const outcomeResultSchema = z.object({
  engineVersion: z.string(),
  libraryVersions: z.record(z.string(), z.string()),
  seed: z.number().int(),
  warnings: z.array(z.string()),
  results: z.array(
    z.object({
      metricId: z.string(),
      n: z.number().int().min(0),
      missing: z.number().int().min(0),
      mean: finite.nullable(),
      sd: finite.nullable(),
      findings: z.array(finding),
      model: z.object({
        method: z.string(),
        n: z.number().int().min(0),
        parameters: z.number().int().min(0),
        controls: z.array(z.string()),
        warnings: z.array(z.string()),
        unavailable: z.string().nullable(),
      }),
      validation: z
        .object({
          method: z.string(),
          n: z.number().int(),
          folds: z.number().int(),
          metric: z.string(),
          baseline: finite,
          assessment: finite,
          improvement: finite,
        })
        .nullable(),
      validationReason: z.string().nullable(),
    }),
  ),
});
