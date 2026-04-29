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
  const { token } = useParams<{ token: string }>();

  return (
    <BrandedError
      error={error}
      reset={reset}
      eyebrow="Something went wrong"
      title="Your responses are safe."
      description="Something interrupted this section. Your answers have been saved — you can pick up right where you left off."
      homeHref={`/assess/${token}`}
      homeLabel="Return to start"
    />
  );
}
