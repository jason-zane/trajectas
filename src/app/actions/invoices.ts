"use server";

import { revalidatePath } from "next/cache";

import { requireAdminScope } from "@/lib/auth/authorization";
import { logAuditEventSafe } from "@/lib/auth/support-sessions";
import {
  listBillingClients,
  listInvoicesForAdmin,
} from "@/lib/dal/billing";
import { createOneOffInvoice } from "@/lib/stripe/invoices";
import type {
  BillingClientOption,
  InvoiceLineItem,
  InvoiceListItem,
} from "@/types/database";

export async function getInvoicesForAdmin(): Promise<InvoiceListItem[]> {
  await requireAdminScope();
  return listInvoicesForAdmin();
}

export async function getBillingClients(): Promise<BillingClientOption[]> {
  await requireAdminScope();
  return listBillingClients();
}

export interface CreateInvoiceActionInput {
  clientId: string;
  legalName?: string;
  billingEmail: string;
  taxId?: string;
  paymentTermsDays?: number;
  memo?: string;
  lineItems: InvoiceLineItem[];
}

export type CreateInvoiceActionResult =
  | { success: true; invoiceId: string; hostedInvoiceUrl: string | null }
  | { error: string };

export async function createOneOffInvoiceAction(
  input: CreateInvoiceActionInput,
): Promise<CreateInvoiceActionResult> {
  try {
    const scope = await requireAdminScope();

    if (!input.clientId) return { error: "Select a client to invoice." };
    if (!input.billingEmail?.trim()) {
      return { error: "A billing email is required." };
    }

    const lineItems = (input.lineItems ?? [])
      .map((item) => ({
        description: item.description.trim(),
        quantity: Math.max(1, Math.round(item.quantity)),
        unitAmountCents: Math.round(item.unitAmountCents),
      }))
      .filter((item) => item.description.length > 0 && item.unitAmountCents > 0);

    if (lineItems.length === 0) {
      return { error: "Add at least one line item with a description and amount." };
    }

    const invoice = await createOneOffInvoice({
      clientId: input.clientId,
      legalName: input.legalName?.trim() || null,
      billingEmail: input.billingEmail.trim(),
      taxId: input.taxId?.trim() || null,
      paymentTermsDays: input.paymentTermsDays,
      memo: input.memo?.trim() || null,
      lineItems,
    });

    await logAuditEventSafe({
      actorProfileId: scope.actor?.id ?? null,
      eventType: "invoice.created",
      targetTable: "invoices",
      targetId: invoice.id,
      clientId: input.clientId,
      metadata: {
        stripeInvoiceId: invoice.stripeInvoiceId,
        totalCents: invoice.totalCents,
        kind: invoice.kind,
      },
    });

    revalidatePath("/business/invoices");
    return {
      success: true,
      invoiceId: invoice.id,
      hostedInvoiceUrl: invoice.hostedInvoiceUrl,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not create the invoice.",
    };
  }
}
