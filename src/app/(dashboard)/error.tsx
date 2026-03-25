"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 max-w-md mx-auto text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-destructive/10 animate-pulse-glow">
        <AlertCircle className="size-8 text-destructive" />
      </div>
      <h2 className="mt-5 text-title font-semibold">Something went wrong</h2>
      <p className="mt-2 text-body text-muted-foreground">
        {error.message || "An unexpected error occurred. Please try again."}
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
      {error.digest && (
        <details
          className="mt-6 w-full text-left"
          open={showDetails}
          onToggle={(e) => setShowDetails((e.target as HTMLDetailsElement).open)}
        >
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
            Error details
          </summary>
          <pre className="mt-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground overflow-auto">
            {error.digest}
          </pre>
        </details>
      )}
    </div>
  );
}
