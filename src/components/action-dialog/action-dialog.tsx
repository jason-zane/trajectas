"use client";

import type { ReactNode } from "react";
import { XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ActionDialogSize = "default" | "xl";

const SIZE_CLASSES: Record<ActionDialogSize, string> = {
  default: "sm:max-w-2xl",
  xl: "sm:max-w-[1100px]",
};

interface ActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  showCloseButton?: boolean;
  size?: ActionDialogSize;
}

export function ActionDialog({
  open,
  onOpenChange,
  eyebrow,
  title,
  description,
  children,
  className,
  showCloseButton = true,
  size = "default",
}: ActionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-black/30 supports-backdrop-filter:backdrop-blur-sm" />
        <DialogPrimitive.Popup
          data-slot="action-dialog"
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex max-h-[90vh] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-card text-card-foreground shadow-2xl ring-1 ring-foreground/[0.08] outline-none",
            SIZE_CLASSES[size],
            "duration-150 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:z-20 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/25 before:to-transparent",
            className,
          )}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-primary/[0.07] via-primary/[0.02] to-transparent"
          />

          <div className="relative shrink-0 px-8 pt-8 pb-2">
            {eyebrow ? (
              <p className="text-overline text-primary mb-2">{eyebrow}</p>
            ) : null}
            <DialogPrimitive.Title className="font-heading text-2xl leading-tight font-semibold tracking-tight">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-2 max-w-lg text-sm text-muted-foreground">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>

          {children}

          {showCloseButton ? (
            <DialogPrimitive.Close
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="absolute top-4 right-4 z-30"
                />
              }
            >
              <XIcon className="size-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          ) : null}
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}

export function ActionDialogBody({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      data-slot="action-dialog-body"
      className={cn("relative flex-1 overflow-y-auto px-8 py-6", className)}
    >
      {children}
    </div>
  );
}

export function ActionDialogFooter({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      data-slot="action-dialog-footer"
      className={cn(
        "relative flex shrink-0 items-center justify-between gap-2 border-t border-border/60 bg-muted/20 px-8 py-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
