"use client";

import { BrandedError } from "@/components/errors/branded-error";

export default function ClientError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <BrandedError
      {...props}
      homeHref="/client/dashboard"
      homeLabel="Back to dashboard"
    />
  );
}
