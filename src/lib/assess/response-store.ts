/**
 * Local-first store for assessment responses.
 *
 * Every click writes here synchronously (well, microtask-fast via Dexie's
 * transaction queue) BEFORE any network attempt — so a tab close, browser
 * crash, OS reboot, or network drop cannot lose data. A background flusher
 * drains unsynced rows in batches to the server.
 *
 * Schema lives at version 1 with composite primary key [sessionId+itemId]:
 * we don't need response history per item — last value wins, just like the
 * server's upsert. The `synced` flag is stored as 0/1 (not boolean) because
 * Dexie/IDB cannot index boolean columns.
 */

import Dexie, { type Table } from "dexie";

export interface ResponseRecord {
  /** Composite PK with itemId — Dexie sorts on the array form. */
  sessionId: string;
  itemId: string;
  sectionId: string;
  /** Numeric Likert/binary/etc. value. */
  value: number;
  /** Format-specific extra payload (forced_choice mostLike/leastLike, ranking order…). */
  data: Record<string, unknown>;
  /** Response-time in ms from item display to click (optional). */
  responseTimeMs?: number;
  /** Stable per-write key — included with the server POST so a retried batch
   *  is naturally idempotent even though the server upserts on (session,item). */
  idempotencyKey: string;
  /** 0 = pending flush, 1 = confirmed by server. */
  synced: 0 | 1;
  /** Epoch ms — used to break ties and emit BroadcastChannel events. */
  updatedAt: number;
}

class ResponseDb extends Dexie {
  // Composite primary key [sessionId+itemId] — IndexableType for composite
  // keys is the tuple ([string, string] here). Dexie's `EntityTable` only
  // supports single-property PKs, so we use the plain `Table` generic.
  responses!: Table<ResponseRecord, [string, string]>;

  constructor() {
    super("TrajectasResponses");
    this.version(1).stores({
      // Composite PK on [sessionId+itemId]. Secondary indexes on sessionId
      // (resume hydrate), [sessionId+synced] (flusher scan), and updatedAt
      // (lifecycle / analytics).
      responses: "[sessionId+itemId], sessionId, [sessionId+synced], updatedAt",
    });
  }
}

let _db: ResponseDb | null = null;

/** Lazy singleton — Dexie can only be constructed in the browser. */
export function getResponseDb(): ResponseDb {
  if (!_db) {
    _db = new ResponseDb();
  }
  return _db;
}

/**
 * Upsert a response, marked as pending sync. Stable per-write idempotency
 * key generated here so the server-bound POST stays stable across retries.
 */
export async function putResponse(input: {
  sessionId: string;
  itemId: string;
  sectionId: string;
  value: number;
  data?: Record<string, unknown>;
  responseTimeMs?: number;
}): Promise<ResponseRecord> {
  const record: ResponseRecord = {
    sessionId: input.sessionId,
    itemId: input.itemId,
    sectionId: input.sectionId,
    value: input.value,
    data: input.data ?? {},
    responseTimeMs: input.responseTimeMs,
    idempotencyKey: makeIdempotencyKey(),
    synced: 0,
    updatedAt: Date.now(),
  };
  await getResponseDb().responses.put(record);
  return record;
}

/** Return all pending (unsynced) responses for a session, oldest first. */
export async function getPendingResponses(
  sessionId: string,
  limit?: number,
): Promise<ResponseRecord[]> {
  const query = getResponseDb()
    .responses.where("[sessionId+synced]")
    .equals([sessionId, 0])
    .sortBy("updatedAt");
  const rows = await query;
  return limit !== undefined ? rows.slice(0, limit) : rows;
}

/** Mark a set of (sessionId, itemId) pairs as synced. Idempotent. */
export async function markSynced(
  sessionId: string,
  itemIds: string[],
): Promise<void> {
  if (itemIds.length === 0) return;
  const db = getResponseDb();
  await db.transaction("rw", db.responses, async () => {
    for (const itemId of itemIds) {
      const existing = await db.responses.get([sessionId, itemId]);
      // Only mark synced if the row still represents the value we sent —
      // i.e. updatedAt hasn't moved on. If the user changed their answer
      // between the POST and its ACK, the row's idempotencyKey/updatedAt
      // will differ from what we sent and we leave synced=0 so the new
      // value flushes too.
      if (existing && existing.synced === 0) {
        await db.responses.update([sessionId, itemId], { synced: 1 });
      }
    }
  });
}

/** Hydrate `responses` map from IDB on mount — keyed by itemId. */
export async function getResponsesForSession(
  sessionId: string,
): Promise<Map<string, { value: number; data: Record<string, unknown> }>> {
  const rows = await getResponseDb()
    .responses.where("sessionId")
    .equals(sessionId)
    .toArray();
  const map = new Map<string, { value: number; data: Record<string, unknown> }>();
  for (const r of rows) {
    map.set(r.itemId, { value: r.value, data: r.data });
  }
  return map;
}

/** Count pending entries — used to gate flushing and surface UI hints. */
export async function countPending(sessionId: string): Promise<number> {
  return getResponseDb()
    .responses.where("[sessionId+synced]")
    .equals([sessionId, 0])
    .count();
}

/** Drop all rows for a session — call once the assessment is fully submitted. */
export async function clearSession(sessionId: string): Promise<void> {
  await getResponseDb()
    .responses.where("sessionId")
    .equals(sessionId)
    .delete();
}

function makeIdempotencyKey(): string {
  // crypto.randomUUID is available in all modern browsers and Node 19+.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for environments without it (older test runners).
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
