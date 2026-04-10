"use client";

import { ErrorBoundaryCard } from "@/components/errors/error-boundary-card";

export default function ReportTemplateBuilderErrorBoundary({
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
      title="Unable to load the template builder"
      description="We couldn't load the report template builder. Try again, or return to the templates list."
    />
  );
}
