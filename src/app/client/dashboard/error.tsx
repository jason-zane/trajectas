"use client";

import { ErrorBoundaryCard } from "@/components/errors/error-boundary-card";

export default function DashboardErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorBoundaryCard
      error={error}
      reset={reset}
      title="Unable to load dashboard"
      description="We couldn't load your dashboard. Try again, or contact support if the problem persists."
    />
  );
}
