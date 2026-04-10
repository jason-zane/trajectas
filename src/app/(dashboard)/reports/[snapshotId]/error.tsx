"use client";

import { ErrorBoundaryCard } from "@/components/errors/error-boundary-card";

export default function ReportSnapshotErrorBoundary({
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
      title="Unable to load this report"
      description="We couldn't load this report snapshot. Try again, or return to the reports list."
    />
  );
}
