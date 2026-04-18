"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, RotateCcw, Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WelcomeContent } from "@/lib/experience/types";

interface WelcomeScreenProps {
  token: string;
  campaignTitle: string;
  campaignDescription?: string;
  assessmentCount: number;
  participantFirstName?: string;
  estimatedMinutes?: number;
  hasInProgressSession: boolean;
  allowResume: boolean;
  brandLogoUrl?: string;
  brandName?: string;
  isCustomBrand?: boolean;
  content: WelcomeContent;
  /** The URL to navigate to when the participant clicks Begin/Resume. Determined server-side from flow config. */
  nextUrl: string;
  privacyUrl?: string;
  termsUrl?: string;
}

export function WelcomeScreen({
  estimatedMinutes,
  hasInProgressSession,
  brandLogoUrl,
  brandName,
  isCustomBrand,
  content,
  nextUrl,
  privacyUrl,
  termsUrl,
}: WelcomeScreenProps) {
  const router = useRouter();

  function handleBegin() {
    router.push(nextUrl);
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
            <Image
              src={brandLogoUrl}
              alt={brandName ?? "Logo"}
              width={140}
              height={28}
              className="h-7 w-auto object-contain"
              unoptimized
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
      </header>

      {/* Main content */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6 sm:py-16">
        <div className="w-full max-w-[560px] space-y-10">
          {/* Greeting */}
          <div className="space-y-4 text-center">
            {content.eyebrow && (
              <p
                className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.18em]"
                style={{
                  color: "var(--brand-accent, var(--gold))",
                }}
              >
                {content.eyebrow}
              </p>
            )}
            <h1
              className="font-sans text-[clamp(2rem,4vw,3rem)] font-extrabold leading-[1.1] tracking-[-0.03em]"
              style={{
                color: "var(--brand-text, hsl(var(--foreground)))",
                fontFamily: "var(--brand-font-heading, inherit)",
              }}
            >
              {content.heading}
            </h1>
            {content.body && (
              <p
                className="text-[1.0625rem] leading-relaxed"
                style={{
                  color:
                    "var(--brand-neutral-500, hsl(var(--muted-foreground)))",
                }}
              >
                {content.body}
              </p>
            )}
          </div>

          {/* Info card */}
          <div
            className="rounded-2xl border border-l-[3px] p-7 shadow-sm dark:shadow-none"
            style={{
              background:
                "var(--brand-neutral-50, hsl(var(--card)))",
              borderColor:
                "var(--brand-neutral-200, hsl(var(--border)))",
              borderLeftColor: "var(--brand-primary, hsl(var(--primary)))",
            }}
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2
                className="font-sans text-[0.9375rem] font-semibold tracking-[-0.01em]"
                style={{
                  color: "var(--brand-text, hsl(var(--foreground)))",
                }}
              >
                {content.infoHeading}
              </h2>
              {estimatedMinutes && (
                <span
                  className="flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[0.6875rem] font-medium tabular-nums"
                  style={{
                    background: "var(--brand-neutral-100, hsl(var(--muted)))",
                    color:
                      "var(--brand-neutral-500, hsl(var(--muted-foreground)))",
                  }}
                >
                  <Clock className="size-3" />~{estimatedMinutes} min
                </span>
              )}
            </div>
            <ul className="space-y-3.5">
              {content.infoItems.map((item, idx) => (
                <InfoBullet key={idx}>{item}</InfoBullet>
              ))}
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
                  {content.resumeButtonLabel}
                </>
              ) : (
                <>
                  <ArrowRight className="size-4" />
                  {content.buttonLabel}
                </>
              )}
            </Button>
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
    </div>
  );
}

function InfoBullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      <Check
        className="mt-0.5 size-3.5 shrink-0"
        style={{
          color: "var(--brand-primary, hsl(var(--primary)))",
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
