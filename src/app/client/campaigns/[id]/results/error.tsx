"use client";

import { ErrorBoundaryCard } from "@/components/errors/error-boundary-card";

export default function ClientCampaignResultsErrorBoundary({
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
      title="Unable to load campaign results"
      description="We couldn't load the results for this campaign. Try again, or return to the campaign."
    />
  );
}
