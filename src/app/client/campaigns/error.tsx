"use client";

import { ErrorBoundaryCard } from "@/components/errors/error-boundary-card";

export default function CampaignsErrorBoundary({
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
      title="Unable to load campaigns"
      description="We couldn't load your campaigns. Try again, or return to the dashboard."
    />
  );
}
