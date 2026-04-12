"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ProgressBar } from "./progress-bar";
import { ItemCard } from "./item-card";
import { updateSessionProgressLite } from "@/app/actions/assess";
import { useSaveQueue } from "./use-save-queue";
import type { SectionForRunner } from "@/app/actions/assess";
import type { RunnerContent } from "@/lib/experience/types";

interface SectionWrapperProps {
  token: string;
  sessionId: string;
  section: SectionForRunner;
  sectionIndex: number;
  totalSections: number;
  /** All sections' items flattened for global progress tracking. */
  allSections: SectionForRunner[];
  existingResponses: Record<
    string,
    { value: number; data: Record<string, unknown> }
  >;
  assessmentName: string;
  /** Brand config for the assessment. */
  brandLogoUrl?: string;
  brandName?: string;
  isCustomBrand?: boolean;
  runnerContent?: RunnerContent;
  /** URL to navigate to after this assessment's last section item. */
  postAssessmentUrl: string;
  privacyUrl?: string;
  termsUrl?: string;
  /** Whether to show the progress bar. Defaults to true. */
  showProgress?: boolean;
}

/** Formats that auto-advance on selection (single-select). */
const AUTO_ADVANCE_FORMATS = new Set([
  "likert",
  "forced_choice",
  "binary",
  "sjt",
]);

/** Formats that need a Continue button (multi-step input). */
const CONTINUE_FORMATS = new Set(["free_text", "ranking"]);

/** Animation + auto-advance delay. Single source of truth. */
const ADVANCE_DELAY_MS = 120;

/** Debounce interval for session progress updates. */
const PROGRESS_DEBOUNCE_MS = 3000;

function getAssessmentBoundaryActionLabel(postAssessmentUrl: string): string {
  if (postAssessmentUrl.includes("/review")) {
    return "Review answers";
  }
  return "Complete assessment";
}

/**
 * Flatten all sections to get a global item list for navigation.
 * Returns array of { sectionIdx, itemIdx, item, section }.
 */
function flattenItems(sections: SectionForRunner[]) {
  const flat: {
    sectionIdx: number;
    itemIdx: number;
    item: SectionForRunner["items"][number];
    section: SectionForRunner;
  }[] = [];
  sections.forEach((section, sIdx) => {
    section.items.forEach((item, iIdx) => {
      flat.push({ sectionIdx: sIdx, itemIdx: iIdx, item, section });
    });
  });
  return flat;
}

export function SectionWrapper({
  token,
  sessionId,
  section,
  sectionIndex,
  totalSections,
  allSections,
  existingResponses,
  assessmentName,
  brandLogoUrl,
  brandName,
  isCustomBrand,
  runnerContent,
  postAssessmentUrl,
  privacyUrl,
  termsUrl,
  showProgress = true,
}: SectionWrapperProps) {
  const router = useRouter();
  void privacyUrl;
  void termsUrl;

  const { enqueueSave, retryFailedSaves, flushSaves, saveStatus, saveError } = useSaveQueue({
    token,
    sessionId,
  });

  // Build a flat global item list from all sections
  const globalItems = flattenItems(allSections);
  const totalItems = globalItems.length;

  // Compute the global index for the first item of this section
  const sectionStartGlobal = globalItems.findIndex(
    (g) => g.sectionIdx === sectionIndex && g.itemIdx === 0
  );

  // Find the first unanswered item in this section as the start point,
  // or resume from where we left off
  const [localItemIndex, setLocalItemIndex] = useState(() => {
    // Check URL params for resume=last (back from next section)
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("resume") === "last") {
        // Clean up URL
        window.history.replaceState({}, "", window.location.pathname);
        return section.items.length - 1;
      }
    }
    const firstUnanswered = section.items.findIndex(
      (item) => !existingResponses[item.id]
    );
    return firstUnanswered >= 0 ? firstUnanswered : 0;
  });
  const [responses, setResponses] = useState(existingResponses);
  const [slideDirection, setSlideDirection] = useState<"left" | "right">("left");
  const [isAnimating, setIsAnimating] = useState(false);
  const [isBoundaryPending, setIsBoundaryPending] = useState(false);

  const navLockRef = useRef(false);
  const boundaryLockRef = useRef(false);

  const progressTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const pendingProgressRef = useRef<{ sectionId: string; itemIndex: number } | null>(null);

  function scheduleProgressUpdate(sectionId: string, itemIndex: number) {
    pendingProgressRef.current = { sectionId, itemIndex };
    if (!progressTimerRef.current) {
      progressTimerRef.current = setTimeout(() => {
        flushProgress();
        progressTimerRef.current = null;
      }, PROGRESS_DEBOUNCE_MS);
    }
  }

  const flushProgress = useCallback(() => {
    const pending = pendingProgressRef.current;
    if (!pending) return;
    pendingProgressRef.current = null;
    // Fire-and-forget — progress is best-effort for crash recovery
    updateSessionProgressLite(token, sessionId, pending).catch(() => {});
  }, [token, sessionId]);

  useEffect(() => {
    const handler = () => {
      const pending = pendingProgressRef.current;
      if (!pending) return;
      pendingProgressRef.current = null;
      navigator.sendBeacon(
        "/api/assess/progress",
        JSON.stringify({ token, sessionId, ...pending }),
      );
    };
    window.addEventListener("beforeunload", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
      flushProgress();
    };
  }, [flushProgress, sessionId, token]);

  const currentItem = section.items[localItemIndex];
  const globalIndex = sectionStartGlobal + localItemIndex;
  const responseFormatType = section.responseFormatType;
  const needsContinue = CONTINUE_FORMATS.has(responseFormatType);
  const isFinalItemInAssessment =
    sectionIndex === totalSections - 1 &&
    localItemIndex === section.items.length - 1;
  const hasCurrentResponse =
    currentItem != null && responses[currentItem.id] !== undefined;
  const showManualAdvanceButton =
    hasCurrentResponse && (needsContinue || isFinalItemInAssessment);
  const manualAdvanceLabel = isFinalItemInAssessment
    ? isBoundaryPending
      ? "Completing assessment..."
      : getAssessmentBoundaryActionLabel(postAssessmentUrl)
    : runnerContent?.continueButtonLabel ?? "Continue";

  const pushAcrossBoundary = useCallback(
    async (href: string, progressItemIndex: number) => {
      if (boundaryLockRef.current) return;
      boundaryLockRef.current = true;
      setIsBoundaryPending(true);
      pendingProgressRef.current = {
        sectionId: section.id,
        itemIndex: progressItemIndex,
      };
      flushProgress();

      const saved = await flushSaves();
      if (!saved) {
        boundaryLockRef.current = false;
        setIsBoundaryPending(false);
        return;
      }

      router.push(href);
    },
    [flushProgress, flushSaves, router, section.id],
  );

  // For forced_choice, auto-advance only after both most+least are selected
  // For SJT, auto-advance only if single-select mode
  const shouldAutoAdvance = useCallback(
    (formatType: string, _value: number, data?: Record<string, unknown>) => {
      if (formatType === "forced_choice") {
        return data?.mostLike !== undefined && data?.leastLike !== undefined;
      }
      if (formatType === "sjt") {
        // SJT auto-advances on single select
        return true;
      }
      return AUTO_ADVANCE_FORMATS.has(formatType);
    },
    []
  );

  const navigateToItem = useCallback(
    (newLocalIdx: number, direction: "left" | "right") => {
      if (navLockRef.current) return;
      navLockRef.current = true;
      setSlideDirection(direction);
      setIsAnimating(true);

      setTimeout(() => {
        setLocalItemIndex(newLocalIdx);
        setIsAnimating(false);
        navLockRef.current = false;
      }, ADVANCE_DELAY_MS);
    },
    [],
  );

  const goToNextItem = useCallback(() => {
    if (localItemIndex < section.items.length - 1) {
      navigateToItem(localItemIndex + 1, "left");
      scheduleProgressUpdate(section.id, localItemIndex + 1);
    } else if (sectionIndex < totalSections - 1) {
      void pushAcrossBoundary(
        `/assess/${token}/section/${sectionIndex + 1}`,
        localItemIndex,
      );
    } else {
      void pushAcrossBoundary(postAssessmentUrl, localItemIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    localItemIndex,
    section.items.length,
    section.id,
    sectionIndex,
    totalSections,
    token,
    postAssessmentUrl,
    navigateToItem,
    pushAcrossBoundary,
  ]);

  const goToPreviousItem = useCallback(() => {
    if (localItemIndex > 0) {
      navigateToItem(localItemIndex - 1, "right");
    } else if (sectionIndex > 0) {
      // Go to previous section's last item
      void pushAcrossBoundary(
        `/assess/${token}/section/${sectionIndex - 1}?resume=last`,
        localItemIndex,
      );
    }
  }, [localItemIndex, sectionIndex, token, navigateToItem, pushAcrossBoundary]);

  function handleResponse(
    itemId: string,
    value: number,
    data?: Record<string, unknown>,
  ) {
    // 1. Optimistic local update (instant)
    setResponses((prev) => ({
      ...prev,
      [itemId]: { value, data: data ?? {} },
    }));

    // 2. Queue background save (non-blocking)
    enqueueSave({ itemId, sectionId: section.id, value, data });

    // 3. Auto-advance for single-select formats
    if (!isFinalItemInAssessment && shouldAutoAdvance(responseFormatType, value, data)) {
      setTimeout(() => {
        void goToNextItem();
      }, ADVANCE_DELAY_MS);
    }
  }

  const canGoBack = localItemIndex > 0 || sectionIndex > 0;

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between px-4 sm:px-6"
        style={{ background: "var(--brand-neutral-50, hsl(var(--background)))" }}
      >
        <div className="flex items-center gap-2.5">
          {brandLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- brand logo URLs are runtime-configured and can point to arbitrary remote assets
            <img
              src={brandLogoUrl}
              alt={brandName ?? "Logo"}
              className="h-7 w-auto object-contain"
            />
          ) : (
            <div className="flex items-center gap-2">
              <div
                className="flex size-7 items-center justify-center rounded-lg"
                style={{ background: "var(--brand-surface, hsl(var(--primary) / 0.1))" }}
              >
                <svg
                  className="size-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ color: "var(--brand-primary, hsl(var(--primary)))" }}
                >
                  <path d="M12 2a8.5 8.5 0 0 0-8.5 8.5c0 4.5 3.5 8 8.5 11.5 5-3.5 8.5-7 8.5-11.5A8.5 8.5 0 0 0 12 2z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <span
                className="text-sm font-semibold tracking-tight"
                style={{ color: "var(--brand-text, hsl(var(--foreground)))" }}
              >
                {brandName ?? "Trajectas"}
              </span>
            </div>
          )}
        </div>

        {canGoBack && (
          <button
            onClick={goToPreviousItem}
            disabled={isBoundaryPending}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            style={{ color: "var(--brand-text-muted, hsl(var(--muted-foreground)))" }}
          >
            <ArrowLeft className="size-3.5" />
            {runnerContent?.backButtonLabel ?? "Back"}
          </button>
        )}
      </header>

      {/* Save error banner */}
      {saveError && (
        <div
          className="flex items-center justify-center gap-3 px-4 py-2.5 text-sm"
          style={{
            background: "var(--brand-error-surface, hsl(var(--destructive) / 0.1))",
            color: "var(--brand-error, hsl(var(--destructive)))",
          }}
        >
          <span>Some responses couldn&apos;t be saved. Check your connection.</span>
          <button
            onClick={retryFailedSaves}
            className="rounded-md px-3 py-1 text-xs font-semibold underline underline-offset-2"
          >
            Retry
          </button>
        </div>
      )}

      {/* Progress bar */}
      {showProgress && <ProgressBar currentIndex={globalIndex} totalItems={totalItems} />}

      {/* Main content area */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-[560px] lg:max-w-[720px] xl:max-w-[820px]">
          {/* Assessment name label */}
          <p
            className="mb-4 text-xs font-medium uppercase tracking-widest"
            style={{ color: "var(--brand-primary, hsl(var(--primary)))" }}
          >
            {assessmentName}
          </p>

          {/* Item card with slide animation */}
          <div
            className={`transition-all duration-200 ease-out ${
              isAnimating
                ? slideDirection === "left"
                  ? "translate-x-[-8px] opacity-0"
                  : "translate-x-[8px] opacity-0"
                : "translate-x-0 opacity-100"
            }`}
          >
            <ItemCard
              key={currentItem?.id}
              item={currentItem}
              responseFormatType={responseFormatType}
              selectedValue={responses[currentItem?.id]?.value}
              responseData={responses[currentItem?.id]?.data}
              onResponse={(value, data) =>
                handleResponse(currentItem.id, value, data)
              }
              onContinue={goToNextItem}
              showContinue={showManualAdvanceButton}
              continueButtonLabel={manualAdvanceLabel}
              continueButtonDisabled={isBoundaryPending}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-center gap-2 px-4 py-4">
        <span
          className={`inline-block size-1.5 rounded-full transition-colors duration-300 ${
            saveStatus === "saving"
              ? "animate-pulse bg-amber-400"
              : saveStatus === "saved"
                ? "bg-emerald-400"
                : "bg-emerald-400/60 animate-[pulse_3s_ease-in-out_infinite]"
          }`}
        />
        <span
          className="text-xs"
          style={{ color: "var(--brand-neutral-500, hsl(var(--muted-foreground)))" }}
        >
          {saveStatus === "saving"
            ? (runnerContent?.saveStatusSaving ?? "Saving...")
            : saveStatus === "saved"
              ? (runnerContent?.saveStatusSaved ?? "Saved")
              : (runnerContent?.saveStatusIdle ?? "Responses saved automatically")}
        </span>
        {isCustomBrand && (
          <span
            className="ml-4 text-xs"
            style={{ color: "var(--brand-neutral-400, hsl(var(--muted-foreground)))" }}
          >
            {runnerContent?.footerText ?? "Powered by Trajectas"}
          </span>
        )}
      </footer>
    </div>
  );
}
