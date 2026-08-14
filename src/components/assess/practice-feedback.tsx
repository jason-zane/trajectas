"use client";

import { ArrowRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Practice-mode feedback controls (LR-6 / #336). Renders in place of
 * ItemCard's own Continue button for items in a 'practice'-role section —
 * see section-wrapper.tsx, which never passes `showContinue` to ItemCard
 * for a practice item.
 *
 * Part of the runner's data/display path — listed in
 * tests/architecture/answer-key-isolation.test.ts's RUNNER_PATH_FILES. Its
 * props are exactly `{ correct: boolean; message?: string }` (the
 * PracticeAnswerCheck shape returned by src/app/actions/assess-practice.ts)
 * — never an option id, an answer key, or anything that names one.
 */

/** "Check answer" — shown once a practice item has a selected response and
 *  hasn't been checked yet (or is mid-check). */
export function PracticeCheckButton({
  onCheck,
  checking,
}: {
  onCheck: () => void;
  checking: boolean;
}) {
  return (
    <div className="mt-8 flex flex-col items-start gap-2">
      <Button
        onClick={onCheck}
        disabled={checking}
        className="gap-1.5 rounded-[10px] px-7 py-3 text-[14.5px] font-semibold"
        style={{
          background: "var(--runner-cta-fill)",
          color: "var(--runner-cta-text)",
        }}
      >
        {checking ? "Checking…" : "Check answer"}
      </Button>
    </div>
  );
}

/** Inline error for a failed check call (network/auth issue) — offers a retry
 *  via the same "Check answer" affordance rather than dead-ending the item. */
export function PracticeCheckError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="mt-8 flex flex-col items-start gap-3">
      <p className="text-sm" style={{ color: "var(--brand-error, #dc2626)" }}>
        {message}
      </p>
      <Button
        onClick={onRetry}
        variant="outline"
        className="gap-1.5 rounded-[10px] px-6 py-2.5 text-[13.5px] font-semibold"
      >
        Try again
      </Button>
    </div>
  );
}

/** Correct/incorrect result + explanatory message (incorrect only) + the
 *  Continue control that actually advances past this item. */
export function PracticeFeedback({
  correct,
  message,
  onContinue,
  continueLabel,
  continueDisabled,
}: {
  correct: boolean;
  message?: string;
  onContinue: () => void;
  continueLabel: string;
  continueDisabled?: boolean;
}) {
  const accent = correct ? "var(--brand-success, #16a34a)" : "var(--brand-error, #dc2626)";
  const accentTint = correct
    ? "rgba(var(--brand-success-rgb, 22, 163, 74), 0.08)"
    : "rgba(var(--brand-error-rgb, 220, 38, 38), 0.08)";

  return (
    <div className="mt-8 flex flex-col items-start gap-4">
      <div
        role="status"
        aria-live="polite"
        className="flex w-full max-w-[520px] items-start gap-3 rounded-xl border px-4 py-3.5"
        style={{ borderColor: accent, background: accentTint }}
      >
        {correct ? (
          <Check className="mt-0.5 size-4 shrink-0" style={{ color: accent }} />
        ) : (
          <X className="mt-0.5 size-4 shrink-0" style={{ color: accent }} />
        )}
        <div className="space-y-1">
          <p className="text-sm font-semibold" style={{ color: accent }}>
            {correct ? "Correct" : "Not quite"}
          </p>
          {!correct && message && (
            <p className="text-sm font-normal" style={{ color: "var(--runner-text-muted)" }}>
              {message}
            </p>
          )}
        </div>
      </div>

      <Button
        onClick={onContinue}
        disabled={continueDisabled}
        className="gap-1.5 rounded-[10px] px-7 py-3 text-[14.5px] font-semibold"
        style={{
          background: "var(--runner-cta-fill)",
          color: "var(--runner-cta-text)",
        }}
      >
        {continueLabel}
        <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}
