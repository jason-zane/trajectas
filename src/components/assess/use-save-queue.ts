"use client";

import { useRef, useState, useCallback } from "react";
import { saveResponseLite } from "@/app/actions/assess";

type SaveEntry = {
  itemId: string;
  sectionId: string;
  value: number;
  data?: Record<string, unknown>;
  responseTimeMs?: number;
  retries?: number;
  /** Called when this specific entry finishes processing (success or permanent failure). */
  onSettled?: (ok: boolean) => void;
};

type SaveStatus = "idle" | "saving" | "saved";

/** Per-item save timeout before treating as a transient failure and retrying. */
const SAVE_TIMEOUT_MS = 10_000;
/** Absolute ceiling for flushSaves — prevents pushAcrossBoundary from hanging forever. */
const FLUSH_TIMEOUT_MS = 45_000;
/** Maximum retry attempts per save before moving to failed list. */
const MAX_RETRIES = 5;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Exponential backoff with jitter: 1s, 2s, 4s, 8s… capped at 10s. */
function retryDelay(attempt: number) {
  const base = Math.min(1000 * Math.pow(2, attempt - 1), 10_000);
  const jitter = Math.random() * base * 0.3; // ±30% jitter
  return base + jitter;
}

export function useSaveQueue(config: { token: string; sessionId: string }) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState(false);

  const queueRef = useRef<SaveEntry[]>([]);
  const failedRef = useRef<SaveEntry[]>([]);
  const isProcessingRef = useRef(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const drainWaitersRef = useRef<Array<(ok: boolean) => void>>([]);

  const processQueue = useCallback(async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    setSaveStatus("saving");

    while (queueRef.current.length > 0) {
      const entry = queueRef.current[0];

      let result: { error?: string; success?: true };
      try {
        result = await Promise.race([
          saveResponseLite({
            token: config.token,
            sessionId: config.sessionId,
            itemId: entry.itemId,
            sectionId: entry.sectionId,
            responseValue: entry.value,
            responseData: entry.data,
            responseTimeMs: entry.responseTimeMs,
          }),
          delay(SAVE_TIMEOUT_MS).then(() => ({ error: "Save timed out" as const })),
        ]);
      } catch {
        // Server action threw (e.g. 429 rate-limit, network error).
        // Treat identically to a returned error so the retry logic handles it.
        result = { error: "Server action failed" };
      }

      if (result.error) {
        entry.retries = (entry.retries ?? 0) + 1;
        if (entry.retries >= MAX_RETRIES) {
          const failed = queueRef.current.shift()!;
          failedRef.current.push(failed);
          failed.onSettled?.(false);
          setSaveError(true);
        } else {
          await delay(retryDelay(entry.retries));
        }
      } else {
        const done = queueRef.current.shift()!;
        done.onSettled?.(true);
      }
    }

    isProcessingRef.current = false;
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
  }, [config.token, config.sessionId]);

  /**
   * Enqueue a save (fire-and-forget). Deduplicates by itemId — if a pending
   * entry for the same item exists and hasn't started processing yet, it is
   * replaced with the new value.
   */
  const enqueueSave = useCallback(
    (entry: Omit<SaveEntry, "retries" | "onSettled">) => {
      // Deduplicate: replace any pending (not-yet-processing) entry for same item.
      // The first entry in the queue may be mid-flight, so skip index 0 when processing.
      const startIdx = isProcessingRef.current ? 1 : 0;
      const existingIdx = queueRef.current.findIndex(
        (e, i) => i >= startIdx && e.itemId === entry.itemId,
      );
      if (existingIdx >= 0) {
        const old = queueRef.current[existingIdx];
        old.onSettled?.(true); // resolve the old waiter as superseded
        queueRef.current[existingIdx] = { ...entry, retries: 0 };
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
   * entry is persisted (true) or permanently fails (false).
   * Deduplicates by itemId like enqueueSave.
   */
  const enqueueSaveAndWait = useCallback(
    (entry: Omit<SaveEntry, "retries" | "onSettled">): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        // Deduplicate: replace any pending entry for same item.
        const startIdx = isProcessingRef.current ? 1 : 0;
        const existingIdx = queueRef.current.findIndex(
          (e, i) => i >= startIdx && e.itemId === entry.itemId,
        );
        if (existingIdx >= 0) {
          const old = queueRef.current[existingIdx];
          old.onSettled?.(true); // resolve old waiter as superseded
          queueRef.current[existingIdx] = { ...entry, retries: 0, onSettled: resolve };
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
      queueRef.current.push(entry);
    }
    setSaveError(false);
    processQueue();
  }, [processQueue]);

  const flushSaves = useCallback(async () => {
    if (!isProcessingRef.current && queueRef.current.length === 0) {
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

  return { enqueueSave, enqueueSaveAndWait, retryFailedSaves, flushSaves, saveStatus, saveError };
}
