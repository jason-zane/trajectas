"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Settings2, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ResponseFormatsError({
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
      <div className="flex size-14 items-center justify-center rounded-2xl bg-item-bg">
        <Settings2 className="size-7 text-item-accent" />
      </div>
      <h2 className="mt-5 text-title font-semibold">Error loading response formats</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {error.message || "Failed to load response formats. Please try again."}
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
