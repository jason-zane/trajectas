"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { setClientUsagePricingAction } from "@/app/actions/usage-billing";
import {
  ActionDialog,
  ActionDialogBody,
  ActionDialogFooter,
} from "@/components/action-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ConfigureUsageBillingButton({
  clientId,
  clientName,
  enabled,
  unitPriceCents,
}: {
  clientId: string;
  clientName: string;
  enabled: boolean;
  unitPriceCents: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [price, setPrice] = useState(
    unitPriceCents > 0 ? (unitPriceCents / 100).toString() : "",
  );
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    const cents = Math.round((Number.parseFloat(price) || 0) * 100);
    startTransition(async () => {
      const result = await setClientUsagePricingAction({
        clientId,
        enabled: isEnabled,
        unitPriceCents: cents,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`Usage billing updated for ${clientName}.`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Configure
      </Button>

      <ActionDialog
        open={open}
        onOpenChange={setOpen}
        eyebrow="Usage billing"
        title={`Usage billing — ${clientName}`}
        description="Bill this client per completed assessment, invoiced monthly."
      >
        <ActionDialogBody className="space-y-5">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(event) => setIsEnabled(event.target.checked)}
              disabled={isPending}
              className="mt-1 size-4"
            />
            <span className="space-y-1">
              <span className="block text-sm font-medium text-foreground">
                Enable monthly usage billing
              </span>
              <span className="block text-xs text-muted-foreground">
                On the 1st of each month, the prior month&rsquo;s completed
                assessments are invoiced automatically.
              </span>
            </span>
          </label>

          <div className="space-y-2">
            <Label htmlFor="usage-price">
              Price per completed assessment (AUD)
            </Label>
            <Input
              id="usage-price"
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder="25.00"
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              GST-exclusive; GST is applied by Stripe when the invoice is sent.
            </p>
          </div>
        </ActionDialogBody>
        <ActionDialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </ActionDialogFooter>
      </ActionDialog>
    </>
  );
}
