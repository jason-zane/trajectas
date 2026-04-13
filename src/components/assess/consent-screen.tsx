"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { saveConsent } from "@/app/actions/experience";
import type { ConsentContent } from "@/lib/experience/types";

interface ConsentScreenProps {
  token: string;
  participantId: string;
  brandLogoUrl?: string;
  brandName?: string;
  isCustomBrand?: boolean;
  content: ConsentContent;
  /** URL to navigate after consent. Determined server-side from flow config. */
  nextUrl: string;
  privacyUrl?: string;
  termsUrl?: string;
}

export function ConsentScreen({
  token,
  participantId,
  brandLogoUrl,
  brandName,
  isCustomBrand,
  content,
  nextUrl,
  privacyUrl,
  termsUrl,
}: ConsentScreenProps) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleContinue() {
    if (!agreed) return;
    setSubmitting(true);

    // Save consent — IP will be captured server-side
    await saveConsent(token, participantId);

    router.push(nextUrl);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Header */}
      <header
        className="flex h-14 items-center px-4 sm:px-6"
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
      </header>

      {/* Main content */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-[540px] space-y-8">
          {/* Eyebrow + Title */}
          <div className="space-y-3 text-center">
            {content.eyebrow && (
              <p
                className="text-xs font-medium uppercase tracking-widest"
                style={{
                  color: "var(--brand-primary, hsl(var(--primary)))",
                }}
              >
                {content.eyebrow}
              </p>
            )}
            <h1
              className="text-3xl font-semibold tracking-tight sm:text-4xl"
              style={{
                color: "var(--brand-text, hsl(var(--foreground)))",
                fontFamily: "var(--brand-font-heading, inherit)",
              }}
            >
              {content.heading}
            </h1>
          </div>

          {/* Body content card */}
          <div
            className="rounded-2xl border border-l-[3px] p-6 sm:p-8 shadow-sm dark:shadow-none"
            style={{
              background: "var(--brand-neutral-50, hsl(var(--card)))",
              borderColor: "var(--brand-neutral-200, hsl(var(--border)))",
              borderLeftColor: "var(--brand-primary, hsl(var(--primary)))",
            }}
          >
            <div
              className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed"
              style={{
                color:
                  "var(--brand-neutral-500, hsl(var(--muted-foreground)))",
              }}
            >
              {content.body.split("\n").map((line, idx) => {
                if (line.startsWith("**") && line.endsWith("**")) {
                  return (
                    <p
                      key={idx}
                      className="font-semibold mt-4 mb-2"
                      style={{
                        color: "var(--brand-text, hsl(var(--foreground)))",
                      }}
                    >
                      {line.replace(/\*\*/g, "")}
                    </p>
                  );
                }
                if (line.startsWith("- ")) {
                  return (
                    <div key={idx} className="flex items-start gap-2 ml-1 mb-1">
                      <Check
                        className="mt-0.5 size-3.5 shrink-0"
                        style={{
                          color:
                            "var(--brand-primary, hsl(var(--primary)))",
                        }}
                      />
                      <span>{line.slice(2)}</span>
                    </div>
                  );
                }
                if (line.trim() === "") return <div key={idx} className="h-3" />;
                return <p key={idx}>{line}</p>;
              })}
            </div>

            {/* Consent checkbox */}
            <div className="mt-6 flex items-start gap-3 pt-4 border-t border-border">
              <Checkbox
                id="consent-check"
                checked={agreed}
                onCheckedChange={(v) => setAgreed(v === true)}
              />
              <label
                htmlFor="consent-check"
                className="text-sm cursor-pointer leading-snug"
                style={{
                  color: "var(--brand-text, hsl(var(--foreground)))",
                }}
              >
                {content.consentCheckboxLabel}
              </label>
            </div>
          </div>

          {/* CTA */}
          <div className="flex justify-center">
            <Button
              size="lg"
              onClick={handleContinue}
              disabled={!agreed || submitting}
              className="min-w-[200px] gap-1.5"
              style={{
                background: "var(--brand-primary, hsl(var(--primary)))",
                color:
                  "var(--brand-primary-foreground, hsl(var(--primary-foreground)))",
              }}
            >
              <ArrowRight className="size-4" />
              {submitting ? "Continuing..." : content.buttonLabel}
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
