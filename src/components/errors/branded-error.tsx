"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Home, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandedMessage } from "./branded-message";

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
    <BrandedMessage
      eyebrow={eyebrow}
      title={title}
      description={
        description ??
        error.message ??
        "An unexpected error occurred. Please try again, or head back to the dashboard."
      }
      actions={
        <>
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
        </>
      }
      footer={
        error.digest ? (
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
        ) : null
      }
    />
  );
}
