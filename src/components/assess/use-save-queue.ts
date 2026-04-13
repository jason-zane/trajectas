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
};

type SaveStatus = "idle" | "saving" | "saved";

/** Per-item save timeout before treating as a transient failure and retrying. */
const SAVE_TIMEOUT_MS = 8_000;
/** Absolute ceiling for flushSaves — prevents pushAcrossBoundary from hanging forever. */
const FLUSH_TIMEOUT_MS = 35_000;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

      const result = await Promise.race([
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

      if (result.error) {
        entry.retries = (entry.retries ?? 0) + 1;
        if (entry.retries >= 3) {
          failedRef.current.push(queueRef.current.shift()!);
          setSaveError(true);
        } else {
          await delay(500 * entry.retries);
        }
      } else {
        queueRef.current.shift();
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

  const enqueueSave = useCallback(
    (entry: Omit<SaveEntry, "retries">) => {
      queueRef.current.push({ ...entry, retries: 0 });
      setSaveStatus("saving");
      processQueue();
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

  return { enqueueSave, retryFailedSaves, flushSaves, saveStatus, saveError };
}
