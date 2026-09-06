"use client";

import { useRef, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { saveConsent } from "@/app/actions/experience";
import type { ConsentContent } from "@/lib/experience/types";
import type { ConfidentialityMode } from "@/types/database";

interface ConsentScreenProps {
  token: string;
  participantId: string;
  content: ConsentContent;
  /** URL to navigate after consent. Determined server-side from flow config. */
  nextUrl: string;
  // Unused in dark-editorial design, but kept in interface for consistency with page API
  brandLogoUrl?: string;
  brandName?: string;
  isCustomBrand?: boolean;
  privacyUrl?: string;
  termsUrl?: string;
  inviterName?: string;
  inviterRole?: string;
  confidentialityMode?: ConfidentialityMode;
}

export function ConsentScreen({
  token,
  participantId,
  content,
  nextUrl,
}: ConsentScreenProps) {
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saving = useRef(false);

  async function handleContinue() {
    if (!agreed || saving.current) return;
    saving.current = true;
    setSubmitting(true);
    setSaveError(null);
    try {
      // Continue only after the server acknowledges consent persistence.
      const result = await saveConsent(token, participantId);
      if (result.error) throw new Error('Consent was not saved');
      window.location.href = nextUrl;
    } catch {
      setSaveError("We couldn’t save your consent. Please try again.");
      saving.current = false;
      setSubmitting(false);
    }
  }

  // Parse body lines for rendering
  const bodyLines = content.body.split("\n");

  return (
    <div
      className="flex min-h-dvh flex-col"
      style={{
        background: "var(--runner-page)",
      }}
    >
      {/* Main content — full-bleed centered */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12 sm:px-10 lg:px-[120px]">
        <div className="w-full max-w-[620px] space-y-8">
          {/* Mono overline + serif heading */}
          <div className="space-y-4">
            {content.eyebrow && (
              <p
                className="font-mono text-[10px] font-semibold uppercase"
                style={{
                  color: "var(--runner-overline)",
                  letterSpacing: "0.26em",
                }}
              >
                {content.eyebrow}
              </p>
            )}
            <h1
              className="text-[36px] font-semibold leading-tight"
              style={{
                color: "var(--runner-text)",
                fontFamily: '"Source Serif 4", Georgia, serif',
                letterSpacing: "-0.01em",
              }}
            >
              {content.heading}
            </h1>
          </div>

          {/* Body content: hairline-divided rows with check icons */}
          <div className="space-y-0">
            {bodyLines.map((line, idx) => {
              if (line.startsWith("- ")) {
                // List item → hairline row with check icon
                const itemText = line.slice(2);
                return (
                  <div
                    key={idx}
                    className="flex items-start gap-4 py-4 border-b"
                    style={{
                      borderColor: "var(--runner-hairline)",
                      color: "var(--runner-text)",
                    }}
                  >
                    <Check
                      className="mt-0.5 size-5 shrink-0 flex-none"
                      style={{
                        color: "var(--runner-accent)",
                      }}
                    />
                    <span
                      className="text-[13.5px] leading-relaxed"
                      style={{
                        color: "var(--runner-text)",
                      }}
                    >
                      {itemText}
                    </span>
                  </div>
                );
              }
              // Empty lines → skip
              if (line.trim() === "") return null;
              // Other prose → normal paragraph with hairline
              return (
                <p
                  key={idx}
                  className="py-4 border-b text-[13.5px] leading-relaxed"
                  style={{
                    color: "var(--runner-text)",
                    borderColor: "var(--runner-hairline)",
                  }}
                >
                  {line}
                </p>
              );
            })}
          </div>

          {/* Consent checkbox row — hairline above and below */}
          <div
            className="flex items-start gap-3 py-4 border-t border-b"
            style={{
              borderColor: "var(--runner-hairline)",
            }}
          >
            <div className="mt-1 flex-none">
              <Checkbox
                id="consent-check"
                checked={agreed}
                onCheckedChange={(v) => setAgreed(v === true)}
                className="size-5 border"
                style={{
                  background: agreed ? "var(--runner-accent)" : "transparent",
                  borderColor: agreed ? "var(--runner-accent)" : "var(--runner-input-border)",
                }}
              />
            </div>
            <label
              htmlFor="consent-check"
              className="flex-1 cursor-pointer text-[13.5px] leading-relaxed"
              style={{
                color: "var(--runner-text)",
              }}
            >
              {content.consentCheckboxLabel}
            </label>
          </div>

          {saveError && (
            <Alert variant="destructive">
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}

          {/* CTA — one per screen */}
          <div className="pt-2">
            <Button
              onClick={handleContinue}
              disabled={!agreed || submitting}
              className="px-7 py-3 text-[14.5px] font-semibold rounded-[10px] border-0"
              style={{
                background: agreed && !submitting
                  ? "var(--runner-cta-fill)"
                  : "var(--runner-ghost-fill)",
                color: agreed && !submitting
                  ? "var(--runner-cta-text)"
                  : "var(--runner-text-muted)",
                cursor: agreed && !submitting ? "pointer" : "not-allowed",
              }}
            >
              {submitting ? "Continuing..." : content.buttonLabel}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
