"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  countPending,
  getPendingResponses,
  getResponsesForSession,
  markSynced,
  putResponse,
  type ResponseRecord,
} from "@/lib/assess/response-store";

type SaveStatus = "idle" | "saving" | "saved";

type LocalResponses = Record<string, { value: number; data: Record<string, unknown> }>;

type SaveEntry = { itemId: string; sectionId: string; value: number; data?: Record<string, unknown>; responseTimeMs?: number };
type QueueConfig = { token: string; sessionId: string; sessionProof?: string; initialRevisions?: Record<string, number> };
type LocalWrite = { entry: SaveEntry; config: QueueConfig; inFlight: boolean };
type QueueLifetime = { active: boolean; writes: Set<Promise<void>>; localWrites: Map<string, LocalWrite> };

/** Soft cap on entries per batched POST. The server validator caps at 50 too. */
const BATCH_LIMIT = 25;
/** Flush when pending count reaches this — keeps small clicks moving without
 *  waiting the full debounce interval. */
const FLUSH_PENDING_THRESHOLD = 8;
/** Debounce window for the background flusher. */
const FLUSH_INTERVAL_MS = 1500;
/** Per-request timeout for the batched POST. */
const SAVE_TIMEOUT_MS = 15_000;
/** Absolute ceiling for flushSaves (boundary navigation). */
const FLUSH_TIMEOUT_MS = 45_000;
/** Maximum consecutive flush failures before surfacing the error banner. */
const MAX_CONSECUTIVE_FAILURES = 5;

/** Exponential backoff with jitter, ceiling at 10s, integer ms. */
function retryDelay(attempt: number) {
  const base = Math.min(1000 * Math.pow(2, attempt - 1), 10_000);
  const jitter = Math.random() * base * 0.3;
  return Math.ceil(base + jitter);
}

async function postBatch(
  token: string,
  sessionId: string,
  rows: ResponseRecord[],
  sessionProof?: string,
): Promise<{
  ok: boolean;
  status?: number;
  savedItemIds: string[] | null;
  terminalItemIds: string[];
}> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SAVE_TIMEOUT_MS);
  try {
    const res = await globalThis.fetch("/api/assess/save-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(sessionProof ? { "x-assess-session-proof": sessionProof } : {}) },
      body: JSON.stringify({
        token,
        sessionId,
        saves: rows.map((r) => ({
          itemId: r.itemId,
          responseValue: r.value,
          responseData: r.data,
          responseTimeMs: r.responseTimeMs,
          idempotencyKey: r.idempotencyKey,
          revision: r.revision,
        })),
      }),
      keepalive: true,
      signal: controller.signal,
    });
    // The server may save only a subset of the batch (an item that doesn't
    // belong to the session's assessment is skipped, not saved). Only the
    // ids in `savedItemIds` are confirmed persisted — anything else must
    // stay pending in IDB. A 2xx with no readable savedItemIds array counts
    // as unconfirmed (null), NOT as all-saved.
    let savedItemIds: string[] | null = null;
    let terminalItemIds: string[] = [];
    if (res.ok) {
      try {
        const body: unknown = await res.json();
        const parsedBody = body as
          | { savedItemIds?: unknown; terminalItemIds?: unknown }
          | null;
        const ids = parsedBody?.savedItemIds;
        if (Array.isArray(ids)) {
          savedItemIds = ids.filter((id): id is string => typeof id === "string");
        }
        // Entries the server has DEFINITIVELY refused (item not in the
        // assessment, or the answer arrived after the section closed with no
        // earlier save landed). Retrying one of these can never succeed —
        // they must leave the queue, or it wedges and the participant hangs
        // at every section boundary behind a drain that cannot finish.
        const terminals = parsedBody?.terminalItemIds;
        if (Array.isArray(terminals)) {
          terminalItemIds = terminals.filter(
            (id): id is string => typeof id === "string",
          );
        }
      } catch {
        // Unparseable body — leave savedItemIds null so nothing is marked.
      }
    }
    return { ok: res.ok, status: res.status, savedItemIds, terminalItemIds };
  } catch {
    return { ok: false, savedItemIds: null, terminalItemIds: [] };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * IndexedDB-backed save queue.
 *
 * Every enqueueSave writes to IDB FIRST, then schedules a background flush.
 * The flush reads pending rows in batches and POSTs to /api/assess/save-batch.
 * Only rows the server confirms saved (the response's savedItemIds) are
 * marked synced=1 in IDB; everything else stays pending and the flusher
 * retries with exponential backoff. This survives tab close, refresh, and
 * offline windows — the user's responses live in their browser's persistent
 * storage until the server confirms them. If the local write itself fails,
 * the latest edit stays in memory with an error and unload warning; Retry
 * must persist it before a boundary can succeed.
 *
 * `localResponses` exposes the IDB-hydrated map on mount so section-wrapper
 * can merge it into its server-rendered `existingResponses` (an in-progress
 * participant who had unsynced rows last session resumes with their work
 * visible, not lost).
 */
export function useSaveQueue(config: QueueConfig) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState(false);
  const [localResponses, setLocalResponses] = useState<LocalResponses | null>(null);
  // Count of answers the server has definitively refused (see postBatch).
  // Surfaced so the runner can tell the participant an answer was not
  // counted, instead of either hanging on it or staying silent.
  const [lostSaves, setLostSaves] = useState(0);

  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const consecutiveFailuresRef = useRef(0);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFlushingRef = useRef<QueueLifetime | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drainWaitersRef = useRef(new Set<(ok: boolean) => void>());
  const lifetimeRef = useRef<QueueLifetime | null>(null);
  const isCurrent = useCallback((lifetime: QueueLifetime | null) =>
    lifetime !== null && lifetime.active && lifetimeRef.current === lifetime, []);

  useEffect(() => {
    // A new identity also covers StrictMode's cleanup/setup cycle: late work
    // from the old effect must not become active again when the hook resumes.
    const lifetime: QueueLifetime = { active: true, writes: new Set(), localWrites: new Map() };
    const drainWaiters = drainWaitersRef.current;
    lifetimeRef.current = lifetime;
    consecutiveFailuresRef.current = 0;
    return () => {
      lifetime.active = false;
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      flushTimerRef.current = null;
      savedTimerRef.current = null;
      for (const finish of drainWaiters) finish(false);
      // Leave accepted IDB writes and any already-issued 15s-bounded POST
      // to finish. ACKs still match idempotency keys, but neither continuation
      // may start another flush or retry. Pending rows survive for remount.
    };
  }, [config.sessionId]);

  // ---------------------------------------------------------------------------
  // Hydration — read IDB once on mount, expose as localResponses for merge.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const map = await getResponsesForSession(config.sessionId);
        if (cancelled) return;
        const obj: LocalResponses = {};
        map.forEach((v, k) => {
          obj[k] = v;
        });
        for (const { entry } of lifetimeRef.current?.localWrites.values() ?? []) {
          obj[entry.itemId] = { value: entry.value, data: entry.data ?? {} };
        }
        setLocalResponses(obj);
        // If hydration shows pending rows, kick a flush.
        const pending = await countPending(config.sessionId);
        if (pending > 0 && !cancelled) scheduleFlushSoon();
      } catch {
        // A later write will surface storage failure. Never assume an empty
        // failed read proves that an accepted answer has been persisted.
        if (!cancelled) setLocalResponses((prev) => prev ?? {});
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.sessionId]);

  // ---------------------------------------------------------------------------
  // Flush — read pending from IDB, POST as a batch, mark synced.
  // ---------------------------------------------------------------------------
  const flushOnceRef = useRef<() => Promise<boolean>>(async () => true);

  const notifyDrainWaiters = useCallback((ok: boolean) => {
    for (const finish of drainWaitersRef.current) finish(ok);
  }, []);

  const flushOnce = useCallback(async (): Promise<boolean> => {
    const lifetime = lifetimeRef.current;
    if (!isCurrent(lifetime)) return false;
    if (isFlushingRef.current === lifetime) return true;
    const { token, sessionId, sessionProof } = configRef.current;
    isFlushingRef.current = lifetime;
    let storageFailed = false;
    try {
      // Loop so a single flushOnce call drains everything that's currently
      // pending — multiple batches if the queue is bigger than BATCH_LIMIT.
      for (;;) {
        const rows = await getPendingResponses(sessionId, BATCH_LIMIT);
        if (!isCurrent(lifetime)) return false;
        if (rows.length === 0) {
          if (!lifetime?.localWrites.size) {
            consecutiveFailuresRef.current = 0;
            setSaveError(false);
          }
          return true;
        }
        setSaveStatus("saving");
        const result = await postBatch(token, sessionId, rows, sessionProof);
        // Mark ONLY the ids the server confirmed saved — and only when the
        // IDB row is still the exact write we sent (idempotency-key match
        // inside markSynced). An answer changed while this POST was in
        // flight keeps synced=0 so the newer value flushes on the next loop
        // pass instead of being silently dropped. Unconfirmed rows likewise
        // stay pending and keep retrying.
        const confirmedSet = new Set(result.savedItemIds ?? []);
        const confirmed = rows.filter((r) => confirmedSet.has(r.itemId));
        // Terminal entries leave the queue exactly like confirmed ones —
        // the difference is only what we tell the participant. Marking them
        // synced is what unwedges the drain; counting them is what keeps
        // the loss from being silent.
        const terminalSet = new Set(result.terminalItemIds);
        const terminal = rows.filter(
          (r) => terminalSet.has(r.itemId) && !confirmedSet.has(r.itemId),
        );
        const resolved = [...confirmed, ...terminal];
        if (resolved.length > 0) {
          await markSynced(
            sessionId,
            resolved.map((r) => ({
              itemId: r.itemId,
              idempotencyKey: r.idempotencyKey,
            })),
          );
        }
        if (!isCurrent(lifetime)) return false;
        if (terminal.length > 0) {
          setLostSaves((n) => n + terminal.length);
        }
        if (!result.ok || resolved.length < rows.length) {
          consecutiveFailuresRef.current++;
          if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
            setSaveError(true);
          }
          return false;
        }
        consecutiveFailuresRef.current = 0;
        if (!lifetime?.localWrites.size) setSaveError(false);
        // Loop — there may be more pending (or more arrived during the POST).
      }
    } catch {
      storageFailed = true;
      // Storage can be unavailable even when the network works. A failed
      // read/ACK transaction is not an empty queue and must fail closed.
      if (isCurrent(lifetime)) {
        consecutiveFailuresRef.current++;
        setSaveError(true);
        notifyDrainWaiters(false);
      }
      return false;
    } finally {
      if (isFlushingRef.current === lifetime) isFlushingRef.current = null;
      const remaining = isCurrent(lifetime) ? await countPending(sessionId).catch(() => null) : null;
      if (isCurrent(lifetime) && remaining === null) setSaveError(true);
      if (isCurrent(lifetime) && !storageFailed && remaining === 0 && !lifetime?.localWrites.size) {
        setSaveStatus("saved");
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => {
          savedTimerRef.current = null;
          if (isCurrent(lifetime)) setSaveStatus("idle");
        }, 2000);
      }
    }
  }, [isCurrent, notifyDrainWaiters]);
  useEffect(() => {
    flushOnceRef.current = flushOnce;
  }, [flushOnce]);

  /** Schedule a flush after FLUSH_INTERVAL_MS unless one is already pending. */
  const scheduleFlushSoon = useCallback(() => {
    const lifetime = lifetimeRef.current;
    if (!isCurrent(lifetime) || flushTimerRef.current) return;
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      // runFlushLoop is bound via runFlushLoopRef so this useCallback doesn't
      // need to depend on it (avoids the chicken/egg cycle of the two
      // mutually-recursive callbacks).
      if (isCurrent(lifetime)) void runFlushLoopRef.current();
    }, FLUSH_INTERVAL_MS);
  }, [isCurrent]);

  const runFlushLoopRef = useRef<() => Promise<void>>(async () => {});
  const runFlushLoop = useCallback(async () => {
    const lifetime = lifetimeRef.current;
    if (!isCurrent(lifetime)) return;
    const ok = await flushOnceRef.current();
    if (!isCurrent(lifetime)) return;
    if (!ok) {
      // Schedule a retry with exponential backoff based on consecutive failures.
      const attempt = consecutiveFailuresRef.current;
      const backoff = retryDelay(Math.max(1, attempt));
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      flushTimerRef.current = setTimeout(() => {
        flushTimerRef.current = null;
        if (isCurrent(lifetime)) void runFlushLoopRef.current();
      }, backoff);
    } else {
      // Check if more landed during the flush; schedule another sweep if so.
      const remaining = await countPending(configRef.current.sessionId).catch(() => null);
      if (!isCurrent(lifetime)) return;
      if (remaining === null) {
        setSaveError(true);
        notifyDrainWaiters(false);
        return;
      }
      if (remaining > 0) scheduleFlushSoon();
      else if (!lifetime?.writes.size) notifyDrainWaiters(!lifetime?.localWrites.size);
    }
  }, [isCurrent, notifyDrainWaiters, scheduleFlushSoon]);
  useEffect(() => {
    runFlushLoopRef.current = runFlushLoop;
  }, [runFlushLoop]);

  // ---------------------------------------------------------------------------
  // Public API — enqueueSave / flushSaves / retryFailedSaves.
  // ---------------------------------------------------------------------------

  const persistLocalWrite = useCallback(
    (lifetime: QueueLifetime, pending: LocalWrite) => {
      if (!isCurrent(lifetime) || pending.inFlight) return;
      pending.inFlight = true;
      const { entry, config: acceptedConfig } = pending;
      const { sessionId, initialRevisions } = acceptedConfig;
      setSaveStatus("saving");
      const write = (async () => {
        try {
          await putResponse({
            sessionId,
            itemId: entry.itemId,
            sectionId: entry.sectionId,
            value: entry.value,
            data: entry.data,
            responseTimeMs: entry.responseTimeMs,
            serverRevision: initialRevisions?.[entry.itemId],
          });
          // A newer edit may have replaced this one while IDB was writing.
          if (lifetime.localWrites.get(entry.itemId) === pending) lifetime.localWrites.delete(entry.itemId);
          const pendingCount = await countPending(sessionId).catch(() => null);
          if (!isCurrent(lifetime)) return;
          if (pendingCount === null) setSaveError(true);
          if (pendingCount !== null && pendingCount >= FLUSH_PENDING_THRESHOLD) {
            // Fast-path: flush immediately when the queue gets long enough.
            if (flushTimerRef.current) {
              clearTimeout(flushTimerRef.current);
              flushTimerRef.current = null;
            }
            void runFlushLoopRef.current();
          } else {
            scheduleFlushSoon();
          }
        } catch {
          // Do not bypass transactional revision allocation with a version-0
          // POST. Keep the latest accepted edit in memory, block navigation,
          // and let Retry persist it through the normal IDB/ACK path.
          if (isCurrent(lifetime) && lifetime.localWrites.get(entry.itemId) === pending) {
            setSaveError(true);
          }
        } finally {
          pending.inFlight = false;
        }
      })();
      lifetime.writes.add(write);
      void write.finally(() => lifetime.writes.delete(write));
    },
    [isCurrent, scheduleFlushSoon],
  );

  const enqueueSave = useCallback((entry: SaveEntry) => {
    const lifetime = lifetimeRef.current;
    if (!lifetime || !isCurrent(lifetime)) return;
    setLocalResponses((prev) => ({
      ...(prev ?? {}),
      [entry.itemId]: { value: entry.value, data: entry.data ?? {} },
    }));
    const pending: LocalWrite = { entry, config: configRef.current, inFlight: false };
    lifetime.localWrites.set(entry.itemId, pending);
    persistLocalWrite(lifetime, pending);
  }, [isCurrent, persistLocalWrite]);

  /**
   * Drain everything currently pending. Used by section/assessment boundaries
   * to guarantee persistence before navigating away. Returns true if the queue
   * is empty (all synced), false if a permanent failure prevented draining.
   */
  const flushSaves = useCallback((): Promise<boolean> => {
    const lifetime = lifetimeRef.current;
    if (!lifetime || !isCurrent(lifetime)) return Promise.resolve(false);
    const { sessionId } = configRef.current;
    return new Promise<boolean>((resolve) => {
      const finish = (ok: boolean) => {
        clearTimeout(timer);
        drainWaitersRef.current.delete(finish);
        resolve(ok);
      };
      const timer = setTimeout(() => finish(false), FLUSH_TIMEOUT_MS);
      drainWaitersRef.current.add(finish);
      void (async () => {
        // enqueueSave writes asynchronously: an empty IDB query alone does
        // not prove the answer just clicked has been stored or acknowledged.
        await Promise.allSettled([...lifetime.writes]);
        if (!isCurrent(lifetime)) return finish(false);
        if (lifetime.localWrites.size > 0) return finish(false);
        const remaining = await countPending(sessionId);
        if (!isCurrent(lifetime)) return finish(false);
        if (remaining === 0 && lifetime.writes.size === 0 && lifetime.localWrites.size === 0) return finish(true);
        if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
        void runFlushLoopRef.current();
      })().catch(() => {
        if (isCurrent(lifetime)) setSaveError(true);
        finish(false);
      });
    });
  }, [isCurrent]);

  /** Kick the flusher manually — called from the error-banner Retry button. */
  const retryFailedSaves = useCallback(() => {
    const lifetime = lifetimeRef.current;
    if (!lifetime || !isCurrent(lifetime)) return;
    consecutiveFailuresRef.current = 0;
    setSaveError(false);
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    for (const pending of lifetime.localWrites.values()) persistLocalWrite(lifetime, pending);
    void runFlushLoopRef.current();
  }, [isCurrent, persistLocalWrite]);

  // ---------------------------------------------------------------------------
  // Lifecycle — pagehide/visibilitychange fallback, online retry, BroadcastChannel.
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const { token, sessionId } = configRef.current;

    const flushViaBeacon = () => {
      // sendBeacon is a fire-and-forget POST that survives page unload.
      // We can't await it or read the response, but the server-side upsert
      // is idempotent so a duplicate-send is harmless.
      void (async () => {
        try {
          const rows = await getPendingResponses(sessionId, BATCH_LIMIT);
          if (rows.length === 0) return;
          const body = JSON.stringify({
            token,
            sessionId,
            saves: rows.map((r) => ({
              itemId: r.itemId,
              responseValue: r.value,
              responseData: r.data,
              responseTimeMs: r.responseTimeMs,
              idempotencyKey: r.idempotencyKey,
              revision: r.revision,
            })),
          });
          if (typeof navigator !== "undefined" && navigator.sendBeacon) {
            const blob = new Blob([body], { type: "application/json" });
            const proof = configRef.current.sessionProof;
            navigator.sendBeacon(`/api/assess/save-batch${proof ? `?sessionProof=${encodeURIComponent(proof)}` : ""}`, blob);
          }
        } catch {
          // Best-effort.
        }
      })();
    };

    const onPagehide = () => flushViaBeacon();
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushViaBeacon();
    };
    const onPageshow = (event: PageTransitionEvent) => {
      // bfcache restore — kick the flusher to verify everything synced.
      if (event.persisted) void runFlushLoopRef.current();
    };
    const onOnline = () => void runFlushLoopRef.current();
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      // Only these accepted writes lack disk durability. A synchronous guard
      // must warn before reload/close; asynchronous IDB reads are too late.
      if (!lifetimeRef.current?.localWrites.size) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("pagehide", onPagehide);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pageshow", onPageshow);
    window.addEventListener("online", onOnline);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      window.removeEventListener("pagehide", onPagehide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", onPageshow);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  // BroadcastChannel — keep multiple open tabs of the same session in sync.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(`assess-${config.sessionId}`);
    channel.onmessage = async (event) => {
      if (event.data?.type === "synced") {
        // Re-hydrate local state from IDB so this tab picks up the other tab's writes.
        try {
          const map = await getResponsesForSession(config.sessionId);
          const obj: LocalResponses = {};
          map.forEach((v, k) => {
            obj[k] = v;
          });
          for (const { entry } of lifetimeRef.current?.localWrites.values() ?? []) {
            obj[entry.itemId] = { value: entry.value, data: entry.data ?? {} };
          }
          setLocalResponses(obj);
        } catch {
          // Ignore.
        }
      }
    };
    return () => channel.close();
  }, [config.sessionId]);

  return {
    enqueueSave,
    flushSaves,
    retryFailedSaves,
    saveStatus,
    saveError,
    /** Answers the server definitively refused (arrived after a section
     *  closed, with no earlier save landed). Monotonic count for the
     *  session; the runner surfaces it once per increment. */
    lostSaves,
    /** IDB-hydrated map of responses for this session. Null until hydration completes. */
    localResponses,
  };
}
