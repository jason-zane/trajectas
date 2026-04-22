"use client";

import { usePathname } from "next/navigation";
import { BrandedError } from "@/components/errors/branded-error";

export default function SectionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();
  const token = pathname.match(/^\/assess\/([^/]+)/)?.[1];
  const startHref = token ? `/assess/${token}` : "/";

  return (
    <div className="flex min-h-screen items-center justify-center">
      <BrandedError
        error={error}
        reset={reset}
        eyebrow="Something went wrong"
        title="Your progress is safe."
        description="Something went wrong on this page. Your responses have been saved. You can continue from where you left off."
        homeHref={startHref}
        homeLabel="Return to start"
      />
    </div>
  );
}
