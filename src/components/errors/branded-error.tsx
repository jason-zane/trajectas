"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BrandedErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  /** Displayed above the heading in gold mono, e.g. "Something broke" */
  eyebrow?: string;
  /** Main heading, editorial style. Defaults to a warm apology. */
  title?: string;
  /** Supporting copy. Falls back to `error.message`. */
  description?: ReactNode;
  /** Where the "home" CTA points. Defaults to `/`. */
  homeHref?: string;
  /** Label for the home CTA. Defaults to "Back to dashboard". */
  homeLabel?: string;
}

export function BrandedError({
  error,
  reset,
  eyebrow = "Something went wrong",
  title = "We hit a snag on the way.",
  description,
  homeHref = "/",
  homeLabel = "Back to dashboard",
}: BrandedErrorProps) {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-start px-6 py-20">
      <div className="flex size-12 items-center justify-center rounded-xl bg-[var(--gold)]/15 ring-1 ring-[var(--gold)]/30">
        <AlertTriangle className="size-6 text-[var(--gold)]" />
      </div>
      <p className="mt-6 font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">
        {eyebrow}
      </p>
      <h1 className="mt-2 font-sans text-[clamp(1.75rem,3vw,2.25rem)] font-extrabold leading-[1.1] tracking-[-0.02em] text-foreground">
        {title}
      </h1>
      <div className="mt-3 text-[1rem] leading-relaxed text-muted-foreground">
        {description ??
          error.message ??
          "An unexpected error occurred. Please try again, or head back to the dashboard."}
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Button onClick={reset}>
          <RotateCcw className="size-4" />
          Try again
        </Button>
        <Link href={homeHref}>
          <Button variant="outline">
            <Home className="size-4" />
            {homeLabel}
          </Button>
        </Link>
      </div>
      {error.digest && (
        <details
          className="mt-8 w-full"
          open={showDetails}
          onToggle={(e) => setShowDetails((e.target as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground">
            Technical details
          </summary>
          <pre className="mt-2 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs text-muted-foreground">
            {error.digest}
          </pre>
        </details>
      )}
    </div>
  );
}
