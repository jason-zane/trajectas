"use client";

import { BrandedError } from "@/components/errors/branded-error";

export default function PartnerError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <BrandedError
      {...props}
      homeHref="/partner/dashboard"
      homeLabel="Back to dashboard"
    />
  );
}
