"use client";

import { ErrorBoundaryCard } from "@/components/errors/error-boundary-card";

export default function ReportsErrorBoundary({
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
      title="Unable to load reports"
      description="We couldn't load the reports list. Try again, or return to the dashboard."
    />
  );
}
