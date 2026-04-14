"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, ArrowRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
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
}

export function CompleteScreen({
  content,
  brandLogoUrl,
  brandName,
  isCustomBrand,
  nextUrl,
  privacyUrl,
  termsUrl,
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
    <div className="flex min-h-dvh flex-col">
      <header
        className="flex h-14 items-center px-4 sm:px-6"
        style={{
          background: "var(--brand-neutral-50, hsl(var(--background)))",
        }}
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

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-[540px] text-center space-y-6">
          <div className="flex justify-center">
            <div
              className="flex size-24 items-center justify-center rounded-full"
              style={{
                background:
                  "var(--brand-surface, hsl(var(--primary) / 0.1))",
              }}
            >
              <CheckCircle2
                className="size-12 animate-in zoom-in duration-500"
                style={{
                  color: "var(--brand-primary, hsl(var(--primary)))",
                }}
              />
            </div>
          </div>

          <div className="space-y-3">
            <h1
              className="text-2xl font-semibold tracking-tight sm:text-3xl"
              style={{
                color: "var(--brand-text, hsl(var(--foreground)))",
                fontFamily: "var(--brand-font-heading, inherit)",
              }}
            >
              {content.heading}
            </h1>
            <p
              className="mx-auto max-w-md leading-relaxed"
              style={{
                color:
                  "var(--brand-neutral-500, hsl(var(--muted-foreground)))",
              }}
            >
              {content.body}
            </p>
          </div>

          {/* Redirect countdown */}
          {content.redirectUrl && (
            <div className="space-y-2">
              <p
                className="text-sm"
                style={{
                  color: "var(--brand-neutral-400, hsl(var(--muted-foreground)))",
                }}
              >
                {content.redirectLabel
                  ? `${content.redirectLabel} (${countdown}s)`
                  : `Redirecting in ${countdown} seconds...`}
              </p>
              <a
                href={ensureAbsoluteUrl(content.redirectUrl)}
                className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:opacity-80"
                style={{
                  color: "var(--brand-primary, hsl(var(--primary)))",
                }}
              >
                Continue now
                <ExternalLink className="size-3.5" />
              </a>
            </div>
          )}

          {/* Continue to next flow page */}
          {nextUrl && !content.redirectUrl && (
            <div className="flex justify-center">
              <Button
                size="lg"
                render={<Link href={nextUrl} />}
                className="min-w-[200px] gap-1.5"
                style={{
                  background: "var(--brand-primary, hsl(var(--primary)))",
                  color: "var(--brand-primary-foreground, hsl(var(--primary-foreground)))",
                }}
              >
                Continue
                <ArrowRight className="size-4" />
              </Button>
            </div>
          )}
        </div>
      </main>

      <footer className="flex items-center justify-center gap-3 px-4 py-4">
        <span
          className="text-xs"
          style={{
            color:
              "var(--brand-neutral-400, hsl(var(--muted-foreground)))",
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
