"use client";

import { useParams } from "next/navigation";
import { BrandedError } from "@/components/errors/branded-error";

export default function SectionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";

  return (
    <BrandedError
      error={error}
      reset={reset}
      eyebrow="Something went wrong"
      title="Your responses have been saved."
      description="Something went wrong on this page. You can pick up right where you left off — just try again or return to the start of your assessment."
      homeHref={token ? `/assess/${token}` : "/"}
      homeLabel="Return to start"
    />
  );
}
