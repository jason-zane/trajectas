"use client";

import { BrandLogo, BrandFooter } from "@/components/brand/brand-logo";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, AlertCircle, ArrowLeft } from "lucide-react";
import { submitSession } from "@/app/actions/assess";
import { clearSession } from "@/lib/assess/response-store";
import { SavingOverlay } from "./saving-overlay";
import type { SectionForRunner } from "@/app/actions/assess";
import type { ReviewContent } from "@/lib/experience/types";

interface ReviewScreenProps {
  token: string;
  sessionId: string;
  sections: SectionForRunner[];
  responses: Record<string, { value: number; data: Record<string, unknown> }>;
  brandLogoUrl?: string;
  brandName?: string;
  isCustomBrand?: boolean;
  content: ReviewContent;
  nextUrl: string;
  privacyUrl?: string;
  termsUrl?: string;
  participantFirstName?: string;
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
  brandLogoUrl,
  brandName,
  isCustomBrand,
  content,
  nextUrl,
  privacyUrl,
  termsUrl,
  participantFirstName,
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

  const allAnswered = uniqueAnsweredCount >= uniqueTotalItems;
  const canSubmit = !submitting && allAnswered;

  async function handleSubmit() {
    setSubmitError(null);
    setSubmitStage("submitting");
    try {
      const result = await submitSession(token, sessionId);
      if (!result.ok) {
        setSubmitError(result.message);
        setSubmitStage("idle");
        if (result.error === "incomplete_submission") {
          // Server counts disagree with what this screen showed — re-render
          // from server state so the section rows reflect reality.
          router.refresh();
        }
        return;
      }

      if (result.outcome === "report_pending") {
        setSubmitStage("preparing_report");
      }

      // The assessment is submitted — drop the locally cached responses so
      // they don't linger in IndexedDB on shared devices.
      await clearSession(sessionId).catch(() => {});

      // Completing the final required assessment rotates the access token
      // server-side; from here every navigation must use the fresh one.
      const destination = result.refreshedAccessToken
        ? nextUrl.replace(`/assess/${token}`, `/assess/${result.refreshedAccessToken}`)
        : nextUrl;
      router.push(destination);
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
    <div className="flex min-h-dvh flex-col" style={{ background: "var(--runner-page, hsl(var(--background)))" }}>
      {/* Full-width progress bar at 100% */}
      <div
        className="h-[2px] w-full"
        style={{
          background: "var(--runner-progress, var(--brand-accent, hsl(var(--primary))))",
        }}
      />

      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-6 sm:px-10 lg:px-[120px]"
      >
        <div className="flex items-center gap-2.5">
          <BrandLogo name={brandName} logoUrl={brandLogoUrl} height={28} runner />
        </div>

        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 rounded text-[12.5px] font-medium transition-opacity hover:opacity-70"
          style={{
            color: "var(--runner-text-muted, hsl(var(--muted-foreground)))",
          }}
        >
          <ArrowLeft className="size-3" strokeWidth={2} />
          Back
        </button>
      </header>

      {/* Main content */}
      <main className="flex flex-1 flex-col items-center px-6 py-12 sm:px-10 sm:py-16 lg:px-[120px]">
        <div className="w-full max-w-[620px] space-y-8">
          {/* Review eyebrow */}
          <p
            className="font-mono text-[10px] font-semibold uppercase tracking-[0.26em]"
            style={{
              color: "var(--runner-accent, var(--brand-accent, hsl(var(--primary))))",
            }}
          >
            {content.heading}
          </p>

          {/* Assessment name as main heading */}
          <div className="space-y-2">
            <h1
              className="font-serif text-[38px] font-semibold leading-[1.15] tracking-[-0.015em]"
              style={{
                color: "var(--runner-display, hsl(var(--foreground)))",
                fontFamily: '"Source Serif 4", Georgia, serif',
              }}
            >
              Almost there{participantFirstName ? `, ${participantFirstName}` : ""}.
            </h1>
            <p
              className="text-[13.5px] leading-relaxed"
              style={{
                color: "var(--runner-text-muted, hsl(var(--muted-foreground)))",
              }}
            >
              {uniqueAnsweredCount === uniqueTotalItems
                ? "You've answered all questions. Ready to submit?"
                : "One section still has an unanswered question."}
            </p>
          </div>

          {/* Section rows — hairline-divided list */}
          <div
            className="border-t"
            style={{
              borderColor: "var(--runner-hairline, hsl(var(--border)))",
            }}
          >
            {sections.map((section, idx) => {
              const answered = section.items.filter(
                (i) => responses[i.id] !== undefined,
              ).length;
              const complete = answered === section.items.length;

              return (
                <div
                  key={section.id}
                  className="flex items-center gap-4 border-b px-2 py-4"
                  style={{
                    borderColor: "var(--runner-hairline, hsl(var(--border)))",
                  }}
                >
                  {/* Section index */}
                  <span
                    className="font-mono text-[11px] font-semibold"
                    style={{
                      color: "var(--runner-accent, var(--brand-accent, hsl(var(--primary))))",
                    }}
                  >
                    {String(idx + 1).padStart(2, "0")}
                  </span>

                  {/* Section title and count */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[14px] font-semibold leading-tight"
                      style={{
                        color: "var(--runner-text, hsl(var(--foreground)))",
                      }}
                    >
                      {isDefaultTitle(section.title) ? `Section ${idx + 1}` : section.title}
                    </p>
                  </div>

                  {/* Answer count */}
                  <span
                    className="font-mono text-[11px] font-medium"
                    style={{
                      color: "var(--runner-text-meta, hsl(var(--muted-foreground)))",
                    }}
                  >
                    {answered} / {section.items.length}
                  </span>

                  {/* Complete check or Finish button */}
                  {complete ? (
                    <Check
                      className="size-[14px] flex-shrink-0"
                      strokeWidth={2.5}
                      style={{
                        color: "var(--runner-accent, var(--brand-accent, hsl(var(--primary))))",
                      }}
                    />
                  ) : (
                    <button
                      onClick={() => router.push(`/assess/${token}/section/${idx}`)}
                      className="rounded border px-3.5 py-1.5 text-[12px] font-semibold transition-colors"
                      style={{
                        border: "1px solid var(--runner-ghost-border, hsl(var(--border)))",
                        color: "var(--runner-text, hsl(var(--foreground)))",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "var(--runner-ghost-border-hover, hsl(var(--border)))";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "var(--runner-ghost-border, hsl(var(--border)))";
                      }}
                    >
                      Finish section
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Submit section */}
          <div className="flex flex-col gap-4 pt-4">
            {!allAnswered && (
              <p
                className="text-[12px]"
                style={{
                  color: "var(--brand-warning, hsl(var(--destructive)))",
                }}
              >
                {content.incompleteWarning}
              </p>
            )}

            {submitError && (
              <div
                className="flex items-start gap-2 rounded border px-4 py-3 text-[13px]"
                style={{
                  borderColor: "var(--brand-error, hsl(var(--destructive)))",
                  background: "var(--brand-error, hsl(var(--destructive) / 0.08))",
                  color: "var(--brand-error, hsl(var(--destructive)))",
                }}
              >
                <AlertCircle className="mt-0.5 size-4 flex-shrink-0" strokeWidth={2} />
                <p>{submitError}</p>
              </div>
            )}

            {/* CTA Button */}
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 rounded border px-8 py-3.5 font-semibold transition-all duration-200 disabled:opacity-60"
              style={{
                background: "var(--runner-cta-fill, var(--brand-accent, hsl(var(--primary))))",
                color: "var(--runner-cta-text, var(--brand-primary-foreground, hsl(var(--primary-foreground))))",
                border: "none",
                fontSize: "15px",
                fontFamily: "’Plus Jakarta Sans’, sans-serif",
                cursor: canSubmit ? "pointer" : "not-allowed",
              }}
              onMouseEnter={(e) => {
                if (canSubmit) {
                  e.currentTarget.style.background = "var(--runner-cta-fill-hover, var(--brand-accent, hsl(var(--primary))))";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--runner-cta-fill, var(--brand-accent, hsl(var(--primary))))";
              }}
            >
              {submitButtonLabel}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </button>

            {/* Submission caveat */}
            <p
              className="text-[12px]"
              style={{
                color: "var(--runner-text-faint, hsl(var(--muted-foreground)))",
              }}
            >
              Answers can’t be changed after submitting
            </p>

            {/* In-flight message */}
            {submitting && (
              <div
                className="rounded border px-4 py-3 text-[13px]"
                style={{
                  borderColor: "var(--runner-hairline, hsl(var(--border)))",
                  background: "var(--runner-ghost-fill, hsl(var(--muted) / 0.02))",
                  color: "var(--runner-text-muted, hsl(var(--muted-foreground)))",
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
      <footer className="flex items-center justify-center gap-2 px-6 py-4 sm:px-10 lg:px-[120px]">
        <span
          className="text-[11px]"
          style={{
            color: "var(--runner-text-faint, hsl(var(--muted-foreground)))",
          }}
        >
          <BrandFooter text={content.footerText ??
            (isCustomBrand ? "Powered by Trajectas" : "Your responses are confidential")} runner />
        </span>
        {privacyUrl && (
          <a
            href={privacyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] underline-offset-2 hover:underline"
            style={{ color: "var(--runner-text-faint, hsl(var(--muted-foreground)))" }}
          >
            Privacy
          </a>
        )}
        {termsUrl && (
          <a
            href={termsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] underline-offset-2 hover:underline"
            style={{ color: "var(--runner-text-faint, hsl(var(--muted-foreground)))" }}
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
