"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WelcomeScreenProps {
  token: string;
  campaignTitle: string;
  campaignDescription?: string;
  assessmentCount: number;
  candidateFirstName?: string;
  hasInProgressSession: boolean;
  allowResume: boolean;
  brandLogoUrl?: string;
  brandName?: string;
  isCustomBrand?: boolean;
}

/**
 * Welcome screen for the assessment runner.
 * Card-centered layout, brand-aware.
 */
export function WelcomeScreen({
  token,
  campaignTitle,
  campaignDescription,
  assessmentCount,
  candidateFirstName,
  hasInProgressSession,
  allowResume,
  brandLogoUrl,
  brandName,
  isCustomBrand,
}: WelcomeScreenProps) {
  const router = useRouter();

  function handleBegin() {
    router.push(`/assess/${token}/section/0`);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Header */}
      <header
        className="flex h-14 items-center px-4 sm:px-6"
        style={{ background: "var(--brand-neutral-50, hsl(var(--background)))" }}
      >
        <div className="flex items-center gap-2.5">
          {brandLogoUrl ? (
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
      </header>

      {/* Main content */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-[540px] space-y-6">
          {/* Greeting */}
          <div className="space-y-3 text-center">
            {candidateFirstName && (
              <p
                className="text-sm"
                style={{
                  color:
                    "var(--brand-neutral-500, hsl(var(--muted-foreground)))",
                }}
              >
                Welcome, {candidateFirstName}
              </p>
            )}
            <h1
              className="text-2xl font-semibold tracking-tight sm:text-3xl"
              style={{
                color: "var(--brand-text, hsl(var(--foreground)))",
                fontFamily: "var(--brand-font-heading, inherit)",
              }}
            >
              {campaignTitle}
            </h1>
            {campaignDescription && (
              <p
                className="leading-relaxed"
                style={{
                  color:
                    "var(--brand-neutral-500, hsl(var(--muted-foreground)))",
                }}
              >
                {campaignDescription}
              </p>
            )}
          </div>

          {/* Info card */}
          <div
            className="rounded-2xl border p-6 shadow-sm dark:shadow-none"
            style={{
              background:
                "var(--brand-neutral-50, hsl(var(--card)))",
              borderColor:
                "var(--brand-neutral-200, hsl(var(--border)))",
            }}
          >
            <h2
              className="mb-4 text-sm font-medium"
              style={{
                color: "var(--brand-text, hsl(var(--foreground)))",
              }}
            >
              Before you begin
            </h2>
            <ul className="space-y-3">
              <InfoBullet>
                This campaign contains {assessmentCount}{" "}
                {assessmentCount === 1 ? "assessment" : "assessments"}.
              </InfoBullet>
              <InfoBullet>
                Your responses are saved automatically as you go.
              </InfoBullet>
              {allowResume && (
                <InfoBullet>
                  You can leave and return to continue where you left off.
                </InfoBullet>
              )}
              <InfoBullet>
                There are no right or wrong answers -- respond honestly.
              </InfoBullet>
            </ul>
          </div>

          {/* CTA */}
          <div className="flex justify-center">
            <Button
              size="lg"
              onClick={handleBegin}
              className="min-w-[200px] gap-1.5"
              style={{
                background:
                  "var(--brand-primary, hsl(var(--primary)))",
                color:
                  "var(--brand-primary-foreground, hsl(var(--primary-foreground)))",
              }}
            >
              {hasInProgressSession ? (
                <>
                  <RotateCcw className="size-4" />
                  Resume Assessment
                </>
              ) : (
                <>
                  <ArrowRight className="size-4" />
                  Begin Assessment
                </>
              )}
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-center px-4 py-4">
        {isCustomBrand ? (
          <span
            className="text-xs"
            style={{
              color:
                "var(--brand-neutral-400, hsl(var(--muted-foreground)))",
            }}
          >
            Powered by TalentFit
          </span>
        ) : (
          <span
            className="text-xs"
            style={{
              color:
                "var(--brand-neutral-400, hsl(var(--muted-foreground)))",
            }}
          >
            Your responses are confidential
          </span>
        )}
      </footer>
    </div>
  );
}

function InfoBullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      <span
        className="mt-1.5 size-1.5 shrink-0 rounded-full"
        style={{
          background: "var(--brand-primary, hsl(var(--primary)))",
        }}
      />
      <span
        style={{
          color:
            "var(--brand-neutral-500, hsl(var(--muted-foreground)))",
        }}
      >
        {children}
      </span>
    </li>
  );
}
