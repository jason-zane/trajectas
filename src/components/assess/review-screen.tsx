"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertCircle, Send, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitSession } from "@/app/actions/assess";
import type { SectionForRunner } from "@/app/actions/assess";
import type { ReviewContent } from "@/lib/experience/types";

interface ReviewScreenProps {
  token: string;
  sessionId: string;
  sections: SectionForRunner[];
  responses: Record<string, { value: number; data: Record<string, unknown> }>;
  totalItems: number;
  answeredCount: number;
  assessmentName?: string;
  brandLogoUrl?: string;
  brandName?: string;
  isCustomBrand?: boolean;
  content: ReviewContent;
  nextUrl: string;
  privacyUrl?: string;
  termsUrl?: string;
}

export function ReviewScreen({
  token,
  sessionId,
  sections,
  responses,
  totalItems,
  answeredCount,
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
  const [submitting, setSubmitting] = useState(false);

  const allAnswered = answeredCount >= totalItems;

  async function handleSubmit() {
    setSubmitting(true);
    const result = await submitSession(token, sessionId);

    if (result.error) {
      setSubmitting(false);
      return;
    }

    router.push(nextUrl);
  }

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
                {brandName ?? "TalentFit"}
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
        <div className="w-full max-w-[540px] space-y-6">
          {/* Assessment label */}
          {assessmentName && (
            <p
              className="text-xs font-medium uppercase tracking-widest"
              style={{
                color: "var(--brand-primary, hsl(var(--primary)))",
              }}
            >
              {assessmentName}
            </p>
          )}

          {/* Title */}
          <div className="space-y-2">
            <h1
              className="text-2xl font-semibold tracking-tight"
              style={{
                color: "var(--brand-text, hsl(var(--foreground)))",
                fontFamily: "var(--brand-font-heading, inherit)",
              }}
            >
              {content.heading}
            </h1>
            <p
              className="text-sm"
              style={{
                color:
                  "var(--brand-neutral-500, hsl(var(--muted-foreground)))",
              }}
            >
              {answeredCount} of {totalItems} questions answered
            </p>
          </div>

          {/* Per-section status cards */}
          <div className="space-y-2.5">
            {sections.map((section, idx) => {
              const answered = section.items.filter(
                (i) => responses[i.id] !== undefined
              ).length;
              const complete = answered === section.items.length;

              return (
                <div
                  key={section.id}
                  className="flex items-center gap-3 rounded-xl border px-4 py-3.5"
                  style={{
                    borderColor:
                      "var(--brand-neutral-200, hsl(var(--border)))",
                    background: "transparent",
                  }}
                >
                  {complete ? (
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
                      {section.title}
                    </p>
                    <p
                      className="text-xs"
                      style={{
                        color:
                          "var(--brand-neutral-400, hsl(var(--muted-foreground)))",
                      }}
                    >
                      {answered} / {section.items.length} answered
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
                {submitting ? "Submitting..." : content.buttonLabel}
              </Button>
            </div>
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
            (isCustomBrand ? "Powered by TalentFit" : "Your responses are confidential")}
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
    </div>
  );
}
