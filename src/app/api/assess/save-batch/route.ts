import { createAdminClient } from "@/lib/supabase/admin";
import { logActionError } from "@/lib/security/action-errors";
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

  // Echo back the idempotency keys that were intended to be saved so the
  // client can mark exactly those IDB rows as synced even if the server
  // silently dropped some (e.g. unknown item_id outside this assessment).
  return Response.json(
    {
      success: true,
      saved: typeof data === "number" ? data : saves.length,
      idempotencyKeys: saves.map((s) => s.idempotencyKey),
    },
    { status: 200 },
  );
}
