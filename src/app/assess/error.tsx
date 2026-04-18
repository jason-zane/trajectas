"use client";

import { BrandedError } from "@/components/errors/branded-error";

export default function AssessError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <BrandedError
      {...props}
      eyebrow="We couldn't load this page"
      title="Something got in the way of your assessment."
      description="Try the button below. If it keeps happening, reach out to whoever sent you the invite — they can help."
      homeHref="/"
      homeLabel="Close"
    />
  );
}
