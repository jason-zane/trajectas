"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { ProgressBar } from "./progress-bar";
import { ItemCard } from "./item-card";
import {
  updateSessionProgressLite,
  finaliseSection,
  submitSession,
} from "@/app/actions/assess";
import { checkPracticeAnswer } from "@/app/actions/assess-practice";
import { useSaveQueue } from "./use-save-queue";
import { SavingOverlay } from "./saving-overlay";
import { SectionTimer } from "./section-timer";
import {
  PracticeCheckButton,
  PracticeCheckError,
  PracticeFeedback,
} from "./practice-feedback";
import { formatAutoAdvances, formatNeedsContinue } from "./advance-policy";
import type { SectionForRunner } from "@/app/actions/assess";
import type { RunnerContent } from "@/lib/experience/types";

interface SectionWrapperProps {
  token: string;
  sessionId: string;
  sessionProof?: string;
  section: SectionForRunner;
  sectionIndex: number;
  totalSections: number;
  /** All sections' items flattened for global progress tracking. */
  allSections: SectionForRunner[];
  existingResponses: Record<
    string,
    { value: number; data: Record<string, unknown>; revision?: number }
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

/** Total item count across every section in the assessment. */
function countAllItems(sections: SectionForRunner[]): number {
  return sections.reduce((acc, s) => acc + s.items.length, 0);
}

/** Per-item practice-check state (LR-6 / #336) — keyed by item id so it
 *  survives back-navigation within a practice section. */
type PracticeCheckState =
  | { status: "unchecked" }
  | { status: "checking" }
  | { status: "checked"; correct: boolean; message?: string }
  | { status: "error"; error: string };

export function SectionWrapper({
  token,
  sessionId,
  sessionProof,
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

  const {
    enqueueSave,
    retryFailedSaves,
    flushSaves,
    saveStatus,
    saveError,
    lostSaves,
    localResponses,
  } = useSaveQueue({
    token,
    sessionId,
    sessionProof,
    initialRevisions: Object.fromEntries(Object.entries(existingResponses).map(([id, response]) => [id, response.revision ?? 0])),
  });

  // An answer the server definitively refused (it arrived after the section
  // closed, and no earlier save landed) is dropped from the retry queue so
  // the participant is never wedged behind it — but the loss must not be
  // silent. Once per increment, not per render.
  const lostAnnouncedRef = useRef(0);
  useEffect(() => {
    if (lostSaves > lostAnnouncedRef.current) {
      const delta = lostSaves - lostAnnouncedRef.current;
      lostAnnouncedRef.current = lostSaves;
      toast.error(
        delta === 1
          ? "One answer arrived after its section closed and could not be counted."
          : `${delta} answers arrived after their section closed and could not be counted.`,
      );
    }
  }, [lostSaves]);

  // Total item count across all sections — denominator for the progress bar.
  const totalItems = countAllItems(allSections);

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

  // Practice-mode answer checking (LR-6 / #336). A 'practice'-role section
  // never auto-advances and never shows ItemCard's own Continue button —
  // every item goes through Check answer -> feedback -> Continue instead,
  // via the controls rendered below (see the `isPractice` branches in the
  // render and in handleResponse/goToNextItem's neighbours).
  const isPractice = section.sectionRole === "practice";
  const [practiceChecks, setPracticeChecks] = useState<Record<string, PracticeCheckState>>({});

  // When IndexedDB-backed local responses hydrate, merge them into the
  // server-rendered snapshot. Local writes that haven't synced yet take
  // precedence — a returning participant sees every response they made,
  // even ones still pending flush from a previous session.
  const hydratedLocalRef = useRef(false);
  useEffect(() => {
    if (!localResponses || hydratedLocalRef.current) return;
    if (Object.keys(localResponses).length === 0) {
      hydratedLocalRef.current = true;
      return;
    }
    hydratedLocalRef.current = true;
    setResponses((prev) => ({ ...prev, ...localResponses }));
  }, [localResponses]);

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

  // Per-item latency capture (LR-4 / #334). itemShownAtRef marks the moment
  // the CURRENT item became visible; handleResponse below measures elapsed
  // time against it and passes it through as responseTimeMs — the field was
  // already plumbed end-to-end (use-save-queue.ts -> both save RPCs ->
  // participant_responses.response_time_ms) but nothing populated it.
  // Server-side answered_at (LR-2 / #332) is the trusted RECEIPT timestamp;
  // this is a complementary client-measured DURATION signal, not a
  // duplicate of it — see the column comments in
  // 20260813102000_cognitive_delivery_and_timing.sql.
  const itemShownAtRef = useRef<number>(
    typeof performance !== "undefined" ? performance.now() : Date.now(),
  );
  useEffect(() => {
    itemShownAtRef.current =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    // Re-arm whenever a different item becomes the visible one — including
    // revisits via Back, so time-on-item is always measured from the moment
    // THIS render of the item started, not first-ever exposure.
     
  }, [currentItem?.id]);

  const responseFormatType = section.responseFormatType;
  // Per-format advance policy lives in ./advance-policy.ts (pure, tested).
  // The one section-dependent case: a cognitive item in a section the
  // participant cannot revisit keeps the explicit tap + Continue, because
  // with no Back there is no way to undo a slipped tap on the answer grid.
  const needsContinue = formatNeedsContinue(
    responseFormatType,
    section.allowBackNav,
  );
  const isFinalItemInAssessment =
    sectionIndex === totalSections - 1 &&
    localItemIndex === section.items.length - 1;
  const hasCurrentResponse =
    currentItem != null && responses[currentItem.id] !== undefined;
  const currentPracticeCheck: PracticeCheckState =
    isPractice && currentItem
      ? practiceChecks[currentItem.id] ?? { status: "unchecked" }
      : { status: "unchecked" };
  // Continue is only for multi-step formats (free_text, ranking) where the
  // user composes a response over several interactions and needs an explicit
  // commit — plus a cognitive item in a locked section (above). Auto-advance
  // formats (likert, binary, sjt, forced_choice, cognitive) never
  // show Continue — they advance to the next *unanswered* item on click, so
  // a returning participant naturally skips past items they've already
  // answered without re-clicking and without a flashing button. Practice
  // items are the third case: ItemCard never renders its own Continue for
  // them (see showContinue below) — the Check-answer/feedback controls
  // rendered alongside it own the Continue affordance instead.
  const showManualAdvanceButton =
    !isPractice && hasCurrentResponse && needsContinue;
  const manualAdvanceLabel = isFinalItemInAssessment
    ? isBoundaryPending
      ? "Completing assessment..."
      : getAssessmentBoundaryActionLabel(postAssessmentUrl)
    : runnerContent?.continueButtonLabel ?? "Continue";

  // Progress bar shows percentage of items actually completed across the whole
  // assessment, not the current position. Means the bar reflects how much you
  // have left to do — not how far you happen to have walked. Skip-mode on
  // resume can jump localItemIndex forward by a lot; an honest "% answered"
  // is the right signal for a participant.
  const completedCount = allSections.reduce(
    (acc, s) =>
      acc + s.items.filter((it) => responses[it.id] !== undefined).length,
    0,
  );

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

      let saved = await flushSaves();
      if (!saved) {
        // Transient failures (e.g. 429 rate-limit) may have resolved — auto-retry
        // failed saves once before blocking the participant.
        retryFailedSaves();
        saved = await flushSaves();
      }
      if (!saved) {
        boundaryLockRef.current = false;
        setIsBoundaryPending(false);
        return;
      }

      router.push(href);
    },
    [flushProgress, flushSaves, retryFailedSaves, router, section.id],
  );

  // Fired once by SectionTimer when the server-issued deadline is reached
  // (LR-2 / #332). finaliseSection re-validates the deadline server-side —
  // a tampered client cannot end a timed section early by firing this early.
  // Flush first so any answer already in flight gets its best chance to
  // land inside the RPC's own grace window before the section locks.
  const expiryHandledRef = useRef(false);
  const handleExpiry = useCallback(async () => {
    if (expiryHandledRef.current) return;
    expiryHandledRef.current = true;
    setIsBoundaryPending(true);

    await flushSaves().catch(() => {});
    await finaliseSection(token, sessionId, section.id, "client_timer").catch(() => {});

    if (sectionIndex === totalSections - 1) {
      // Last section of the assessment: hand off to the normal submit path.
      // The completeness gate now excludes this section's unanswered items
      // (they're in an expired section), so a timed-out participant can
      // still complete instead of being stuck forever on incomplete_submission.
      const result = await submitSession(token, sessionId);
      if (result.ok) {
        const destination = result.refreshedAccessToken
          ? postAssessmentUrl.replace(`/assess/${token}`, `/assess/${result.refreshedAccessToken}`)
          : postAssessmentUrl;
        router.push(destination);
        return;
      }
      setIsBoundaryPending(false);
      return;
    }

    setIsBoundaryPending(false);
    router.push(`/assess/${token}/section/${sectionIndex + 1}`);
  }, [flushSaves, token, sessionId, section.id, sectionIndex, totalSections, router, postAssessmentUrl]);

  // If every item in this section is already answered (either from a
  // server-rendered snapshot or after IDB hydration merges in unsynced
  // local rows), push straight through to the next section / completion.
  // Means a returning participant who finished this section in a previous
  // sitting never lands on it — they keep moving.
  //
  // Skipped entirely for practice sections (LR-6 / #336): `responses` flips
  // to "all answered" the instant the LAST item gets a selection — before
  // its Check-answer/feedback step ever runs — so this effect would fire
  // mid-walkthrough and race the participant straight past their own
  // feedback on the final practice item. Practice sections cross the
  // section boundary through the explicit path instead: goToNextItem's own
  // "no more unanswered items in this section" branch (below) already
  // calls pushAcrossBoundary, and that only runs from a practice item's
  // Continue click, after feedback has been shown. The cost is a resume
  // edge case (a participant who navigates back into an already-fully-
  // checked practice section must click through it again instead of being
  // auto-skipped) — no data loss, no dead end, just a few extra clicks.
  const autoSkipFiredRef = useRef(false);
  useEffect(() => {
    if (autoSkipFiredRef.current || section.items.length === 0 || isPractice) return;
    const allAnswered = section.items.every(
      (it) => responses[it.id] !== undefined,
    );
    if (!allAnswered) return;
    autoSkipFiredRef.current = true;
    if (sectionIndex < totalSections - 1) {
      void pushAcrossBoundary(
        `/assess/${token}/section/${sectionIndex + 1}`,
        section.items.length - 1,
      );
    } else {
      void pushAcrossBoundary(postAssessmentUrl, section.items.length - 1);
    }
  }, [
    section.items,
    responses,
    isPractice,
    sectionIndex,
    totalSections,
    token,
    postAssessmentUrl,
    pushAcrossBoundary,
  ]);

  // For forced_choice, auto-advance only after both most+least are selected
  // For SJT, auto-advance only if single-select mode
  // Everything else (incl. cognitive's back-nav coupling) is the format-level
  // policy in ./advance-policy.ts.
  const shouldAutoAdvance = useCallback(
    (formatType: string, _value: number, data?: Record<string, unknown>) => {
      if (formatType === "forced_choice") {
        return data?.mostLike !== undefined && data?.leastLike !== undefined;
      }
      if (formatType === "sjt") {
        // SJT auto-advances on single select
        return true;
      }
      return formatAutoAdvances(formatType, section.allowBackNav);
    },
    [section.allowBackNav]
  );

  const navigateToItem = useCallback(
    (newLocalIdx: number, direction: "left" | "right") => {
      void direction;
      if (navLockRef.current) return;
      navLockRef.current = true;
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
    // Skip-mode: jump to the next item without a response rather than the
    // next sequential one. On a fresh forward run with no gaps this is
    // identical to localItemIndex + 1; on resume, it walks the participant
    // through only the items they still need to answer.
    let nextIdx = -1;
    for (let i = localItemIndex + 1; i < section.items.length; i++) {
      if (responses[section.items[i].id] === undefined) {
        nextIdx = i;
        break;
      }
    }

    if (nextIdx >= 0) {
      navigateToItem(nextIdx, "left");
      scheduleProgressUpdate(section.id, nextIdx);
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
    section.items,
    section.id,
    sectionIndex,
    totalSections,
    token,
    postAssessmentUrl,
    navigateToItem,
    pushAcrossBoundary,
    responses,
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
    // 1. Optimistic local update (instant — selection highlights immediately).
    setResponses((prev) => ({
      ...prev,
      [itemId]: { value, data: data ?? {} },
    }));

    // Practice items: a (re)selection invalidates any previous check result
    // for this item — the participant must explicitly Check answer again
    // before Continue reappears. Matters most on revision (Back into an
    // earlier practice item, pick a different option).
    if (isPractice) {
      setPracticeChecks((prev) => ({ ...prev, [itemId]: { status: "unchecked" } }));
    }

    // 2. Fire-and-forget save. The queue handles ordering, retry, and the
    //    section-boundary flush guarantees persistence before navigation.
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const responseTimeMs = Math.max(0, Math.round(now - itemShownAtRef.current));
    enqueueSave({ itemId, sectionId: section.id, value, data, responseTimeMs });

    // 3. Auto-advance for single-select formats. We advance immediately — the
    //    selected button has already highlighted via its own CSS, so no extra
    //    pre-fade delay is needed. The navigateToItem crossfade provides the
    //    transition feedback. Never for practice items — Check
    //    answer/feedback/Continue (rendered below) owns advancing instead.
    if (
      !isPractice &&
      !isFinalItemInAssessment &&
      shouldAutoAdvance(responseFormatType, value, data)
    ) {
      goToNextItem();
    }
  }

  /**
   * Practice-mode answer check (LR-6 / #336). Resolves the selected value
   * back to its option id (options are already part of the delivered,
   * key-free item payload) and calls the server action, which is the only
   * place that ever consults the answer key. Never receives or stores the
   * correct option id itself — only the derived `correct`/`message` result.
   */
  const handleCheckPracticeAnswer = useCallback(async () => {
    if (!currentItem) return;
    const response = responses[currentItem.id];
    if (!response) return;
    const option = currentItem.options.find((o) => o.value === response.value);
    if (!option) return;
    const itemId = currentItem.id;

    setPracticeChecks((prev) => ({ ...prev, [itemId]: { status: "checking" } }));
    const result = await checkPracticeAnswer(token, sessionId, itemId, option.id);

    if ("error" in result) {
      setPracticeChecks((prev) => ({
        ...prev,
        [itemId]: { status: "error", error: result.error },
      }));
      return;
    }

    setPracticeChecks((prev) => ({
      ...prev,
      [itemId]: result.correct
        ? { status: "checked", correct: true }
        : { status: "checked", correct: false, message: result.message },
    }));
  }, [currentItem, responses, token, sessionId]);

  // Enforced server-side too (save_response_for_session /
  // save_responses_batch_for_session refuse to overwrite an already-answered
  // item in a section with allow_back_nav = false) — this only controls
  // whether the control is offered.
  const canGoBack =
    section.allowBackNav !== false && (localItemIndex > 0 || sectionIndex > 0);

  // Percent complete for the header tag
  const pct = totalItems > 0 ? Math.min(100, Math.round((completedCount / totalItems) * 100)) : 0;

  const showFinaliserOverlay = isBoundaryPending && isFinalItemInAssessment;

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Progress bar */}
      {showProgress && <ProgressBar currentIndex={completedCount} totalItems={totalItems} />}

      {/* Header — logo left, section overline + % tag + back button right */}
      <header className="sticky top-[2px] z-10 flex h-auto items-center justify-between px-6 py-5 sm:px-10 lg:px-[120px]"
        style={{ background: "transparent" }}
      >
        {/* Logo left */}
        <div className="flex items-center gap-2.5">
          {brandLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- brand logo URLs are runtime-configured and can point to arbitrary remote assets
            <img
              src={brandLogoUrl}
              alt={brandName ?? "Logo"}
              className="h-6 w-auto object-contain"
            />
          ) : (
            <div className="flex items-center gap-1.5">
              <div
                className="flex size-6 items-center justify-center rounded-lg"
                style={{ background: "var(--runner-ghost-fill)" }}
              >
                <svg
                  className="size-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ color: "var(--runner-accent)" }}
                >
                  <path d="M12 2a8.5 8.5 0 0 0-8.5 8.5c0 4.5 3.5 8 8.5 11.5 5-3.5 8.5-7 8.5-11.5A8.5 8.5 0 0 0 12 2z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <span
                className="text-xs font-semibold"
                style={{ color: "var(--runner-text)" }}
              >
                {brandName ?? "Trajectas"}
              </span>
            </div>
          )}
        </div>

        {/* Right side: section + completion % + timer + back button */}
        <div className="flex items-center gap-4 sm:gap-6">
          {/* Section overline + completion % tag */}
          <div className="flex items-center gap-3">
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: "var(--runner-overline)" }}
            >
              {assessmentName}
            </p>
            {isPractice && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                style={{ background: "var(--runner-accent)", color: "var(--runner-ink)" }}
              >
                Practice
              </span>
            )}
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: "var(--runner-text-meta)" }}
            >
              {pct}% COMPLETE
            </p>
          </div>

          {/* Server-authoritative countdown — only for timed sections
              (deadlineAt is null for untimed/practice sections). */}
          {section.timing?.deadlineAt && (
            <SectionTimer
              deadlineAt={section.timing.deadlineAt}
              serverNow={section.timing.serverNow}
              onExpiry={handleExpiry}
            />
          )}

          {/* Back button — ghost text style */}
          {canGoBack && (
            <button
              onClick={goToPreviousItem}
              disabled={isBoundaryPending}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors"
              style={{
                color: "var(--runner-text-muted)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--runner-text)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--runner-text-muted)";
              }}
            >
              <ArrowLeft className="size-3.5" />
              {runnerContent?.backButtonLabel ?? "Back"}
            </button>
          )}
        </div>
      </header>

      {/* Note: progress bar moved above header */}

      {/* Save error banner */}
      {saveError && (
        <div
          className="flex items-center justify-center gap-3 px-6 py-3 text-sm border-t border-b sm:px-10 lg:px-[120px]"
          style={{
            borderColor: "var(--brand-error)",
            color: "var(--brand-error)",
            background: "rgba(var(--brand-error-rgb, 220, 38, 38), 0.05)",
          }}
        >
          <span>Some responses couldn&apos;t be saved. Check your connection.</span>
          <button
            onClick={retryFailedSaves}
            className="rounded-lg px-3 py-1 text-xs font-semibold border transition-colors"
            style={{
              borderColor: "var(--brand-error)",
              color: "var(--brand-error)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(var(--brand-error-rgb, 220, 38, 38), 0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Main content area. The column is wide enough for a 6–7 point answer
          scale to breathe; the question stem keeps its own narrower reading
          measure (max-w-[620px] in ItemCard), so the serif question stays a
          tight column while the options span the fuller width. */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12 sm:px-10 lg:px-[120px]">
        <div className="w-full max-w-[800px]">
          {/* Item card with crossfade animation */}
          <div
            className={`transition-opacity duration-150 ease-out motion-reduce:transition-none motion-reduce:!opacity-100 ${
              isAnimating ? "opacity-0" : "opacity-100"
            }`}
          >
            <ItemCard
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

            {/* Practice-mode controls (LR-6 / #336) — replace ItemCard's own
                Continue button (suppressed above via showContinue) with an
                explicit Check answer -> feedback -> Continue sequence. */}
            {isPractice &&
              hasCurrentResponse &&
              (currentPracticeCheck.status === "unchecked" ||
                currentPracticeCheck.status === "checking") && (
                <PracticeCheckButton
                  onCheck={handleCheckPracticeAnswer}
                  checking={currentPracticeCheck.status === "checking"}
                />
              )}
            {isPractice && currentPracticeCheck.status === "error" && (
              <PracticeCheckError
                message={currentPracticeCheck.error}
                onRetry={handleCheckPracticeAnswer}
              />
            )}
            {isPractice && currentPracticeCheck.status === "checked" && (
              <PracticeFeedback
                correct={currentPracticeCheck.correct}
                message={currentPracticeCheck.message}
                onContinue={goToNextItem}
                continueLabel={manualAdvanceLabel}
                continueDisabled={isBoundaryPending}
              />
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="flex items-start justify-between px-6 py-5 sm:px-10 lg:px-[120px]">
        {/* Save status (bottom-left) */}
        <div
          className="flex items-center gap-2 aria-live-container"
          aria-live="polite"
          aria-atomic="true"
        >
          <span
            className={`inline-block size-1.5 rounded-full transition-colors duration-300 ${
              saveStatus === "saving"
                ? "animate-pulse"
                : saveStatus === "saved"
                  ? ""
                  : "animate-[pulse_3s_ease-in-out_infinite]"
            }`}
            style={{
              background: "var(--runner-save-dot)",
            }}
          />
          <span
            className="text-xs font-normal"
            style={{ color: "var(--runner-text-faint)" }}
          >
            {saveStatus === "saving"
              ? (runnerContent?.saveStatusSaving ?? "Saving…")
              : saveStatus === "saved"
                ? (runnerContent?.saveStatusSaved ?? "Saved a moment ago")
                : (runnerContent?.saveStatusIdle ?? "Autosave on")}
          </span>
        </div>

        {/* Powered by (optional, bottom-right is empty per design) */}
        {isCustomBrand && (
          <span
            className="text-xs"
            style={{ color: "var(--runner-text-faint)" }}
          >
            {runnerContent?.footerText ?? "Powered by Trajectas"}
          </span>
        )}
      </footer>

      {showFinaliserOverlay && (
        <SavingOverlay
          message="Saving your responses..."
          brandLogoUrl={brandLogoUrl}
          brandName={brandName}
        />
      )}
    </div>
  );
}
