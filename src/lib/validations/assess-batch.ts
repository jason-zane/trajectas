import { z } from "zod";
import { postgresUuid } from "@/lib/validations/uuid";

/** Single response inside a batched save. Keys mirror the IndexedDB record. */
export const saveBatchEntrySchema = z.object({
  itemId: postgresUuid(),
  responseValue: z.number(),
  responseData: z.record(z.string(), z.unknown()).optional(),
  responseTimeMs: z.number().int().optional(),
  /** Client-generated stable key — round-tripped so the client can correlate
   *  ACKs back to its IndexedDB rows. The server does not currently dedupe
   *  on this; (session_id, item_id) upsert is naturally idempotent. */
  idempotencyKey: z.string().min(1).max(64),
});

export const saveBatchInputSchema = z.object({
  token: z.string().min(1),
  sessionId: postgresUuid(),
  saves: z.array(saveBatchEntrySchema).min(1).max(50),
});

export type SaveBatchInput = z.infer<typeof saveBatchInputSchema>;
export type SaveBatchEntry = z.infer<typeof saveBatchEntrySchema>;
