"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertCircle, Send, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitSession } from "@/app/actions/assess";
import { SavingOverlay } from "./saving-overlay";
import type { SectionForRunner } from "@/app/actions/assess";
import type { ReviewContent } from "@/lib/experience/types";

interface ReviewScreenProps {
  token: string;
  sessionId: string;
  sections: SectionForRunner[];
  responses: Record<string, { value: number; data: Record<string, unknown> }>;
  assessmentName?: string;
  brandLogoUrl?: string;
  brandName?: string;
  isCustomBrand?: boolean;
  content: ReviewContent;
  nextUrl: string;
  privacyUrl?: string;
  termsUrl?: string;
}

/** Default section titles that are admin-side placeholders and should not be shown to participants. */
const DEFAULT_SECTION_TITLES = new Set([
  "Self-Report Questionnaire",
  "Quick Checks",
  "Situational Judgement",
  "Forced Choice",
  "Open Response",
  "Section",
]);

function isDefaultTitle(title: string | undefined): boolean {
  if (!title) return true;
  return DEFAULT_SECTION_TITLES.has(title.trim());
}

export function ReviewScreen({
  token,
  sessionId,
  sections,
  responses,
  assessmentName,
  brandLogoUrl,
  brandName,
  isCustomBrand,
  content,
  nextUrl,
  privacyUrl,
  termsUrl,
}: ReviewScreenProps) {
  const router = useRouter();
  const [submitStage, setSubmitStage] = useState<
    "idle" | "submitting" | "preparing_report"
  >("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitting = submitStage !== "idle";

  // Dedupe items by id across sections — defensive against historical duplicate-section
  // data and also the correct way to count "unique questions asked".
  const uniqueItemIds = new Set<string>();
  for (const s of sections) {
    for (const item of s.items) uniqueItemIds.add(item.id);
  }
  const uniqueTotalItems = uniqueItemIds.size;
  const uniqueAnsweredCount = Array.from(uniqueItemIds).filter(
    (id) => responses[id] !== undefined,
  ).length;

  // Show per-section breakdown only when there are ≥2 sections AND at least one
  // has a non-default, custom title. Otherwise it's noise.
  const hasMeaningfulSectionTitles =
    sections.length >= 2 &&
    sections.some((s) => !isDefaultTitle(s.title));

  const allAnswered = uniqueAnsweredCount >= uniqueTotalItems;

  async function handleSubmit() {
    setSubmitError(null);
    setSubmitStage("submitting");
    try {
      const result = await submitSession(token, sessionId);
      if (!result.ok) {
        setSubmitError(result.message);
        setSubmitStage("idle");
        return;
      }

      if (result.outcome === "report_pending") {
        setSubmitStage("preparing_report");
      }

      router.push(nextUrl);
    } catch {
      setSubmitError(
        "We couldn't submit your assessment right now. Please try again.",
      );
      setSubmitStage("idle");
    }
  }

  const submitButtonLabel =
    submitStage === "preparing_report"
      ? "Opening your report..."
      : submitStage === "submitting"
        ? "Finishing assessment..."
        : content.buttonLabel;

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Header */}
      <header
        className="sticky top-0 z-10 flex h-14 items-center justify-between px-4 sm:px-6"
        style={{
          background: "var(--brand-neutral-50, hsl(var(--background)))",
        }}
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
                style={{
                  background:
                    "var(--brand-surface, hsl(var(--primary) / 0.1))",
                }}
              >
                <svg
                  className="size-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    color: "var(--brand-primary, hsl(var(--primary)))",
                  }}
                >
                  <path d="M12 2a8.5 8.5 0 0 0-8.5 8.5c0 4.5 3.5 8 8.5 11.5 5-3.5 8.5-7 8.5-11.5A8.5 8.5 0 0 0 12 2z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <span
                className="text-sm font-semibold tracking-tight"
                style={{
                  color: "var(--brand-text, hsl(var(--foreground)))",
                }}
              >
                {brandName ?? "Trajectas"}
              </span>
            </div>
          )}
        </div>

        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          style={{
            color:
              "var(--brand-text-muted, hsl(var(--muted-foreground)))",
          }}
        >
          <ArrowLeft className="size-3.5" />
          Back
        </button>
      </header>

      {/* Full-width progress bar at 100% */}
      <div
        className="h-0.5 w-full"
        style={{
          background: "var(--brand-primary, hsl(var(--primary)))",
        }}
      />

      {/* Main content */}
      <main className="flex flex-1 flex-col items-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-[560px] lg:max-w-[720px] xl:max-w-[820px] space-y-8">
          {/* Assessment label */}
          {/* Review eyebrow */}
          <p
            className="text-xs font-medium uppercase tracking-widest"
            style={{
              color: "var(--brand-primary, hsl(var(--primary)))",
            }}
          >
            {content.heading}
          </p>

          {/* Assessment name as main heading */}
          <div className="space-y-2">
            <h1
              className="text-3xl font-semibold tracking-tight sm:text-4xl"
              style={{
                color: "var(--brand-text, hsl(var(--foreground)))",
                fontFamily: "var(--brand-font-heading, inherit)",
              }}
            >
              {assessmentName ?? content.heading}
            </h1>
            <p
              className="text-sm"
              style={{
                color:
                  "var(--brand-neutral-500, hsl(var(--muted-foreground)))",
              }}
            >
              {uniqueAnsweredCount} of {uniqueTotalItems} questions answered
            </p>
          </div>

          {/* Assessment-level status card (single card per assessment) */}
          <div className="space-y-2.5">
            {(() => {
              const firstIncompleteSectionIdx = sections.findIndex((s) =>
                s.items.some((i) => responses[i.id] === undefined),
              );
              return (
                <div
                  className="flex items-center gap-3 rounded-xl border px-4 py-3.5"
                  style={{
                    borderColor:
                      "var(--brand-neutral-200, hsl(var(--border)))",
                    background: "transparent",
                  }}
                >
                  {allAnswered ? (
                    <CheckCircle2
                      className="size-5 shrink-0"
                      style={{
                        color:
                          "var(--brand-primary, hsl(var(--primary)))",
                      }}
                    />
                  ) : (
                    <AlertCircle className="size-5 shrink-0 text-amber-500" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-sm font-medium"
                      style={{
                        color:
                          "var(--brand-text, hsl(var(--foreground)))",
                      }}
                    >
                      {assessmentName ?? "Assessment"}
                    </p>
                    <p
                      className="text-xs"
                      style={{
                        color:
                          "var(--brand-neutral-400, hsl(var(--muted-foreground)))",
                      }}
                    >
                      {uniqueAnsweredCount} / {uniqueTotalItems} answered
                    </p>
                  </div>
                  {!allAnswered && firstIncompleteSectionIdx >= 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        router.push(
                          `/assess/${token}/section/${firstIncompleteSectionIdx}`,
                        )
                      }
                    >
                      Complete
                    </Button>
                  )}
                </div>
              );
            })()}

            {/* Per-section sub-rows — only when we have ≥2 sections with custom titles */}
            {hasMeaningfulSectionTitles &&
              sections.map((section, idx) => {
                const answered = section.items.filter(
                  (i) => responses[i.id] !== undefined,
                ).length;
                const complete = answered === section.items.length;
                return (
                  <div
                    key={section.id}
                    className="flex items-center gap-3 rounded-xl border border-l-2 px-4 py-3 pl-4"
                    style={{
                      borderColor:
                        "var(--brand-neutral-200, hsl(var(--border)))",
                      borderLeftColor:
                        "var(--brand-neutral-300, hsl(var(--border)))",
                      background: "transparent",
                    }}
                  >
                    {complete ? (
                      <CheckCircle2
                        className="size-4 shrink-0"
                        style={{
                          color:
                            "var(--brand-primary, hsl(var(--primary)))",
                        }}
                      />
                    ) : (
                      <AlertCircle className="size-4 shrink-0 text-amber-500" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-xs font-medium"
                        style={{
                          color:
                            "var(--brand-text, hsl(var(--foreground)))",
                        }}
                      >
                        {section.title}
                      </p>
                      <p
                        className="text-xs"
                        style={{
                          color:
                            "var(--brand-neutral-400, hsl(var(--muted-foreground)))",
                        }}
                      >
                        {answered} / {section.items.length}
                      </p>
                    </div>
                    {!complete && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          router.push(`/assess/${token}/section/${idx}`)
                        }
                      >
                        Complete
                      </Button>
                    )}
                  </div>
                );
              })}
          </div>

          {/* Submit */}
          <div className="pt-4 space-y-3">
            {!allAnswered && (
              <p className="text-sm text-amber-500">
                {content.incompleteWarning}
              </p>
            )}
            {submitError && (
              <div
                className="flex items-start gap-2 rounded-xl border px-4 py-3 text-sm"
                style={{
                  borderColor:
                    "var(--brand-error, hsl(var(--destructive) / 0.25))",
                  background:
                    "var(--brand-error-surface, hsl(var(--destructive) / 0.08))",
                  color: "var(--brand-error, hsl(var(--destructive)))",
                }}
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <p>{submitError}</p>
              </div>
            )}
            <div className="flex justify-center">
              <Button
                size="lg"
                onClick={handleSubmit}
                disabled={submitting}
                className="min-w-[200px] gap-1.5"
                style={{
                  background:
                    "var(--brand-primary, hsl(var(--primary)))",
                  color:
                    "var(--brand-primary-foreground, hsl(var(--primary-foreground)))",
                }}
              >
                <Send className="size-4" />
                {submitButtonLabel}
              </Button>
            </div>
            {submitting && (
              <div
                className="mx-auto max-w-md rounded-xl border px-4 py-3 text-sm"
                style={{
                  borderColor:
                    "var(--brand-neutral-200, hsl(var(--border)))",
                  background:
                    "var(--brand-neutral-50, hsl(var(--muted) / 0.45))",
                  color:
                    "var(--brand-neutral-500, hsl(var(--muted-foreground)))",
                }}
              >
                {submitStage === "preparing_report"
                  ? "Your answers are saved. We’re opening the report view while the report finishes preparing."
                  : "We’re saving your answers, scoring the assessment, and preparing the next step."}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-center gap-3 px-4 py-4">
        <span
          className="text-xs"
          style={{
            color:
              "var(--brand-neutral-400, hsl(var(--muted-foreground)))",
          }}
        >
          {content.footerText ??
            (isCustomBrand ? "Powered by Trajectas" : "Your responses are confidential")}
        </span>
        {privacyUrl && (
          <a
            href={privacyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs underline-offset-2 hover:underline"
            style={{ color: "var(--brand-neutral-400, hsl(var(--muted-foreground)))" }}
          >
            Privacy
          </a>
        )}
        {termsUrl && (
          <a
            href={termsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs underline-offset-2 hover:underline"
            style={{ color: "var(--brand-neutral-400, hsl(var(--muted-foreground)))" }}
          >
            Terms
          </a>
        )}
      </footer>

      {submitting && (
        <SavingOverlay
          message={
            submitStage === "preparing_report"
              ? "Opening your report..."
              : "Submitting your assessment..."
          }
          brandLogoUrl={brandLogoUrl}
          brandName={brandName}
        />
      )}
    </div>
  );
}
