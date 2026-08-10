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

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
): Promise<{ ok: boolean; status?: number; savedItemIds: string[] | null }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SAVE_TIMEOUT_MS);
  try {
    const res = await globalThis.fetch("/api/assess/save-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        sessionId,
        saves: rows.map((r) => ({
          itemId: r.itemId,
          responseValue: r.value,
          responseData: r.data,
          responseTimeMs: r.responseTimeMs,
          idempotencyKey: r.idempotencyKey,
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
    if (res.ok) {
      try {
        const body: unknown = await res.json();
        const ids = (body as { savedItemIds?: unknown } | null)?.savedItemIds;
        if (Array.isArray(ids)) {
          savedItemIds = ids.filter((id): id is string => typeof id === "string");
        }
      } catch {
        // Unparseable body — leave savedItemIds null so nothing is marked.
      }
    }
    return { ok: res.ok, status: res.status, savedItemIds };
  } catch {
    return { ok: false, savedItemIds: null };
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
 * storage until the server confirms them.
 *
 * `localResponses` exposes the IDB-hydrated map on mount so section-wrapper
 * can merge it into its server-rendered `existingResponses` (an in-progress
 * participant who had unsynced rows last session resumes with their work
 * visible, not lost).
 */
export function useSaveQueue(config: { token: string; sessionId: string }) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState(false);
  const [localResponses, setLocalResponses] = useState<LocalResponses | null>(null);

  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const consecutiveFailuresRef = useRef(0);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFlushingRef = useRef(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drainWaitersRef = useRef<Array<(ok: boolean) => void>>([]);

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
        setLocalResponses(obj);
        // If hydration shows pending rows, kick a flush.
        const pending = await countPending(config.sessionId);
        if (pending > 0 && !cancelled) scheduleFlushSoon();
      } catch {
        // IDB unavailable (private mode, quota, etc.) — degrade silently:
        // the queue still works in-memory via the existing per-save fetch
        // pathway, just without durability guarantees.
        setLocalResponses({});
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
    const waiters = drainWaitersRef.current.splice(0);
    for (const resolve of waiters) resolve(ok);
  }, []);

  const flushOnce = useCallback(async (): Promise<boolean> => {
    if (isFlushingRef.current) return true;
    const { token, sessionId } = configRef.current;
    isFlushingRef.current = true;
    try {
      // Loop so a single flushOnce call drains everything that's currently
      // pending — multiple batches if the queue is bigger than BATCH_LIMIT.
      for (;;) {
        const rows = await getPendingResponses(sessionId, BATCH_LIMIT);
        if (rows.length === 0) {
          consecutiveFailuresRef.current = 0;
          setSaveError(false);
          return true;
        }
        setSaveStatus("saving");
        const result = await postBatch(token, sessionId, rows);
        // Mark ONLY the ids the server confirmed saved — and only when the
        // IDB row is still the exact write we sent (idempotency-key match
        // inside markSynced). An answer changed while this POST was in
        // flight keeps synced=0 so the newer value flushes on the next loop
        // pass instead of being silently dropped. Unconfirmed rows likewise
        // stay pending and keep retrying.
        const confirmedSet = new Set(result.savedItemIds ?? []);
        const confirmed = rows.filter((r) => confirmedSet.has(r.itemId));
        if (confirmed.length > 0) {
          await markSynced(
            sessionId,
            confirmed.map((r) => ({
              itemId: r.itemId,
              idempotencyKey: r.idempotencyKey,
            })),
          );
        }
        if (!result.ok || confirmed.length < rows.length) {
          consecutiveFailuresRef.current++;
          if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
            setSaveError(true);
          }
          return false;
        }
        consecutiveFailuresRef.current = 0;
        setSaveError(false);
        // Loop — there may be more pending (or more arrived during the POST).
      }
    } finally {
      isFlushingRef.current = false;
      const remaining = await countPending(configRef.current.sessionId).catch(() => 0);
      if (remaining === 0) {
        setSaveStatus("saved");
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
      }
    }
  }, []);
  useEffect(() => {
    flushOnceRef.current = flushOnce;
  }, [flushOnce]);

  /** Schedule a flush after FLUSH_INTERVAL_MS unless one is already pending. */
  const scheduleFlushSoon = useCallback(() => {
    if (flushTimerRef.current) return;
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      // runFlushLoop is bound via runFlushLoopRef so this useCallback doesn't
      // need to depend on it (avoids the chicken/egg cycle of the two
      // mutually-recursive callbacks).
      void runFlushLoopRef.current();
    }, FLUSH_INTERVAL_MS);
  }, []);

  const runFlushLoopRef = useRef<() => Promise<void>>(async () => {});
  const runFlushLoop = useCallback(async () => {
    const ok = await flushOnceRef.current();
    if (!ok) {
      // Schedule a retry with exponential backoff based on consecutive failures.
      const attempt = consecutiveFailuresRef.current;
      const backoff = retryDelay(Math.max(1, attempt));
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      flushTimerRef.current = setTimeout(() => {
        flushTimerRef.current = null;
        void runFlushLoopRef.current();
      }, backoff);
    } else {
      // Check if more landed during the flush; schedule another sweep if so.
      const remaining = await countPending(configRef.current.sessionId).catch(() => 0);
      if (remaining > 0) scheduleFlushSoon();
      else notifyDrainWaiters(true);
    }
  }, [notifyDrainWaiters, scheduleFlushSoon]);
  useEffect(() => {
    runFlushLoopRef.current = runFlushLoop;
  }, [runFlushLoop]);

  // ---------------------------------------------------------------------------
  // Public API — enqueueSave / flushSaves / retryFailedSaves.
  // ---------------------------------------------------------------------------

  const enqueueSave = useCallback(
    (entry: {
      itemId: string;
      sectionId: string;
      value: number;
      data?: Record<string, unknown>;
      responseTimeMs?: number;
    }) => {
      const { sessionId } = configRef.current;
      setSaveStatus("saving");
      // Optimistically update the localResponses map so resume / merge sees
      // it immediately, without waiting for the IDB write to settle.
      setLocalResponses((prev) => ({
        ...(prev ?? {}),
        [entry.itemId]: { value: entry.value, data: entry.data ?? {} },
      }));
      void (async () => {
        try {
          await putResponse({
            sessionId,
            itemId: entry.itemId,
            sectionId: entry.sectionId,
            value: entry.value,
            data: entry.data,
            responseTimeMs: entry.responseTimeMs,
          });
          const pending = await countPending(sessionId).catch(() => 0);
          if (pending >= FLUSH_PENDING_THRESHOLD) {
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
          // IDB write failed (rare — quota exhausted, etc). Try a direct
          // network flush of just this one entry as a last-ditch fallback.
          const result = await postBatch(configRef.current.token, sessionId, [
            {
              sessionId,
              itemId: entry.itemId,
              sectionId: entry.sectionId,
              value: entry.value,
              data: entry.data ?? {},
              responseTimeMs: entry.responseTimeMs,
              idempotencyKey: `inline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              synced: 0,
              updatedAt: Date.now(),
            },
          ]);
          if (!result.ok || !result.savedItemIds?.includes(entry.itemId)) {
            setSaveError(true);
          }
        }
      })();
    },
    [scheduleFlushSoon],
  );

  /**
   * Drain everything currently pending. Used by section/assessment boundaries
   * to guarantee persistence before navigating away. Returns true if the queue
   * is empty (all synced), false if a permanent failure prevented draining.
   */
  const flushSaves = useCallback(async (): Promise<boolean> => {
    const { sessionId } = configRef.current;
    const remaining = await countPending(sessionId).catch(() => 0);
    if (remaining === 0) return true;

    return Promise.race([
      new Promise<boolean>((resolve) => {
        drainWaitersRef.current.push(resolve);
        if (flushTimerRef.current) {
          clearTimeout(flushTimerRef.current);
          flushTimerRef.current = null;
        }
        void runFlushLoopRef.current();
      }),
      delay(FLUSH_TIMEOUT_MS).then(() => false),
    ]);
  }, []);

  /** Kick the flusher manually — called from the error-banner Retry button. */
  const retryFailedSaves = useCallback(() => {
    consecutiveFailuresRef.current = 0;
    setSaveError(false);
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    void runFlushLoopRef.current();
  }, []);

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
            })),
          });
          if (typeof navigator !== "undefined" && navigator.sendBeacon) {
            const blob = new Blob([body], { type: "application/json" });
            navigator.sendBeacon("/api/assess/save-batch", blob);
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

    window.addEventListener("pagehide", onPagehide);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pageshow", onPageshow);
    window.addEventListener("online", onOnline);

    return () => {
      window.removeEventListener("pagehide", onPagehide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", onPageshow);
      window.removeEventListener("online", onOnline);
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
    /** IDB-hydrated map of responses for this session. Null until hydration completes. */
    localResponses,
  };
}
