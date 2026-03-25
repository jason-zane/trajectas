"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Brain } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="ambient-glow" />

      <div className="relative mb-8">
        <div className="flex size-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg">
          <Brain className="size-10" />
        </div>
      </div>

      <p className="text-display font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent animate-fade-in-up">
        404
      </p>

      <h1 className="mt-4 text-title font-semibold">Page not found</h1>
      <p className="mt-2 max-w-md text-body text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
        Check the URL or head back to the dashboard.
      </p>

      <div className="mt-8 flex items-center gap-3">
        <Link href="/">
          <Button>Go to Dashboard</Button>
        </Link>
        <Button variant="outline" onClick={() => router.back()}>
          Go Back
        </Button>
      </div>
    </div>
  );
}
