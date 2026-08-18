import { createAdminClient } from "@/lib/supabase/admin";
import { logActionError } from "@/lib/security/action-errors";
import { checkAssessApiTokenRateLimit } from "@/lib/security/rate-limit";
import {
  parseJsonRequestWithLimit,
  RequestBodyTooLargeError,
} from "@/lib/security/request-body";
import { saveBatchInputSchema } from "@/lib/validations/assess-batch";

export const runtime = "nodejs";

// 50 entries × ~512B each + envelope. 64KB is well within sendBeacon limits
// across browsers (the body size cap there is ~64KB), so a flush-on-pagehide
// via sendBeacon can use the same endpoint and payload shape.
const MAX_BATCH_BODY_BYTES = 64 * 1024;

/**
 * Batched response save. One ownership check + one item-membership check +
 * N upserts, all inside a single Postgres transaction (via the
 * save_responses_batch_for_session RPC).
 *
 * Replaces N individual POSTs to /api/assess/save when the IndexedDB-backed
 * flusher has a queue to drain. Same endpoint is also called by the
 * pagehide sendBeacon fallback (for browsers without Background Sync) and
 * by the Service Worker on online/sync events.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await parseJsonRequestWithLimit(request, MAX_BATCH_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json({ error: "Request body too large" }, { status: 413 });
    }
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = saveBatchInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }

  const { token, sessionId, saves } = parsed.data;

  // Per-token budget on top of the proxy's per-IP rule; keyed on the token
  // actually submitted, so it can't be dodged by forging request headers.
  const rateLimit = await checkAssessApiTokenRateLimit("save-batch", token);
  if (rateLimit && !rateLimit.allowed) {
    return Response.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const db = createAdminClient();
  const { data, error } = await db.rpc("save_responses_batch_for_session", {
    p_access_token: token,
    p_session_id: sessionId,
    p_saves: saves.map((s) => ({
      itemId: s.itemId,
      responseValue: s.responseValue,
      responseData: s.responseData ?? {},
      responseTimeMs: s.responseTimeMs ?? null,
    })),
  });

  if (error) {
    logActionError("apiAssessSaveBatch.rpc", error);
    return Response.json({ error: "Unable to save batch" }, { status: 500 });
  }

  if (typeof data === "number" && data < 0) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Two RPC result shapes are in play across the deploy boundary:
  //
  //   old: ["<itemId>", ...]                          — saved ids only
  //   new: { acked: [...], terminal: [...] }          — 20260818230000
  //
  // `acked` means "a response for this (session, item) is durably stored" —
  // whether this write stored it or an earlier identical one did. `terminal`
  // means "this entry can never be saved" (item not in the assessment, or the
  // answer arrived after the section closed and no earlier save landed): the
  // client must stop retrying it, or its queue wedges and the participant
  // hangs at every section boundary. This code ships BEFORE the migration is
  // applied, so both shapes must parse; anything else is a hard error.
  let savedItemIds: string[];
  let terminalItemIds: string[] = [];
  if (Array.isArray(data)) {
    savedItemIds = data as string[];
  } else if (
    data !== null &&
    typeof data === "object" &&
    Array.isArray((data as { acked?: unknown }).acked)
  ) {
    const shaped = data as { acked: unknown[]; terminal?: unknown[] };
    savedItemIds = shaped.acked.filter((id): id is string => typeof id === "string");
    terminalItemIds = (shaped.terminal ?? []).filter(
      (id): id is string => typeof id === "string",
    );
  } else {
    logActionError(
      "apiAssessSaveBatch.rpc",
      new Error(`unexpected RPC result shape: ${typeof data}`),
    );
    return Response.json({ error: "Unable to save batch" }, { status: 500 });
  }

  const savedSet = new Set(savedItemIds);
  return Response.json(
    {
      success: true,
      saved: savedItemIds.length,
      savedItemIds,
      terminalItemIds,
      idempotencyKeys: saves
        .filter((s) => savedSet.has(s.itemId))
        .map((s) => s.idempotencyKey),
    },
    { status: 200 },
  );
}
