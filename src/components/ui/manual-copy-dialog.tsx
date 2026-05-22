"use client";

import { useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ManualCopyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  value: string;
}

/**
 * Fallback UI when `navigator.clipboard.writeText` is unavailable or rejects.
 * Presents the value in a focused, pre-selected, read-only input so the user
 * can copy it manually with the keyboard. Avoids putting the value in a toast
 * (where it could be shoulder-surfed and is not selectable on most platforms).
 */
export function ManualCopyDialog({
  open,
  onOpenChange,
  title = "Copy link manually",
  description = "Your browser blocked the automatic copy. Select and copy the link below.",
  value,
}: ManualCopyDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 50);
    return () => window.clearTimeout(id);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <input
          ref={inputRef}
          readOnly
          value={value}
          className="h-10 w-full min-w-0 rounded-lg border border-input bg-muted/30 px-3 py-1.5 text-sm font-mono shadow-[inset_0_1px_2px_rgb(0_0_0/0.04)] outline-none focus-visible:border-ring focus-visible:bg-background focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
