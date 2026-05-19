"use client";

import { useRef, useState, useCallback } from "react";

type SaveEntry = {
  itemId: string;
  sectionId: string;
  value: number;
  data?: Record<string, unknown>;
  responseTimeMs?: number;
  retries?: number;
  /** Epoch ms — entry is not eligible to fire before this time (retry backoff). */
  notBefore?: number;
  /** Called when this specific entry finishes processing (success or permanent failure). */
  onSettled?: (ok: boolean) => void;
};

type SaveStatus = "idle" | "saving" | "saved";

/** Number of saves that may be in flight concurrently. */
const CONCURRENCY = 4;
/** Per-item save timeout before treating as a transient failure and retrying. */
const SAVE_TIMEOUT_MS = 10_000;
/** Absolute ceiling for flushSaves — prevents pushAcrossBoundary from hanging forever. */
const FLUSH_TIMEOUT_MS = 45_000;
/** Maximum retry attempts per save before moving to failed list. */
const MAX_RETRIES = 5;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Exponential backoff with jitter: 1s, 2s, 4s, 8s… capped at 10s. Returns
 *  an integer ms so setTimeout and the notBefore-vs-Date.now() comparison
 *  agree (setTimeout rounds fractional ms down, but the comparison would
 *  otherwise see notBefore=t+0.03ms in the future when the timer fires). */
function retryDelay(attempt: number) {
  const base = Math.min(1000 * Math.pow(2, attempt - 1), 10_000);
  const jitter = Math.random() * base * 0.3;
  return Math.ceil(base + jitter);
}

function chainSettled(
  prev: SaveEntry["onSettled"],
  next: SaveEntry["onSettled"],
): SaveEntry["onSettled"] {
  if (!prev) return next;
  if (!next) return prev;
  return (ok: boolean) => {
    prev(ok);
    next(ok);
  };
}

async function postSave(
  config: { token: string; sessionId: string },
  entry: SaveEntry,
): Promise<{ success?: true; error?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SAVE_TIMEOUT_MS);
  try {
    // Look up fetch via globalThis so test stubs (vi.stubGlobal) bind correctly.
    const res = await globalThis.fetch("/api/assess/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: config.token,
        sessionId: config.sessionId,
        itemId: entry.itemId,
        sectionId: entry.sectionId,
        responseValue: entry.value,
        responseData: entry.data,
        responseTimeMs: entry.responseTimeMs,
      }),
      // keepalive lets the request survive a tab close mid-flight,
      // up to a small body-size limit (well within ours).
      keepalive: true,
      signal: controller.signal,
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { error: "Save timed out" };
    }
    return {
      error: error instanceof Error ? error.message : "fetch failed",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export function useSaveQueue(config: { token: string; sessionId: string }) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState(false);

  const queueRef = useRef<SaveEntry[]>([]);
  const failedRef = useRef<SaveEntry[]>([]);
  /** itemIds currently in flight OR pending retry — used for same-itemId serialisation. */
  const inFlightItemIdsRef = useRef<Set<string>>(new Set());
  /** Number of fetches currently outstanding — caps concurrency. */
  const inFlightCountRef = useRef(0);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const drainWaitersRef = useRef<Array<(ok: boolean) => void>>([]);

  const configRef = useRef(config);
  configRef.current = config;

  const notifyIdleIfDrained = useCallback(() => {
    if (
      queueRef.current.length === 0 &&
      inFlightCountRef.current === 0
    ) {
      const ok = failedRef.current.length === 0;
      if (ok) {
        setSaveStatus("saved");
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
      }
      const waiters = drainWaitersRef.current.splice(0);
      for (const resolve of waiters) {
        resolve(ok);
      }
    }
  }, []);

  const processQueue = useCallback(() => {
    const now = Date.now();
    while (inFlightCountRef.current < CONCURRENCY) {
      // Pick the first entry whose itemId isn't already in flight AND whose
      // retry-backoff (if any) has elapsed.
      const idx = queueRef.current.findIndex(
        (e) =>
          !inFlightItemIdsRef.current.has(e.itemId) &&
          (!e.notBefore || e.notBefore <= now),
      );
      if (idx < 0) break;

      const entry = queueRef.current.splice(idx, 1)[0];
      inFlightItemIdsRef.current.add(entry.itemId);
      inFlightCountRef.current++;
      setSaveStatus("saving");

      void (async () => {
        const result = await postSave(configRef.current, entry);
        inFlightCountRef.current--;
        inFlightItemIdsRef.current.delete(entry.itemId);

        if (result.error) {
          entry.retries = (entry.retries ?? 0) + 1;
          if (entry.retries >= MAX_RETRIES) {
            failedRef.current.push(entry);
            entry.onSettled?.(false);
            setSaveError(true);
          } else {
            // Re-queue with a notBefore guard. Keep the entry in the queue
            // (rather than scheduling a separate retry timer) so a fresh
            // enqueueSave for the same itemId can dedup-replace it cleanly.
            const backoff = retryDelay(entry.retries);
            entry.notBefore = Date.now() + backoff;
            queueRef.current.push(entry);
            setTimeout(() => {
              processQueue();
              notifyIdleIfDrained();
            }, backoff);
          }
        } else {
          entry.onSettled?.(true);
        }

        processQueue();
        notifyIdleIfDrained();
      })();
    }
  }, [notifyIdleIfDrained]);

  /**
   * Enqueue a save (fire-and-forget). Deduplicates by itemId — if a pending
   * entry for the same item exists (queued or in retry-backoff), it is
   * replaced with the new value. Any chained settle callback on the old
   * entry is preserved so waiters resolve based on the latest value's
   * actual persistence outcome.
   */
  const enqueueSave = useCallback(
    (entry: Omit<SaveEntry, "retries" | "notBefore" | "onSettled">) => {
      const existingIdx = queueRef.current.findIndex(
        (e) => e.itemId === entry.itemId,
      );
      if (existingIdx >= 0) {
        const old = queueRef.current[existingIdx];
        queueRef.current[existingIdx] = {
          ...entry,
          retries: 0,
          notBefore: undefined,
          onSettled: old.onSettled,
        };
      } else {
        queueRef.current.push({ ...entry, retries: 0 });
      }

      setSaveStatus("saving");
      processQueue();
    },
    [processQueue],
  );

  /**
   * Enqueue a save and return a promise that resolves when this specific
   * entry is persisted (true) or permanently fails (false). Deduplicates
   * by itemId — when superseded, the waiter is chained to the latest entry
   * so it resolves on the actual outcome of the most recent value.
   */
  const enqueueSaveAndWait = useCallback(
    (
      entry: Omit<SaveEntry, "retries" | "notBefore" | "onSettled">,
    ): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        const existingIdx = queueRef.current.findIndex(
          (e) => e.itemId === entry.itemId,
        );
        if (existingIdx >= 0) {
          const old = queueRef.current[existingIdx];
          queueRef.current[existingIdx] = {
            ...entry,
            retries: 0,
            notBefore: undefined,
            onSettled: chainSettled(old.onSettled, resolve),
          };
        } else {
          queueRef.current.push({ ...entry, retries: 0, onSettled: resolve });
        }

        setSaveStatus("saving");
        processQueue();
      });
    },
    [processQueue],
  );

  const retryFailedSaves = useCallback(() => {
    const failed = failedRef.current.splice(0);
    for (const entry of failed) {
      entry.retries = 0;
      entry.notBefore = undefined;
      queueRef.current.push(entry);
    }
    setSaveError(false);
    processQueue();
  }, [processQueue]);

  const flushSaves = useCallback(async () => {
    if (
      queueRef.current.length === 0 &&
      inFlightCountRef.current === 0
    ) {
      return failedRef.current.length === 0;
    }

    return Promise.race([
      new Promise<boolean>((resolve) => {
        drainWaitersRef.current.push(resolve);
        processQueue();
      }),
      delay(FLUSH_TIMEOUT_MS).then(() => false),
    ]);
  }, [processQueue]);

  return {
    enqueueSave,
    enqueueSaveAndWait,
    retryFailedSaves,
    flushSaves,
    saveStatus,
    saveError,
  };
}
