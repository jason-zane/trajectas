"use client";

import { ErrorBoundaryCard } from "@/components/errors/error-boundary-card";

export default function ReportTemplatesErrorBoundary({
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
      title="Unable to load report templates"
      description="We couldn't load the report templates list. Try again, or return to the dashboard."
    />
  );
}
