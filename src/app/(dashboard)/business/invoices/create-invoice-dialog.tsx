"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { createOneOffInvoiceAction } from "@/app/actions/invoices";
import {
  ActionDialog,
  ActionDialogBody,
  ActionDialogFooter,
} from "@/components/action-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSelectLabel } from "@/lib/select-display";
import type { BillingClientOption } from "@/types/database";

interface LineItemDraft {
  description: string;
  quantity: string;
  amount: string; // dollars, as entered
}

const EMPTY_LINE: LineItemDraft = { description: "", quantity: "1", amount: "" };

function toCents(amount: string): number {
  const value = Number.parseFloat(amount);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

export function CreateInvoiceDialog({
  clients,
  defaultClientId,
}: {
  clients: BillingClientOption[];
  defaultClientId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState(defaultClientId ?? "");
  const [billingEmail, setBillingEmail] = useState("");
  const [legalName, setLegalName] = useState("");
  const [memo, setMemo] = useState("");
  const [paymentTermsDays, setPaymentTermsDays] = useState("14");
  const [lines, setLines] = useState<LineItemDraft[]>([{ ...EMPTY_LINE }]);
  const [sentUrl, setSentUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const clientOptions = useMemo(
    () => clients.map((client) => ({ value: client.id, label: client.name })),
    [clients],
  );

  const totalCents = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const qty = Math.max(1, Math.round(Number(line.quantity) || 0));
        return sum + toCents(line.amount) * qty;
      }, 0),
    [lines],
  );

  function resetForm() {
    setClientId(defaultClientId ?? "");
    setBillingEmail("");
    setLegalName("");
    setMemo("");
    setPaymentTermsDays("14");
    setLines([{ ...EMPTY_LINE }]);
    setSentUrl(null);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) resetForm();
  }

  function updateLine(index: number, patch: Partial<LineItemDraft>) {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  function addLine() {
    setLines((prev) => [...prev, { ...EMPTY_LINE }]);
  }

  function removeLine(index: number) {
    setLines((prev) =>
      prev.length === 1 ? prev : prev.filter((_, i) => i !== index),
    );
  }

  const validLines = lines.filter(
    (line) => line.description.trim().length > 0 && toCents(line.amount) > 0,
  );

  const canSubmit =
    clientId.length > 0 &&
    billingEmail.trim().length > 0 &&
    validLines.length > 0 &&
    !isPending;

  function handleSubmit() {
    startTransition(async () => {
      const result = await createOneOffInvoiceAction({
        clientId,
        legalName: legalName.trim() || undefined,
        billingEmail: billingEmail.trim(),
        memo: memo.trim() || undefined,
        paymentTermsDays: Math.max(0, Math.round(Number(paymentTermsDays) || 14)),
        lineItems: validLines.map((line) => ({
          description: line.description.trim(),
          quantity: Math.max(1, Math.round(Number(line.quantity) || 1)),
          unitAmountCents: toCents(line.amount),
        })),
      });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Invoice created and sent.");
      setSentUrl(result.hostedInvoiceUrl);
      router.refresh();
    });
  }

  const formattedTotal = new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(totalCents / 100);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus data-icon="inline-start" />
        New invoice
      </Button>

      <ActionDialog
        open={open}
        onOpenChange={handleOpenChange}
        eyebrow="Business"
        title="Create invoice"
        description="Bill a client for one-off consultancy work. Stripe sends a payable invoice by email."
      >
        <ActionDialogBody className="space-y-5">
          {sentUrl !== null ? (
            <div className="space-y-3">
              <p className="text-sm text-foreground">
                The invoice has been finalized and emailed to {billingEmail.trim()}.
              </p>
              {sentUrl ? (
                <a
                  href={sentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Open the hosted invoice
                  <ExternalLink className="size-3.5" />
                </a>
              ) : null}
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="invoice-client">Client</Label>
                  <Select
                    value={clientId}
                    onValueChange={(value) => setClientId(value ?? "")}
                    disabled={isPending}
                  >
                    <SelectTrigger id="invoice-client" className="w-full">
                      <SelectValue>
                        {(value: string | null) =>
                          getSelectLabel(value, clientOptions) ?? "Select a client"
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {clientOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invoice-email">Billing email</Label>
                  <Input
                    id="invoice-email"
                    type="email"
                    value={billingEmail}
                    onChange={(event) => setBillingEmail(event.target.value)}
                    placeholder="accounts@client.com"
                    disabled={isPending}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="invoice-legal-name">
                    Legal name <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="invoice-legal-name"
                    value={legalName}
                    onChange={(event) => setLegalName(event.target.value)}
                    placeholder="Client Pty Ltd"
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoice-terms">Payment terms (days)</Label>
                  <Input
                    id="invoice-terms"
                    type="number"
                    min={0}
                    value={paymentTermsDays}
                    onChange={(event) => setPaymentTermsDays(event.target.value)}
                    disabled={isPending}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Line items</Label>
                <div className="space-y-2">
                  {lines.map((line, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <Input
                        value={line.description}
                        onChange={(event) =>
                          updateLine(index, { description: event.target.value })
                        }
                        placeholder="Description"
                        disabled={isPending}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(event) =>
                          updateLine(index, { quantity: event.target.value })
                        }
                        placeholder="Qty"
                        disabled={isPending}
                        className="w-16"
                        aria-label="Quantity"
                      />
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.amount}
                        onChange={(event) =>
                          updateLine(index, { amount: event.target.value })
                        }
                        placeholder="0.00"
                        disabled={isPending}
                        className="w-28"
                        aria-label="Unit amount (AUD)"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLine(index)}
                        disabled={isPending || lines.length === 1}
                        aria-label="Remove line item"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addLine}
                  disabled={isPending}
                >
                  <Plus data-icon="inline-start" />
                  Add line
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoice-memo">
                  Memo <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="invoice-memo"
                  value={memo}
                  onChange={(event) => setMemo(event.target.value)}
                  placeholder="Shown on the invoice"
                  disabled={isPending}
                />
              </div>

              <div className="flex items-center justify-between border-t pt-3 text-sm">
                <span className="text-muted-foreground">
                  Total (GST applied by Stripe at send)
                </span>
                <span className="font-medium tabular-nums">{formattedTotal}</span>
              </div>
            </>
          )}
        </ActionDialogBody>
        <ActionDialogFooter>
          {sentUrl !== null ? (
            <Button onClick={() => handleOpenChange(false)}>Done</Button>
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={() => handleOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={!canSubmit}>
                {isPending ? "Sending…" : "Create & send"}
              </Button>
            </>
          )}
        </ActionDialogFooter>
      </ActionDialog>
    </>
  );
}
