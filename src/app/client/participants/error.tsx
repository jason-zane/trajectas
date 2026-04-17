"use client";

import { ErrorBoundaryCard } from "@/components/errors/error-boundary-card";

export default function ParticipantsErrorBoundary({
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
      title="Unable to load participants"
      description="We couldn't load participant data. Try again, or return to the dashboard."
    />
  );
}
