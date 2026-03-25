"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Dna, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ConstructsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 max-w-md mx-auto text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-trait-bg">
        <Dna className="size-7 text-trait-accent" />
      </div>
      <h2 className="mt-5 text-title font-semibold">Error loading constructs</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {error.message || "Failed to load constructs. Please try again."}
      </p>
      <div className="mt-6 flex items-center gap-3">
        <Button onClick={reset}>
          <RotateCcw className="size-4" />
          Try Again
        </Button>
        <Link href="/">
          <Button variant="outline">
            <Home className="size-4" />
            Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
