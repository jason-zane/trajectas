"use client";

import { ErrorBoundaryCard } from "@/components/errors/error-boundary-card";

export default function AssessmentsErrorBoundary({
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
      title="Unable to load assessments"
      description="We couldn't load the assessment library. Try again, or return to the dashboard."
    />
  );
}
