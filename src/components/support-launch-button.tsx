"use client";

import { useMemo, useState, useTransition } from "react";
import { ExternalLink, LifeBuoy } from "lucide-react";
import { toast } from "sonner";
import { startAuditedSupportLaunch } from "@/app/actions/workspace-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface SupportLaunchButtonProps {
  targetSurface: "partner" | "client";
  targetTenantId: string;
  targetLabel: string;
  launchEndpoint: string | null;
  nextPath: string;
}

function buildLaunchUrl(base: string, params: Record<string, string>) {
  const url = base.startsWith("http")
    ? new URL(base)
    : new URL(base, window.location.origin);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

export function SupportLaunchButton({
  targetSurface,
  targetTenantId,
  targetLabel,
  launchEndpoint,
  nextPath,
}: SupportLaunchButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const isDisabled = !launchEndpoint;
  const helperText = useMemo(() => {
    if (launchEndpoint) {
      return `Start an audited support session in the ${targetSurface} surface for ${targetLabel}.`;
    }

    return "Configure the target surface URL before using support launch outside local development.";
  }, [launchEndpoint, targetLabel, targetSurface]);

  const handleLaunch = () => {
    if (!launchEndpoint) {
      toast.error(
        "Support launch is unavailable because the target surface URL is not configured."
      );
      return;
    }

    if (!reason.trim()) {
      toast.error("A support reason is required.");
      return;
    }

    startTransition(async () => {
      const result = await startAuditedSupportLaunch({
        targetSurface,
        targetTenantId,
        reason: reason.trim(),
      });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      const launchUrl = buildLaunchUrl(launchEndpoint, {
        sessionId: result.supportSessionId,
        sessionKey: result.sessionKey,
        next: nextPath,
      });

      setOpen(false);
      window.location.assign(launchUrl);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" disabled={isDisabled} />
        }
      >
        <LifeBuoy className="size-4" />
        Open {targetSurface === "client" ? "Client" : "Partner"} Portal
        <ExternalLink className="size-3.5 opacity-60" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start Support Session</DialogTitle>
          <DialogDescription>{helperText}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="support-reason">Reason</Label>
          <Textarea
            id="support-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Explain why you need to launch into this workspace."
            rows={4}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleLaunch} disabled={isPending || !reason.trim()}>
            {isPending ? "Launching..." : "Start Support Session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
