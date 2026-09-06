import { z } from "zod";
const finite = z.number().finite();
const estimate = z.object({
  value: finite,
  lower: finite,
  upper: finite,
  p: finite.min(0).max(1),
  q: finite.min(0).max(1),
});
const test = z.object({ p: finite.min(0).max(1), q: finite.min(0).max(1) });
const point = z.object({ x: finite, y: finite });
const modelDetails = z.object({
  kind: z.enum(["linear", "logistic", "poisson"]),
  terms: z
    .array(
      z.object({
        id: z.string(),
        kind: z.enum(["capability", "control", "campaign", "intercept"]),
        label: z.string(),
        predictorId: z.string().nullable(),
        estimate: estimate
          .omit({ q: true })
          .extend({ q: finite.min(0).max(1).optional() })
          .nullable(),
        standardError: finite.nullable(),
        statistic: finite.nullable(),
        standardizedBeta: finite.nullable(),
        vif: finite.nullable(),
        reference: z
          .object({ mean: finite, minimum: finite, maximum: finite })
          .nullable(),
      }),
    )
    .max(160),
  references: z.array(z.object({ label: z.string(), value: z.string() })),
  residualDf: z.number().int().min(0),
  outcomeMean: finite,
  r2: finite.nullable(),
  adjustedR2: finite.nullable(),
  contextR2: finite.nullable(),
  addedR2: finite.nullable(),
  rmse: finite.nullable(),
  deviance: finite.nullable(),
  maxCooksDistance: finite.nullable(),
  dispersion: finite.nullable(),
  jointTest: z
    .object({
      value: finite,
      p: finite.min(0).max(1),
      numeratorDf: z.number().int(),
      denominatorDf: z.number().int(),
    })
    .nullable(),
  contributions: z
    .array(
      z.object({
        predictorId: z.string(),
        deltaR2: finite,
        partialR2: finite.nullable(),
      }),
    )
    .max(10),
  residualKind: z.enum(["response", "deviance"]),
  residuals: z.array(point).max(240),
});

const finding = z.object({
  predictorId: z.string(),
  n: z.number().int().min(0),
  correlation: estimate.nullable(),
  spearman: finite.nullable(),
  spearmanTest: test.nullable().optional(),
  trend: z.object({ slope: finite, intercept: finite }).nullable().optional(),
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
  plots: z
    .object({
      predictorIds: z.array(z.string()).max(10),
      metricIds: z.array(z.string()).max(8),
      total: z.number().int().min(0).max(5000),
      points: z
        .array(
          z.object({
            scores: z.array(finite.nullable()).max(10),
            outcomes: z.array(finite.nullable()).max(8),
          }),
        )
        .max(240),
    })
    .optional(),
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
        details: modelDetails.nullable().optional(),
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
