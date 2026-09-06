import { z } from "zod";
const optionalId = z.union([z.uuid(), z.literal("")]);
const date = z.union([z.iso.date(), z.literal("")]);
export const metricSchema = z
  .object({
    id: z.string().min(1).max(80),
    column: z.string().min(1).max(150),
    label: z.string().min(1).max(100),
    kind: z.enum(["continuous", "binary", "count"]),
    unit: z.string().max(40),
    direction: z.enum(["higher", "lower"]),
    display: z.enum(["number", "percent", "currency"]),
    currency: z.string().regex(/^[A-Z]{3}$/),
    minimum: z.number().finite().nullable(),
    maximum: z.number().finite().nullable(),
    exposureColumn: z.string().max(150),
  })
  .refine(
    (m) => m.minimum === null || m.maximum === null || m.minimum < m.maximum,
    "The maximum must exceed the minimum.",
  );
export const outcomeConfigSchema = z
  .object({
    campaignIds: z.array(z.uuid()).max(40),
    predictorIds: z.array(z.string().min(1).max(400)).max(10),
    importId: optionalId,
    joinColumn: z.string().max(150),
    joinMode: z.enum(["person_key", "email"]),
    periodStart: date,
    periodEnd: date,
    maxScoreAgeDays: z.number().int().min(1).max(3650),
    controls: z
      .array(
        z.object({
          column: z.string().min(1).max(150),
          kind: z.enum(["numeric", "category"]),
        }),
      )
      .max(5),
    metrics: z.array(metricSchema).max(8),
    comparabilityReviewed: z.boolean(),
  })
  .refine(
    (c) => !c.periodStart || !c.periodEnd || c.periodStart <= c.periodEnd,
    "The outcome period must end after it starts.",
  );
export const studyCreateSchema = z.object({
  clientId: z.uuid(),
  title: z.string().trim().min(1).max(160),
  question: z.string().trim().max(1500),
});
export const reportDraftSchema = z.object({
  sections: z
    .object({
      comparison: z.boolean(),
      interpretation: z.boolean(),
      recommendation: z.boolean(),
      technical: z.boolean(),
    })
    .optional(),
  metricId: z.string().min(1).max(80),
  predictorId: z.string().min(1).max(400),
  headline: z.string().trim().min(1).max(160),
  interpretation: z.string().trim().min(1).max(2000),
  recommendation: z.string().trim().min(1).max(2000),
  scenario: z
    .object({
      enabled: z.boolean(),
      shift: z.number().finite().min(-1000).max(1000),
      people: z.number().int().min(1).max(1000000),
      periods: z.number().int().min(1).max(120),
      valuePerUnit: z.number().finite().min(0).max(1e9).nullable(),
      cost: z.number().finite().min(0).max(1e12),
      currency: z.string().max(3),
    })
    .refine(
      (s) =>
        !s.enabled || s.valuePerUnit === null || /^[A-Z]{3}$/.test(s.currency),
      {
        message:
          "Enter a three-letter currency code for the financial scenario.",
        path: ["currency"],
      },
    ),
});
export function strictNumber(value: string | undefined): number | null {
  const normalized = value?.trim() ?? "";
  if (
    !normalized ||
    !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(normalized)
  )
    return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}
export function csvCell(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  const text = String(value ?? "");
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
