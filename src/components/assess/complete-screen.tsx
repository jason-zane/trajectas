"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import type { CompleteContent } from "@/lib/experience/types";

function ensureAbsoluteUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

interface CompleteScreenProps {
  content: CompleteContent;
  brandLogoUrl?: string;
  brandName?: string;
  isCustomBrand?: boolean;
  nextUrl?: string | null;
  privacyUrl?: string;
  termsUrl?: string;
  answeredCount?: number;
  totalCount?: number;
  submittedAt?: string;
}

export function CompleteScreen({
  content,
  brandLogoUrl,
  brandName,
  isCustomBrand,
  nextUrl,
  privacyUrl,
  termsUrl,
  answeredCount,
  totalCount,
  submittedAt,
}: CompleteScreenProps) {
  const [countdown, setCountdown] = useState(5);

  // Auto-redirect if redirectUrl is configured
  useEffect(() => {
    if (!content.redirectUrl) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          window.location.href = ensureAbsoluteUrl(content.redirectUrl!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [content.redirectUrl]);

  return (
    <div className="flex min-h-dvh flex-col" style={{ background: "var(--runner-page, hsl(var(--background)))" }}>
      {/* Full-width progress bar at 100% */}
      <div
        className="h-[2px] w-full"
        style={{
          background: "var(--runner-progress, var(--brand-accent, hsl(var(--primary))))",
        }}
      />

      <header
        className="flex items-center justify-between px-6 py-6 sm:px-10 lg:px-[120px]"
      >
        <div className="flex items-center gap-2.5">
          {brandLogoUrl ? (
            <Image
              src={brandLogoUrl}
              alt={brandName ?? "Logo"}
              width={140}
              height={28}
              className="h-6 w-auto object-contain"
              unoptimized
            />
          ) : (
            <div className="flex items-center gap-2">
              <svg
                className="size-[15px]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  color: "var(--runner-accent, var(--brand-accent, hsl(var(--primary))))",
                }}
              >
                <path d="M12 2a8.5 8.5 0 0 0-8.5 8.5c0 4.5 3.5 8 8.5 11.5 5-3.5 8.5-7 8.5-11.5A8.5 8.5 0 0 0 12 2z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span
                className="text-[13px] font-semibold tracking-tight"
                style={{
                  color: "var(--runner-text, hsl(var(--foreground)))",
                }}
              >
                {brandName ?? "Trajectas"}
              </span>
            </div>
          )}
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-8 sm:px-10 sm:py-12 lg:px-[120px]">
        <div className="w-full max-w-[620px] space-y-8 text-center">
          <div className="space-y-6">
            <h1
              className="font-serif text-[44px] font-semibold leading-[1.15] tracking-[-0.015em]"
              style={{
                color: "var(--runner-display, hsl(var(--foreground)))",
                fontFamily: '"Source Serif 4", Georgia, serif',
              }}
            >
              {content.heading}
            </h1>
            <p
              className="text-[14.5px] leading-relaxed"
              style={{
                color: "var(--runner-text-muted, hsl(var(--muted-foreground)))",
              }}
            >
              {content.body}
            </p>
          </div>

          {/* Meta row: answered count + timestamp + close hint */}
          <div className="flex items-center justify-center gap-2.5">
            <span
              className="font-mono text-[10.5px] font-medium uppercase tracking-[0.14em]"
              style={{
                color: "var(--runner-text-meta, hsl(var(--muted-foreground)))",
              }}
            >
              {answeredCount !== undefined && totalCount !== undefined
                ? `${answeredCount} OF ${totalCount} ANSWERED`
                : "ASSESSMENT COMPLETE"}
            </span>
            {submittedAt && (
              <>
                <span
                  className="inline-block size-1 rounded-full"
                  style={{
                    background: "var(--runner-accent, var(--brand-accent, hsl(var(--primary))))",
                  }}
                />
                <span
                  className="font-mono text-[10.5px] font-medium uppercase tracking-[0.14em]"
                  style={{
                    color: "var(--runner-text-meta, hsl(var(--muted-foreground)))",
                  }}
                >
                  {submittedAt}
                </span>
              </>
            )}
            <span
              className="inline-block size-1 rounded-full"
              style={{
                background: "var(--runner-accent, var(--brand-accent, hsl(var(--primary))))",
              }}
            />
            <span
              className="font-mono text-[10.5px] font-medium uppercase tracking-[0.14em]"
              style={{
                color: "var(--runner-text-meta, hsl(var(--muted-foreground)))",
              }}
            >
              YOU CAN CLOSE THIS WINDOW
            </span>
          </div>

          {/* Redirect countdown */}
          {content.redirectUrl && (
            <div className="space-y-2">
              <p
                className="font-mono text-[12px] tabular-nums"
                style={{
                  color: "var(--runner-text-muted, hsl(var(--muted-foreground)))",
                }}
              >
                {content.redirectLabel
                  ? `${content.redirectLabel} (${countdown}s)`
                  : `Redirecting in ${countdown} second${countdown === 1 ? "" : "s"}…`}
              </p>
              <a
                href={ensureAbsoluteUrl(content.redirectUrl)}
                className="inline-flex items-center gap-1.5 font-semibold transition-opacity hover:opacity-70"
                style={{
                  color: "var(--runner-accent, var(--brand-accent, hsl(var(--primary))))",
                  fontSize: "14px",
                }}
              >
                Continue now
                <ExternalLink className="size-3.5" />
              </a>
            </div>
          )}

          {/* Continue to next flow page */}
          {nextUrl && !content.redirectUrl && (
            <div className="flex justify-center pt-2">
              <Link href={nextUrl}>
                <button
                  className="inline-flex items-center gap-2 rounded border px-8 py-3.5 font-semibold transition-all duration-200 disabled:opacity-60"
                  style={{
                    background: "var(--runner-cta-fill, var(--brand-accent, hsl(var(--primary))))",
                    color: "var(--runner-cta-text, var(--brand-primary-foreground, hsl(var(--primary-foreground))))",
                    border: "none",
                    fontSize: "15px",
                    fontFamily: '"Plus Jakarta Sans", sans-serif',
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--runner-cta-fill-hover, var(--brand-accent, hsl(var(--primary))))";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "var(--runner-cta-fill, var(--brand-accent, hsl(var(--primary))))";
                  }}
                >
                  Continue
                  <ArrowRight className="size-4" />
                </button>
              </Link>
            </div>
          )}
        </div>
      </main>

      <footer className="flex items-center justify-center gap-2 px-6 py-4 sm:px-10 lg:px-[120px]">
        <span
          className="text-[11px]"
          style={{
            color: "var(--runner-text-faint, hsl(var(--muted-foreground)))",
          }}
        >
          {content.footerText ??
            (isCustomBrand ? "Powered by Trajectas" : "Trajectas")}
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
    </div>
  );
}
