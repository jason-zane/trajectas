"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: error.stack,
        },
      },
    });
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-background via-background to-background/95 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <div className="w-full max-w-md space-y-8">
        {/* Error Icon with Glow */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-destructive/20 rounded-full blur-2xl animate-pulse" />
            <div className="relative bg-destructive/10 dark:bg-destructive/20 rounded-full p-4 border border-destructive/30 dark:border-destructive/40">
              <AlertCircle className="w-12 h-12 text-destructive" />
            </div>
          </div>
        </div>

        {/* Error Content */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold text-foreground">
            Something went wrong
          </h1>
          <p className="text-caption text-muted-foreground">
            An unexpected error occurred. Our team has been notified and is looking into it.
          </p>
        </div>

        {/* Error Details (Development only) */}
        {process.env.NODE_ENV === "development" && (
          <div className="bg-destructive/5 dark:bg-destructive/10 border border-destructive/20 dark:border-destructive/30 rounded-lg p-4 space-y-2">
            <p className="text-xs font-mono text-destructive dark:text-destructive font-semibold">
              Error Details
            </p>
            <p className="text-xs font-mono text-muted-foreground break-words">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-xs font-mono text-muted-foreground">
                Digest: {error.digest}
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3 pt-4">
          <Button
            onClick={reset}
            variant="default"
            size="lg"
            className="w-full"
          >
            Try again
          </Button>
          <Button
            onClick={() => window.location.href = "/partner"}
            variant="outline"
            size="lg"
            className="w-full"
          >
            Back to partner portal
          </Button>
        </div>

        {/* Support Info */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            Need help? Contact{" "}
            <a
              href="mailto:support@trajectas.io"
              className="text-primary hover:underline font-medium"
            >
              support@trajectas.io
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
