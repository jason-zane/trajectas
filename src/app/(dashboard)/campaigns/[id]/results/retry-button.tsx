'use client'

import { useTransition } from "react";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { retrySnapshot } from "@/app/actions/reports";

export function RetryButton({ snapshotId }: { snapshotId: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await retrySnapshot(snapshotId);
          toast.success("Snapshot queued for retry");
        })
      }
    >
      <RotateCcw className="size-3.5" />
      {isPending ? "Retrying…" : "Retry"}
    </Button>
  );
}
