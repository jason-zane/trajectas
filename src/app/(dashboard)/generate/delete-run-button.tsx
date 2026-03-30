"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteGenerationRun } from "@/app/actions/generation";

export function DeleteRunButton({ runId }: { runId: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      await deleteGenerationRun(runId);
      setOpen(false);
      toast.success("Run deleted");
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon-xs"
        className="text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-3.5" />
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete generation run?"
        description="This will permanently delete the run and any unaccepted items. Items already accepted into the library are not affected."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleConfirm}
        loading={isPending}
      />
    </>
  );
}
